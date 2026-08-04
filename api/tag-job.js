import { handleOptions, requireAuth, respond } from './_lib/auth.js'

const MAX_FIELD_CHARS = 20000

const TAG_PROMPT = `Analyze this job posting and return ONLY strict JSON with no markdown, no code fences, and no commentary. The JSON must match exactly this shape:
{
  "required_skills": string[],
  "sector": string,
  "experience_level": "entry" | "mid" | "senior"
}

Rules:
- required_skills: the concrete, normalized skills required for the role (e.g. "React", "accounting", "customer service", "Malawi driving licence", "Microsoft Office"). Normalize (trim) and deduplicate case-insensitively, keeping the most common casing. Max ~15 items.
- sector: the single industry sector for the role, lowercase (e.g. "banking", "agriculture", "healthcare", "IT", "education", "retail"). Use "other" if it cannot be determined.
- experience_level: the seniority required — "entry", "mid", or "senior". Use the requirements/description as the source of truth (e.g. "3+ years" = "mid", "5+ years" or "senior" = "senior", none mentioned = "entry").
- Never omit keys. If a field cannot be determined, use an empty array, "other", or "entry".`

const LEVELS = ['entry', 'mid', 'senior']

export default async function handler(req, res) {
  if (handleOptions(req, res)) return

  try {
    // verify_jwt=true → require a logged-in Supabase session.
    const user = await requireAuth(req, res)
    if (!user) return

    const { title, overview, description, requirements } = req.body || {}

    const parts = [
      title && String(title).trim() ? `Job title: ${String(title).trim()}` : null,
      overview && String(overview).trim() ? `Overview: ${String(overview).trim()}` : null,
      description && String(description).trim() ? `Description: ${String(description).trim()}` : null,
      requirements && String(requirements).trim() ? `Requirements: ${String(requirements).trim()}` : null,
    ]
    const jobText = parts.filter(Boolean).join('\n\n')

    if (!jobText || jobText.length > MAX_FIELD_CHARS) {
      return respond(res, 400, { error: 'Provide a non-empty job description (max 20000 chars)' })
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
            content: TAG_PROMPT,
          },
          {
            role: 'user',
            content: `JOB POSTING:\n${jobText}`,
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Groq error:', JSON.stringify(data))
      return respond(res, 502, { error: data?.error?.message || 'Groq API error' })
    }

    const text = data?.choices?.[0]?.message?.content || ''

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      console.error('Groq non-JSON response:', text, err)
      return respond(res, 502, { error: 'Model did not return valid JSON' })
    }

    const asArray = (v) => (Array.isArray(v) ? v : [])
    const seen = new Set()
    const required_skills = []
    for (const raw of asArray(parsed.required_skills)) {
      const s = typeof raw === 'string' ? raw.trim() : String(raw).trim()
      if (!s) continue
      const key = s.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      required_skills.push(s)
      if (required_skills.length >= 15) break
    }

    let sector =
      typeof parsed.sector === 'string' ? parsed.sector.trim().toLowerCase() : ''
    if (!sector) sector = 'other'

    let experience_level =
      typeof parsed.experience_level === 'string'
        ? parsed.experience_level.trim().toLowerCase()
        : ''
    if (!LEVELS.includes(experience_level)) {
      if (experience_level.includes('senior')) experience_level = 'senior'
      else if (experience_level.includes('mid') || experience_level.includes('intermediate')) experience_level = 'mid'
      else experience_level = 'entry'
    }

    return respond(res, 200, { required_skills, sector, experience_level })
  } catch (err) {
    console.error('tag-job error:', err)
    return respond(res, 500, { error: 'Internal server error' })
  }
}