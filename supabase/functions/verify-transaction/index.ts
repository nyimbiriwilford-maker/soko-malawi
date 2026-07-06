// supabase/functions/verify-transaction/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const PAYCHANGU_SECRET = Deno.env.get('PAYCHANGU_SECRET_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { tx_ref } = await req.json()
    if (!tx_ref) throw new Error('tx_ref required')

    const res = await fetch(`https://api.paychangu.com/verify-payment/${tx_ref}`, {
      headers: { 'Authorization': `Bearer ${PAYCHANGU_SECRET}` },
    })
    const data = await res.json()

    const confirmed = data?.status === 'success' && data?.data?.status === 'success'

    return new Response(JSON.stringify({ confirmed, raw: data }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})