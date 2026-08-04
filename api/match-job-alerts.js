import { adminClient, getBearerToken, respond, handleOptions } from './_lib/auth.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return

  try {
    const { job_id } = req.body || {}
    if (!job_id) {
      return respond(res, 400, { error: 'job_id is required' })
    }

    const supabase = adminClient()

    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, poster_id, title, required_skills, sector, description')
      .eq('id', job_id)
      .maybeSingle()
    if (jobErr) throw jobErr
    if (!job) {
      return respond(res, 404, { error: 'Job not found' })
    }

    // Only the job poster may trigger matching for their own job (avoids spam).
    const token = getBearerToken(req)
    let callerId = null
    if (token) {
      const { data: user } = await supabase.auth.getUser(token)
      callerId = user?.user?.id ?? null
    }
    if (!callerId || callerId !== job.poster_id) {
      return respond(res, 403, { error: 'Not authorized to match this job' })
    }

    const { data: alerts, error: alertsErr } = await supabase
      .from('job_alerts')
      .select('user_id, keywords')
    if (alertsErr) throw alertsErr

    const jobSkills = (job.required_skills || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean)
    const title = String(job.title || '').toLowerCase()
    const description = String(job.description || '').toLowerCase()

    const matches = []
    for (const alert of alerts || []) {
      const keywords = (alert.keywords || [])
        .map((k) => String(k).trim().toLowerCase())
        .filter(Boolean)
      if (keywords.length === 0) continue

      let skillOverlap = 0
      let inTitle = false
      let inDescription = false
      for (const kw of keywords) {
        if (jobSkills.includes(kw)) skillOverlap++
        if (title.includes(kw)) inTitle = true
        if (description.includes(kw)) inDescription = true
      }

      // Threshold: ≥1 keyword match against required_skills, or a keyword
      // appearing in the job title. Description overlap is reported too.
      if (skillOverlap < 1 && !inTitle) continue

      matches.push({
        user_id: alert.user_id,
        keywords: keywords.length,
        skill_overlap: skillOverlap,
        in_title: inTitle,
        in_description: inDescription,
      })
    }

    if (matches.length === 0) {
      return respond(res, 200, { matched: 0 })
    }

    const notified = []
    const failed = []
    let skippedDuplicates = 0

    for (const m of matches) {
      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', m.user_id)
          .eq('type', 'job_match')
          .eq('data->>job_id', job_id)
        if ((count ?? 0) > 0) {
          skippedDuplicates++
          continue
        }

        const payload = {
          job_id,
          job_title: job.title,
          context_id: job_id,
          context_type: 'job',
        }

        const { data: id, error: rpcErr } = await supabase.rpc('notify_user', {
          p_user_id: m.user_id,
          p_type: 'job_match',
          p_title: `💼 New job match: ${job.title}`,
          p_body: `A new job matches your saved keywords: "${job.title}". Tap to view and apply.`,
          p_link: `/jobs?job_id=${job_id}`,
          p_data: payload,
        })
        if (rpcErr) throw rpcErr

        notified.push({ user_id: m.user_id, notification_id: id })
      } catch (e) {
        if (e?.code === '23505') {
          skippedDuplicates++
          continue
        }
        console.error(`[match-job-alerts] notify failed for ${m.user_id}:`, e.message || e)
        failed.push(m.user_id)
      }
    }

    return respond(res, 200, {
      matched: matches.length,
      notified: notified.length,
      skipped_duplicates: skippedDuplicates,
      failed: failed.length,
    })
  } catch (err) {
    console.error('match-job-alerts error:', err)
    return respond(res, 500, { error: 'Internal server error' })
  }
}
