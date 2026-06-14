import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildEmailHTML(message: string): string {
  const year = new Date().getFullYear()
  const paragraphs = message
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(line => `<p style="margin:0 0 18px 0;font-size:16px;line-height:1.8;color:#1a2e1e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${line}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>SokoMW</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f2;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

  <!-- HEADER -->
  <tr>
    <td style="background:#14532d;border-radius:16px 16px 0 0;padding:36px 40px 28px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:9px 18px;">
                  <span style="font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-1px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1;">Soko</span><span style="font-size:26px;font-weight:900;color:#F59E0B;letter-spacing:-1px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1;">MW</span>
                </td>
              </tr>
            </table>
            <p style="margin:14px 0 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.45);font-weight:600;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Buy &bull; Sell &bull; Jobs &bull; Services</p>
          </td>
          <td align="right" style="vertical-align:top;">
            <span style="font-size:11px;color:rgba(255,255,255,0.3);font-weight:500;letter-spacing:1px;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Malawi&apos;s Marketplace</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- GOLD BAR -->
  <tr><td style="height:4px;background:#F59E0B;"></td></tr>

  <!-- HERO -->
  <tr>
    <td style="background:#166534;padding:32px 40px 36px 40px;border-left:1px solid #14532d;border-right:1px solid #14532d;">
      <p style="margin:0 0 8px 0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.3;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Marketplace for Malawi</p>
      <p style="margin:0 0 24px 0;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.65;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Buy products, sell anything, discover jobs, and connect with service providers across Malawi.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background:#F59E0B;border-radius:10px;padding:0;">
            <a href="https://soko-malawi.vercel.app" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#1a1a00;text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:0.2px;">Explore SokoMW &#8594;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- MESSAGE BODY -->
  <tr>
    <td style="background:#ffffff;padding:44px 40px 32px 40px;border-left:1px solid #e0eae1;border-right:1px solid #e0eae1;">
      ${paragraphs}
    </td>
  </tr>

  <!-- SIGN OFF -->
  <tr>
    <td style="background:#ffffff;padding:0 40px 36px 40px;border-left:1px solid #e0eae1;border-right:1px solid #e0eae1;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #eaf2eb;padding-top:24px;">
        <tr>
          <td>
            <p style="margin:0 0 3px 0;font-size:13px;color:#6b8a6e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Warm regards,</p>
            <p style="margin:0 0 2px 0;font-size:15px;font-weight:700;color:#0f1f12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">The SokoMW Team</p>
            <p style="margin:0;font-size:13px;color:#6b8a6e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Malawi&apos;s marketplace &#8212; built for you.</p>
          </td>
          <td align="right" style="vertical-align:middle;">
            <span style="font-size:20px;font-weight:900;color:#166534;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:-1px;">Soko</span><span style="font-size:20px;font-weight:900;color:#F59E0B;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:-1px;">MW</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- FEATURES -->
  <tr>
    <td style="background:#f8faf8;padding:36px 40px;border-left:1px solid #e0eae1;border-right:1px solid #e0eae1;border-top:1px solid #edf4ef;">
      <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:2px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Everything in one place</p>
      <p style="margin:0 0 24px 0;font-size:19px;font-weight:800;color:#0f1f12;letter-spacing:-0.3px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Malawi&apos;s digital marketplace</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="48%" style="vertical-align:top;padding:0 6px 12px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#ffffff;border:1px solid #e8f0e9;border-radius:12px;padding:20px 18px;">
                <p style="margin:0 0 10px 0;font-size:26px;line-height:1;">&#128722;</p>
                <p style="margin:0 0 5px 0;font-size:14px;font-weight:700;color:#0f1f12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Buy</p>
                <p style="margin:0;font-size:13px;color:#4a6a4d;line-height:1.55;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Find quality products from trusted sellers across Malawi.</p>
              </td></tr>
            </table>
          </td>
          <td width="48%" style="vertical-align:top;padding:0 0 12px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#ffffff;border:1px solid #e8f0e9;border-radius:12px;padding:20px 18px;">
                <p style="margin:0 0 10px 0;font-size:26px;line-height:1;">&#128176;</p>
                <p style="margin:0 0 5px 0;font-size:14px;font-weight:700;color:#0f1f12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Sell</p>
                <p style="margin:0;font-size:13px;color:#4a6a4d;line-height:1.55;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Reach thousands of buyers and grow your business fast.</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td width="48%" style="vertical-align:top;padding:0 6px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#ffffff;border:1px solid #e8f0e9;border-radius:12px;padding:20px 18px;">
                <p style="margin:0 0 10px 0;font-size:26px;line-height:1;">&#128188;</p>
                <p style="margin:0 0 5px 0;font-size:14px;font-weight:700;color:#0f1f12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Jobs</p>
                <p style="margin:0;font-size:13px;color:#4a6a4d;line-height:1.55;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Discover employment and career opportunities near you.</p>
              </td></tr>
            </table>
          </td>
          <td width="48%" style="vertical-align:top;padding:0 0 0 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#ffffff;border:1px solid #e8f0e9;border-radius:12px;padding:20px 18px;">
                <p style="margin:0 0 10px 0;font-size:26px;line-height:1;">&#128295;</p>
                <p style="margin:0 0 5px 0;font-size:14px;font-weight:700;color:#0f1f12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Services</p>
                <p style="margin:0;font-size:13px;color:#4a6a4d;line-height:1.55;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Hire skilled professionals and service providers.</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- TRUST -->
  <tr>
    <td style="background:#ffffff;padding:32px 40px;border-left:1px solid #e0eae1;border-right:1px solid #e0eae1;border-top:1px solid #edf4ef;">
      <p style="margin:0 0 20px 0;font-size:16px;font-weight:800;color:#0f1f12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Why people trust SokoMW</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="50%" style="vertical-align:top;padding:0 12px 14px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top;padding-right:10px;">
                  <div style="width:22px;height:22px;background:#dcfce7;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#166534;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">&#10003;</div>
                </td>
                <td>
                  <p style="margin:0 0 2px 0;font-size:13px;font-weight:700;color:#0f1f12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Secure platform</p>
                  <p style="margin:0;font-size:12px;color:#6b8a6e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Your data is safe with us</p>
                </td>
              </tr>
            </table>
          </td>
          <td width="50%" style="vertical-align:top;padding:0 0 14px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top;padding-right:10px;">
                  <div style="width:22px;height:22px;background:#dcfce7;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#166534;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">&#10003;</div>
                </td>
                <td>
                  <p style="margin:0 0 2px 0;font-size:13px;font-weight:700;color:#0f1f12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Trusted community</p>
                  <p style="margin:0;font-size:12px;color:#6b8a6e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Verified buyers and sellers</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td width="50%" style="vertical-align:top;padding-right:12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top;padding-right:10px;">
                  <div style="width:22px;height:22px;background:#dcfce7;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#166534;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">&#10003;</div>
                </td>
                <td>
                  <p style="margin:0 0 2px 0;font-size:13px;font-weight:700;color:#0f1f12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Fast listings</p>
                  <p style="margin:0;font-size:12px;color:#6b8a6e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Post in under 2 minutes</p>
                </td>
              </tr>
            </table>
          </td>
          <td width="50%" style="vertical-align:top;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:top;padding-right:10px;">
                  <div style="width:22px;height:22px;background:#dcfce7;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#166534;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">&#10003;</div>
                </td>
                <td>
                  <p style="margin:0 0 2px 0;font-size:13px;font-weight:700;color:#0f1f12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Nationwide reach</p>
                  <p style="margin:0;font-size:12px;color:#6b8a6e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Across all cities in Malawi</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#0a1f0d;border-radius:0 0 16px 16px;padding:36px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding-bottom:16px;">
            <span style="font-size:20px;font-weight:900;color:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:-1px;">Soko</span><span style="font-size:20px;font-weight:900;color:#F59E0B;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:-1px;">MW</span>
            <p style="margin:6px 0 0 0;font-size:11px;color:rgba(255,255,255,0.35);letter-spacing:2.5px;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Buy &bull; Sell &bull; Jobs &bull; Services</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0 10px;"><a href="https://soko-malawi.vercel.app" style="font-size:12px;color:rgba(255,255,255,0.45);text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Marketplace</a></td>
                <td style="font-size:12px;color:rgba(255,255,255,0.15);">|</td>
                <td style="padding:0 10px;"><a href="https://soko-malawi.vercel.app/jobs" style="font-size:12px;color:rgba(255,255,255,0.45);text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Jobs</a></td>
                <td style="font-size:12px;color:rgba(255,255,255,0.15);">|</td>
                <td style="padding:0 10px;"><a href="https://soko-malawi.vercel.app/services" style="font-size:12px;color:rgba(255,255,255,0.45);text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Services</a></td>
                <td style="font-size:12px;color:rgba(255,255,255,0.15);">|</td>
                <td style="padding:0 10px;"><a href="mailto:nyimbiriwilford@gmail.com" style="font-size:12px;color:rgba(255,255,255,0.45);text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Contact Us</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="padding-bottom:20px;"><div style="height:1px;background:rgba(255,255,255,0.06);"></div></td></tr>
        <tr>
          <td align="center">
            <p style="margin:0 0 4px 0;font-size:11px;color:rgba(255,255,255,0.22);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">&copy; ${year} SokoMW &mdash; Lilongwe, Malawi</p>
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.15);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">You received this because you have a SokoMW account.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`.trim()
}
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>SokoMW</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f1;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f1;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- HEADER -->
          <tr>
            <td style="background:#1b5e20;border-radius:16px 16px 0 0;padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Gold left bar -->
                  <td style="width:5px;background:#f9a825;border-radius:16px 0 0 0;">&nbsp;</td>
                  <td style="padding:32px 36px;">
                    <!-- Logo -->
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:rgba(255,255,255,0.1);border-radius:10px;padding:8px 16px;">
                          <span style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-1px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Soko</span><span style="font-size:24px;font-weight:900;color:#f9a825;letter-spacing:-1px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">MW</span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:10px 0 0 0;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.5);font-weight:600;">Buy · Sell · Find Work</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- GOLD ACCENT -->
          <tr>
            <td style="background:linear-gradient(90deg,#f9a825,#f57f17);height:3px;"></td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px 40px;border-left:1px solid #dde8de;border-right:1px solid #dde8de;">
              ${bodyLines}
            </td>
          </tr>

          <!-- SIGN OFF -->
          <tr>
            <td style="background:#ffffff;padding:0 40px 36px 40px;border-left:1px solid #dde8de;border-right:1px solid #dde8de;">
              <table cellpadding="0" cellspacing="0" style="border-top:1px solid #eaf2eb;padding-top:24px;width:100%;">
                <tr>
                  <td>
                    <p style="margin:0 0 2px 0;font-size:14px;font-weight:700;color:#0d1b0e;">The SokoMW Team</p>
                    <p style="margin:0;font-size:13px;color:#7a917c;">Malawi's marketplace — built for you.</p>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-size:18px;font-weight:900;color:#2e7d32;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Soko</span><span style="font-size:18px;font-weight:900;color:#f9a825;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">MW</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#0d1b0e;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:12px;color:rgba(255,255,255,0.35);letter-spacing:0.3px;">
                © ${year} SokoMW · Lilongwe, Malawi
              </p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
                You received this because you have a SokoMW account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `.trim()
}

async function sendEmailBrevo(to: string, subject: string, html: string) {
  const BREVO_KEY = Deno.env.get('BREVO_API_KEY')!

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Soko Malawi', email: 'nyimbiriwilford@gmail.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })

  const data = await res.json()
  console.log('[Brevo broadcast]', to, JSON.stringify(data))
  if (!res.ok) throw new Error('Brevo error: ' + JSON.stringify(data))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
   const { subject, message, userIds } = await req.json()

if (!subject || !message || !userIds?.length) {
  return new Response(JSON.stringify({ error: 'Missing subject, message, or userIds' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

    // Verify caller is admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admins only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Look up emails server-side using service role
    const { data: { users: authUsers }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (listErr) throw new Error('Failed to list users: ' + listErr.message)

    const emailMap: Record<string, string> = {}
    for (const u of authUsers) { if (u.email) emailMap[u.id] = u.email }

    const emails = userIds.map((id: string) => emailMap[id]).filter(Boolean)
    if (!emails.length) {
      return new Response(JSON.stringify({ error: 'No valid emails found for selected users' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const html = buildEmailHTML(message)
    let sent = 0
    const failed: string[] = []

    for (const email of emails) {
      try {
        await sendEmailBrevo(email, subject, html)
        sent++
        // Small delay to avoid Brevo rate limits
        await new Promise(r => setTimeout(r, 200))
      } catch (e) {
        console.error('[broadcast] failed for', email, e)
        failed.push(email)
      }
    }

    return new Response(JSON.stringify({ sent, failed, total: emails.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[broadcast-email]', err)
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})