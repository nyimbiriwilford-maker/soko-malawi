TASK: On the product page, make it possible for admin to take action when a person has reported a listing. Activate the Report Listing button and give admin power to take appropriate action.

DONE — reporting is now a full loop: buyer reports → admin reviews → admin acts on the listing.

1. Product page — Report Listing activated (src/pages/ListingDetail.jsx)
   - The dead "Report Listing" button in the sidebar now opens a professional report modal:
     • Reason picker with 6 clearly-labelled options (Scam or fraud, Counterfeit or fake item, Prohibited or illegal item, Misleading description or price, Inappropriate content, Other) as selectable cards with a red selected state.
     • Optional details textarea (500 char limit).
     • Submit disabled until a reason is picked; loading state; error alert on failure.
   - On submit it inserts into the existing `user_reports` table with: reporter_id (current user), reported_user_id (the seller), listing_id, reason, details. No new migration needed — the table and RLS already support this (insert policy: reporter_id = auth.uid()).
   - Success state: "Report submitted — our admin team has been notified" confirmation.
   - Anti-spam: after reporting, the button becomes "✓ Reported" and is disabled for the rest of the session (sessionStorage flag keyed by listing id, set both after submit and read on load).

2. Admin — full action power on reported listings (src/pages/Admin.jsx, Safety tab → User reports)
   - Report cards for listing reports now show the reported product inline: thumbnail, title, live listing status, and a "View →" link to the product page. If the listing was already deleted, it shows "Listing unavailable (may have been deleted)".
   - New admin actions directly on the reported listing:
     • 🚫 Remove Listing — sets the listing to inactive (hidden from the marketplace immediately)
     • ↩ Restore — re-activates a deactivated listing
     • 🗑 Delete — permanently deletes the listing (with confirm)
   - Existing ✓ Resolve / ✕ Dismiss report-status actions unchanged; listing actions work independently of report status so admins can act first, then resolve.
   - The Safety tab badge already counts open listing reports (it counts all open user_reports) so admins see pending listing reports at a glance.

3. Backend — nothing new required
   - `user_reports` table (listing_id, reported_user_id, reason, details, status, admin_note) already existed with proper RLS: users insert their own reports; admins (public.is_admin()) can read all and update status.
   - Admin listing updates/deletes already allowed by the `listings_update_own` / delete policies via is_admin().

VERIFIED:
- npx eslint on ListingDetail.jsx + Admin.jsx — same 19 pre-existing problems as on HEAD (0 new issues).
- npm run build — built successfully.
