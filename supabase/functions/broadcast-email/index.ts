import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildEmailHTML(message: string): string {
  const year = new Date().getFullYear()
  const bodyLines = message
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(line => `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.75;color:#1a1a1a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${line}</p>`)
    .join('')

  return `
<!DOCTYPE html>
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
    const { subject, message, emails } = await req.json()

    if (!subject || !message || !emails?.length) {
      return new Response(JSON.stringify({ error: 'Missing subject, message, or emails' }), {
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