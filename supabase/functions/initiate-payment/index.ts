import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const PAYCHANGU_SECRET = Deno.env.get('sec-test-lPp9CIl4hXGApkRDleEs4qwVfYyCHB3c')!

serve(async (req) => {
  // handle CORS for local dev
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { seller_id, email, first_name, last_name, tx_ref, callback_url, return_url } = await req.json()

    const res = await fetch('https://api.paychangu.com/payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYCHANGU_SECRET}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        amount: '5000',
        currency: 'MWK',
        tx_ref,
        first_name,
        last_name,
        email,
        callback_url,
        return_url,
        meta: JSON.stringify({ seller_id, purpose: 'verification' }),
        customization: {
          title: 'SokoMW Seller Verification',
          description: 'One-time seller verification fee',
        },
      }),
    })

    const data = await res.json()

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})