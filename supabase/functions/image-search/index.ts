import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { base64, mediaType } = await req.json()

    if (!base64 || !mediaType) {
      return new Response(
        JSON.stringify({ error: 'Missing base64 or mediaType' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const hfKey = Deno.env.get('HF_API_KEY')
    if (!hfKey) {
      return new Response(
        JSON.stringify({ error: 'HF_API_KEY not set' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // Convert base64 to binary
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Use BLIP image captioning model - free on Hugging Face
    const response = await fetch(
      'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfKey}`,
          'Content-Type': mediaType,
        },
        body: bytes,
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('HF error:', JSON.stringify(data))
      return new Response(
        JSON.stringify({ error: data?.error || 'Hugging Face API error' }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // BLIP returns [{ generated_text: "a photo of a car" }]
    const caption = data?.[0]?.generated_text?.trim() ?? ''

    // Clean up the caption - remove "a photo of", "an image of" etc
    const term = caption
      .replace(/^(a photo of|an image of|a picture of|this is a|there is a|a)\s+/i, '')
      .trim()

    return new Response(
      JSON.stringify({ term }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
