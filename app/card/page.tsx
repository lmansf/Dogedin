import { redirect } from "next/navigation";

// The member card is a Club perk, and the Club is paused pre-launch — there
// are no cards to show. Send anyone who lands here to the "coming soon" page.
// DiscountCard survives in components/membership for the relaunch.
export default function CardPage() {
  redirect("/membership");
}
