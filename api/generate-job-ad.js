import { handleOptions, requireAuth, respond } from './_lib/auth.js'

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

export default async function handler(req, res) {
  if (handleOptions(req, res)) return

  try {
    // verify_jwt=true → require a logged-in Supabase session.
    const user = await requireAuth(req, res)
    if (!user) return

    const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText.trim() : ''
    if (!rawText || rawText.length > MAX_RAW_CHARS) {
      return respond(res, 400, { error: 'Provide a non-empty raw text (max 20000 chars)' })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return respond(res, 500, { error: 'GROQ_API_KEY not set' })
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: GEN_PROMPT,
          },
          {
            role: 'user',
            content: `RAW TEXT:\n${rawText}`,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Groq error:', JSON.stringify(data))
      return respond(res, 502, { error: data?.error?.message || 'Groq API error' })
    }

    const raw = data?.choices?.[0]?.message?.content || ''

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      console.error('Groq non-JSON response:', raw, err)
      return respond(res, 502, { error: 'Model did not return valid JSON' })
    }

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

    return respond(res, 200, out)
  } catch (err) {
    console.error('generate-job-ad error:', err)
    return respond(res, 500, { error: 'Internal server error' })
  }
}