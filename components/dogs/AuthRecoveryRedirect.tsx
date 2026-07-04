"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Supabase appends the password-recovery result to the URL hash of whichever
// redirect target it lands on. If the project's allow-list doesn't include
// /reset-password, Supabase falls back to the Site URL (usually the homepage),
// so a recovery — success OR an "otp_expired" error — can arrive on any page,
// where nothing handles it. This runs everywhere and forwards those landings to
// /reset-password so the reset flow always takes over, even when the redirect
// allow-list isn't configured.
export default function AuthRecoveryRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/reset-password") return;

    // Error case (no session established): the hash carries error params. Keep
    // the hash so /reset-password can show the specific message + a resend form.
    const hash = window.location.hash;
    const looksLikeRecoveryError =
      /error_code=|error=access_denied/.test(hash) &&
      /otp_expired|access_denied|recovery|invalid/i.test(hash);
    if (/type=recovery/.test(hash) || looksLikeRecoveryError) {
      router.replace(`/reset-password${hash}`);
      return;
    }

    // Success case: the Supabase client (mounted by other components on the
    // page) may consume + strip the hash before we see it, establishing a
    // recovery session and firing PASSWORD_RECOVERY. Catch that and forward.
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "PASSWORD_RECOVERY" &&
        window.location.pathname !== "/reset-password"
      ) {
        router.replace("/reset-password");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [pathname, router]);

  return null;
}
