import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://soko-malawi.vercel.app"; // ⚠️ confirm this matches your real domain

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();
    const listing = record;

    if (!listing?.title) return new Response("no title", { status: 200 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: alerts } = await supabase
      .from("wanted_alerts")
      .select("*")
      .eq("active", true);

    if (!alerts?.length) return new Response("no alerts", { status: 200 });

    const matched = alerts.filter((a) => {
      // keywords is an ARRAY column — guard against null/empty rather than
      // assuming it's always a populated array.
      const keywordList = Array.isArray(a.keywords)
        ? a.keywords.map((k: string) => String(k).toLowerCase())
        : [];
      if (keywordList.length === 0) return false;

      const titleMatch = keywordList.some((k: string) =>
        listing.title.toLowerCase().includes(k)
      );

      // ⚠️ a.max_price doesn't exist on wanted_alerts — your schema has
      // max_budget AND budget_max (legacy duplicate pair). Using budget_max
      // here; swap to max_budget if that's the one your UI actually writes.
      const maxBudget = a.budget_max ?? a.max_budget;
      const priceOk = !maxBudget || !listing.price || listing.price <= maxBudget;

      return titleMatch && priceOk;
    });

    if (!matched.length) return new Response("no matches", { status: 200 });

    const results = await Promise.allSettled(
      matched.map(async (alert: any) => {
        const keywordsDisplay = Array.isArray(alert.keywords)
          ? alert.keywords.join(", ")
          : "";

        const notifText = `${listing.title}${listing.price ? ` — MK ${Number(listing.price).toLocaleString()}` : ""}`;

        // Resolve email: stored on the alert, or fall back to the auth user's email
        let alertEmail = alert.email;
        if (!alertEmail && alert.user_id) {
          const { data: userData } = await supabase.auth.admin.getUserById(alert.user_id);
          alertEmail = userData?.user?.email;
        }

        // Email via Brevo (only if notify_email is true and we resolved an email)
        if (alert.notify_email && alertEmail) {
          const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-key": BREVO_API_KEY,
            },
            body: JSON.stringify({
              sender: { name: "SokoMW", email: "no-reply@sokomw.com" },
              to: [{ email: alertEmail }], // fixed: was alert.email, dropping the fallback
              subject: `🔔 New listing matching "${keywordsDisplay}" on SokoMW`,
              htmlContent: `
                <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;background:#f8f9fa;border-radius:16px">
                  <div style="background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
                    <div style="font-size:22px;font-weight:800;color:#0F9D58;margin-bottom:4px">Soko<span style="color:#F9AB00">MW</span></div>
                    <div style="font-size:12px;color:#80868b;margin-bottom:20px">Buy. Sell. Find. Anywhere in Malawi.</div>
                    <h2 style="font-size:18px;font-weight:800;color:#202124;margin-bottom:8px">🔔 New match for "${keywordsDisplay}"</h2>
                    <p style="font-size:14px;color:#5f6368;margin-bottom:20px">A new listing was just posted that matches your alert.</p>
                    <div style="background:#f1f3f4;border-radius:12px;padding:16px;margin-bottom:20px">
                      <div style="font-size:16px;font-weight:700;color:#202124;margin-bottom:4px">${listing.title}</div>
                      ${listing.price ? `<div style="font-size:20px;font-weight:800;color:#0F9D58;margin-bottom:4px">MK ${Number(listing.price).toLocaleString()}</div>` : ""}
                      ${listing.city ? `<div style="font-size:13px;color:#80868b">📍 ${listing.city}</div>` : ""}
                    </div>
                    <a href="${SITE_URL}/listing/${listing.id}"
                      style="display:block;background:#0F9D58;color:#fff;text-decoration:none;border-radius:12px;padding:13px 0;text-align:center;font-size:15px;font-weight:700;margin-bottom:16px">
                      View Listing →
                    </a>
                    <p style="font-size:11.5px;color:#9aa0a6;text-align:center;margin-top:16px">
                      You're receiving this because you set a listing alert on SokoMW.<br/>
                      <a href="${SITE_URL}/search" style="color:#0F9D58">Manage my alerts</a>
                    </p>
                  </div>
                </div>
              `,
            }),
          });
          if (!emailRes.ok) {
            console.error(`Brevo send failed for alert ${alert.id}:`, await emailRes.text());
          }
        }

        // In-app notification (logged-in users only)
        if (alert.user_id) {
          const { error: notifErr } = await supabase.from("notifications").insert({
            user_id: alert.user_id,
            type: "wanted_alert",
            title: `🔔 New match: "${keywordsDisplay}"`,
            message: notifText,
            body: notifText,
            link: `/listing/${listing.id}`,
            read: false,
          });
          if (notifErr) console.error(`Notification insert failed for alert ${alert.id}:`, notifErr);
        }
      })
    );

    // Surface which alerts failed instead of letting Promise.all swallow
    // one failure into a total batch rejection.
    const failures = results.filter(r => r.status === "rejected");
    if (failures.length) {
      console.error(`${failures.length}/${matched.length} alert sends failed:`, failures);
    }

    return new Response(JSON.stringify({ matched: matched.length, failed: failures.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});