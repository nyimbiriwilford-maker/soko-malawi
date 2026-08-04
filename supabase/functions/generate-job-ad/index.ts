// supabase/functions/generate-job-ad/index.ts
// Task 16 — paste raw text → structured job advert, mirroring EMPTY_JOB_FORM.
// Same style/CORS/error pattern as tag-job.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_RAW_CHARS = 20000

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Volunteer']

const CITIES = [
  'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu',
  'Mangochi', 'Karonga', 'Salima', 'Nkhotakota', 'Dedza',
  'Balaka', 'Liwonde', 'Rumphi', 'Chitipa', 'Mulanje',
]

const CATEGORIES = [
  'Technology', 'Education', 'Health', 'Finance', 'Agriculture',
  'Construction', 'Transport', 'Hospitality', 'NGO / Non-profit',
  'Media & Communications', 'Legal', 'Engineering', 'Sales & Marketing', 'Other',
]

const GEN_PROMPT = `You are structuring a pasted job notice into a clean job-ad form for SokoMW (a Malawian marketplace).
Extract the information and return ONLY strict JSON with no markdown, no code fences, and no commentary. The JSON must match EXACTLY this shape (every key must be present, every value a string):

{
  "title": string,
  "company": string,
  "logo_url": string,
  "overview": string,
  "address": string,
  "type": string,
  "category": string,
  "city": string,
  "salary": string,
  "deadline": string,
  "job_purpose": string,
  "description": string,
  "responsibilities": string,
  "requirements": string,
  "contact": string,
  "contact_name": string,
  "contact_address": string,
  "cover_image_url": string,
  "disclaimer": string
}

Rules:
- title: the job title.
- company: the organisation name — ONLY if it is present in the input. If not present, return "" (never invent one).
- logo_url / cover_image_url: always "" (no URLs come from raw text).
- type: MUST be one of ${JSON.stringify(JOB_TYPES)}. If the input doesn't clearly indicate a type, return "".
- category: MUST be one of ${JSON.stringify(CATEGORIES)}. If it can't be determined, return "".
- city: MUST be one of ${JSON.stringify(CITIES)} (Malawian cities). If absent/unknown, return "".
- salary: as-written ("MWK 200,000/mo") or "" if not mentioned. Never invent.
- deadline: as-written (date or description) or "" if not mentioned. Never invent.
- responsibilities: the duties, each on its OWN new line prefixed with "- ". Leave "" if none.
- requirements: the qualifications/experience, each on its own new line prefixed with "- ". Leave "" if none.
- job_purpose: a one-paragraph "role summary & reporting line".
- description: a short paragraph summarising the role.
- overview: a short paragraph about the organisation (only if mentioned; else "").
- address / contact / contact_name / contact_address / disclaimer: only what is literally stated in the input; otherwise "".
- NEVER invent company names, contact details, deadlines, salaries, or locations. When a field is not present in the input, return the empty string "".
- Never omit keys. Output must contain exactly the 19 keys above.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { rawText } = await req.json()
    const text = typeof rawText === 'string' ? rawText.trim() : ''

    if (!text || text.length > MAX_RAW_CHARS) {
      return new Response(
        JSON.stringify({ error: 'Provide a non-empty raw text (max 20000 chars)' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not set' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${GEN_PROMPT}\n\nRAW TEXT:\n${text}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Gemini error:', JSON.stringify(data))
      return new Response(
        JSON.stringify({ error: data?.error?.message || 'Gemini API error' }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const raw = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('') || ''

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      console.error('Gemini non-JSON response:', raw)
      return new Response(
        JSON.stringify({ error: 'Gemini did not return valid JSON' }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // Build the response, coercing every value to a string and only including
    // the exact EMPTY_JOB_FORM keys (unknown keys are dropped by the client).
    const keys = [
      'title', 'company', 'logo_url', 'overview', 'address',
      'type', 'category', 'city', 'salary', 'deadline',
      'job_purpose', 'description', 'responsibilities', 'requirements',
      'contact', 'contact_name', 'contact_address', 'cover_image_url', 'disclaimer',
    ]
    const out = {}
    for (const k of keys) {
      out[k] = typeof parsed[k] === 'string' ? parsed[k].trim() : ''
    }

    return new Response(
      JSON.stringify(out),
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