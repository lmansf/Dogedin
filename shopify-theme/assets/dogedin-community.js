/* Dogedin community client for the Shopify theme.
 * Talks to the SAME Supabase backend as dogedin.com (anon key + RLS; the key
 * is public by design — every rule is enforced by Postgres row-level
 * security, identical to the Next.js app). Ports conventions 1:1 from the
 * repo: slug/tag generation (RegisterFlow.tsx), photo paths, public_ads +
 * viewability rules (AdSlot.tsx), RPC names (supabase/schema.sql). */
(function () {
  if (window.Dogedin) return;
  var URL_ = "https://gyagcdjuccgosbqxcqiv.supabase.co";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5YWdjZGp1Y2Nnb3NicXhjcWl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDQxMzMsImV4cCI6MjA5ODUyMDEzM30.AAcAL5r9e9wMh2kD6WKJfZA_BckM6aCjPA4vlNdOy-E";
  var LS = "dogedin_sb_session";

  function headers(token, extra) {
    var h = { apikey: KEY, Authorization: "Bearer " + (token || KEY) };
    for (var k in (extra || {})) h[k] = extra[k];
    return h;
  }
  function saveSession(s) {
    if (!s || !s.access_token) return null;
    var sess = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
      user: { id: s.user && s.user.id, email: s.user && s.user.email }
    };
    localStorage.setItem(LS, JSON.stringify(sess));
    return sess;
  }
  async function getSession() {
    var raw = localStorage.getItem(LS);
    if (!raw) return null;
    var s; try { s = JSON.parse(raw); } catch (e) { return null; }
    if (s.expires_at - 60 > Date.now() / 1000) return s;
    if (!s.refresh_token) { localStorage.removeItem(LS); return null; }
    var r = await fetch(URL_ + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST", headers: headers(null, { "Content-Type": "application/json" }),
      body: JSON.stringify({ refresh_token: s.refresh_token })
    });
    if (!r.ok) { localStorage.removeItem(LS); return null; }
    return saveSession(await r.json());
  }
  async function authPost(path, body) {
    var r = await fetch(URL_ + path, {
      method: "POST", headers: headers(null, { "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    });
    var j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((j && (j.msg || j.error_description || j.message)) || ("Auth error " + r.status));
    return j;
  }
  async function rest(method, path, body, token, prefer) {
    var h = headers(token, { "Content-Type": "application/json" });
    if (prefer) h.Prefer = prefer;
    var r = await fetch(URL_ + "/rest/v1/" + path, {
      method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body)
    });
    var text = await r.text();
    var j = null; try { j = text ? JSON.parse(text) : null; } catch (e) {}
    if (!r.ok) {
      var err = new Error((j && (j.message || j.hint)) || ("Request failed (" + r.status + ")"));
      err.code = j && j.code; err.status = r.status;
      throw err;
    }
    return j;
  }

  window.Dogedin = {
    siteUrl: "https://dogedin.com",
    async signUp(email, password) {
      var j = await authPost("/auth/v1/signup", { email: email, password: password });
      if (j && j.access_token) return { session: saveSession(j) };
      return { session: null, confirm: true };
    },
    async signIn(email, password) {
      var j = await authPost("/auth/v1/token?grant_type=password", { email: email, password: password });
      return { session: saveSession(j) };
    },
    async resetPassword(email) {
      // The recovery link lands on dogedin.com/reset-password — same account,
      // same reset flow the main site uses.
      await authPost("/auth/v1/recover?redirect_to=" + encodeURIComponent("https://dogedin.com/reset-password"), { email: email });
    },
    signOut() { localStorage.removeItem(LS); },
    getSession: getSession,
    async select(path, token) { return rest("GET", path, undefined, token); },
    async del(path, token) { return rest("DELETE", path, undefined, token); },
    async insert(table, row, token) {
      return rest("POST", table, row, token, "return=minimal");
    },
    async update(path, changes, token) {
      return rest("PATCH", path, changes, token, "return=minimal");
    },
    async rpc(name, args, token) {
      return rest("POST", "rpc/" + name, args || {}, token);
    },
    async upload(bucket, path, file, token) {
      var r = await fetch(URL_ + "/storage/v1/object/" + bucket + "/" + path, {
        method: "POST", headers: headers(token, { "Content-Type": file.type }), body: file
      });
      if (!r.ok) {
        var j = null; try { j = await r.json(); } catch (e) {}
        throw new Error((j && (j.message || j.error)) || "Upload failed");
      }
    },
    async removeObject(bucket, path, token) {
      try { await fetch(URL_ + "/storage/v1/object/" + bucket + "/" + path, { method: "DELETE", headers: headers(token) }); } catch (e) {}
    },
    photoUrl(path) {
      return path ? URL_ + "/storage/v1/object/public/dog-photos/" + path : null;
    },
    // Public URL for any public-read bucket object (ad-creatives, etc.).
    publicUrl(bucket, path) {
      return path ? URL_ + "/storage/v1/object/public/" + bucket + "/" + path : null;
    },
    // --- RegisterFlow.tsx conventions, ported verbatim -----------------
    slugStem(name) {
      return (name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "").slice(0, 32)) || "dog";
    },
    randomSuffix() { return crypto.randomUUID().replace(/-/g, "").slice(0, 6); },
    randomTagCode() {
      var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      var bytes = crypto.getRandomValues(new Uint8Array(8));
      return Array.from(bytes, function (b) { return alphabet[b % alphabet.length]; }).join("");
    },
    async moderateBio(text, token) {
      try {
        var r = await fetch(URL_ + "/functions/v1/moderate-bio", {
          method: "POST", headers: headers(token, { "Content-Type": "application/json" }),
          body: JSON.stringify({ text: text })
        });
        if (!r.ok) return text;
        var j = await r.json();
        return ("cleaned" in j) ? j.cleaned : text;
      } catch (e) { return text; }
    },
    // Fire a Supabase Edge Function (the same notification path the website
    // uses — notify-ad-inquiry, welcome-business). Best-effort: the row is
    // already saved, so a failed nudge never blocks the user.
    async invokeFunction(name, body, token) {
      try {
        await fetch(URL_ + "/functions/v1/" + name, {
          method: "POST", headers: headers(token, { "Content-Type": "application/json" }),
          body: JSON.stringify(body || {})
        });
      } catch (e) {}
    },
    // Weighted-random pick (lib/ads.ts pickWeighted, ported verbatim).
    pickWeighted(ads) {
      if (!ads.length) return null;
      var total = ads.reduce(function (s, a) { return s + Math.max(0, a.weight); }, 0);
      if (total <= 0) return null;
      var r = Math.random() * total;
      for (var i = 0; i < ads.length; i++) {
        r -= Math.max(0, ads[i].weight);
        if (r <= 0) return ads[i];
      }
      return ads[ads.length - 1];
    }
  };
})();
