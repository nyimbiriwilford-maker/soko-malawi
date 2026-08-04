// supabase/functions/tag-job/index.ts
// Task 15 step 2 — tag a job posting with required_skills / sector / experience_level.
// Same style/CORS/error pattern as parse-cv.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { title, overview, description, requirements } = await req.json()

    const parts = [
      title && String(title).trim() ? `Job title: ${String(title).trim()}` : null,
      overview && String(overview).trim() ? `Overview: ${String(overview).trim()}` : null,
      description && String(description).trim() ? `Description: ${String(description).trim()}` : null,
      requirements && String(requirements).trim() ? `Requirements: ${String(requirements).trim()}` : null,
    ]
    const jobText = parts.filter(Boolean).join('\n\n')

    if (!jobText || jobText.length > MAX_FIELD_CHARS) {
      return new Response(
        JSON.stringify({ error: 'Provide a non-empty job description (max 20000 chars)' }),
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
          contents: [{ parts: [{ text: `${TAG_PROMPT}\n\nJOB POSTING:\n${jobText}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
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

    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('') || ''

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      console.error('Gemini non-JSON response:', text)
      return new Response(
        JSON.stringify({ error: 'Gemini did not return valid JSON' }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
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

    return new Response(
      JSON.stringify({ required_skills, sector, experience_level }),
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
