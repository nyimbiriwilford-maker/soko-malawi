/**
 * Status video helpers — duration limits + client-side trim.
 * Clip length / start are chosen by the user; hard max is STATUS_VIDEO_MAX_SECONDS.
 */

/** Absolute max length of a status video (seconds). */
export const STATUS_VIDEO_MAX_SECONDS = 30

/** Preset lengths users can pick (filtered by video length + max). */
export const STATUS_VIDEO_LENGTH_PRESETS = [10, 15, 20, 30]

const PREF_KEY = 'soko_status_video_clip_seconds'

/** Soft target for encoding bitrate (bits/sec) */
const VIDEO_BITRATE = 2_500_000

export function getPreferredClipSeconds(videoDuration = Infinity) {
  let pref = 15
  try {
    const raw = localStorage.getItem(PREF_KEY)
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) pref = n
  } catch { /* ignore */ }
  const cap = Math.min(STATUS_VIDEO_MAX_SECONDS, Number.isFinite(videoDuration) ? videoDuration : STATUS_VIDEO_MAX_SECONDS)
  return Math.max(1, Math.min(pref, Math.floor(cap) || STATUS_VIDEO_MAX_SECONDS))
}

export function setPreferredClipSeconds(seconds) {
  try {
    localStorage.setItem(PREF_KEY, String(Math.round(seconds)))
  } catch { /* ignore */ }
}

/**
 * @param {File|Blob} file
 * @returns {Promise<number>} duration in seconds
 */
export function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    const cleanup = () => URL.revokeObjectURL(url)
    video.onloadedmetadata = () => {
      const d = video.duration
      cleanup()
      if (!Number.isFinite(d) || d <= 0) reject(new Error('Could not read video length'))
      else resolve(d)
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('Could not load video'))
    }
    video.src = url
  })
}

function pickRecorderMime() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]
  if (typeof MediaRecorder === 'undefined') return ''
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

/**
 * Available length options for a given source duration.
 * Always includes “full video” when under max, plus presets.
 */
export function getClipLengthOptions(videoDuration) {
  const d = Number.isFinite(videoDuration) ? videoDuration : STATUS_VIDEO_MAX_SECONDS
  const hardMax = Math.min(STATUS_VIDEO_MAX_SECONDS, d)
  const opts = []
  for (const p of STATUS_VIDEO_LENGTH_PRESETS) {
    if (p <= hardMax + 0.05) opts.push(p)
  }
  // Full video (capped) if not already a preset
  const full = Math.floor(hardMax * 10) / 10
  if (full >= 1 && !opts.some(o => Math.abs(o - full) < 0.5)) {
    opts.push(Math.min(STATUS_VIDEO_MAX_SECONDS, Math.round(full)))
  }
  // Ensure at least one option
  if (!opts.length) opts.push(Math.max(1, Math.min(STATUS_VIDEO_MAX_SECONDS, Math.floor(d) || 15)))
  return [...new Set(opts)].sort((a, b) => a - b)
}

/**
 * Trim video from startSeconds for durationSeconds (user preference).
 *
 * @param {File} file
 * @param {object} [opts]
 * @param {number} [opts.startSeconds=0]
 * @param {number} [opts.durationSeconds] clip length (defaults to max)
 * @param {(pct: number) => void} [opts.onProgress]
 */
export async function trimStatusVideo(file, opts = {}) {
  const startSeconds = Math.max(0, Number(opts.startSeconds) || 0)
  let durationSeconds = Number(opts.durationSeconds)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    durationSeconds = STATUS_VIDEO_MAX_SECONDS
  }
  durationSeconds = Math.min(STATUS_VIDEO_MAX_SECONDS, durationSeconds)
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {}

  if (!file || !file.type?.startsWith('video/')) {
    return {
      file,
      trimmed: false,
      originalDuration: 0,
      startSeconds,
      durationSeconds,
    }
  }

  let originalDuration = 0
  try {
    originalDuration = await getVideoDuration(file)
  } catch {
    return {
      file,
      trimmed: false,
      originalDuration: 0,
      startSeconds,
      durationSeconds,
      note: 'duration-unknown',
    }
  }

  onProgress(4)

  // Clamp start/duration to actual video
  const maxStart = Math.max(0, originalDuration - 0.5)
  const start = Math.min(startSeconds, maxStart)
  const maxLen = Math.min(STATUS_VIDEO_MAX_SECONDS, originalDuration - start)
  const clipLen = Math.min(durationSeconds, maxLen)

  // No trim needed: full video already within preferred length from start 0
  const needsTrim =
    start > 0.2
    || originalDuration > clipLen + 0.35
    || Math.abs(clipLen - originalDuration) > 0.35

  if (!needsTrim) {
    onProgress(100)
    return {
      file,
      trimmed: false,
      originalDuration,
      startSeconds: 0,
      durationSeconds: originalDuration,
    }
  }

  if (typeof MediaRecorder === 'undefined') {
    onProgress(100)
    return {
      file,
      trimmed: false,
      originalDuration,
      startSeconds: start,
      durationSeconds: clipLen,
      note: 'trim-unsupported',
    }
  }

  const mimeType = pickRecorderMime()
  if (!mimeType) {
    onProgress(100)
    return {
      file,
      trimmed: false,
      originalDuration,
      startSeconds: start,
      durationSeconds: clipLen,
      note: 'trim-unsupported',
    }
  }

  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = objectUrl
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'

  try {
    await new Promise((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('Video load failed'))
      setTimeout(() => resolve(), 8000)
    })

    // Seek to user start
    await new Promise((resolve) => {
      const done = () => resolve()
      video.onseeked = done
      video.currentTime = start
      setTimeout(done, 1500)
    })

    const stream =
      typeof video.captureStream === 'function'
        ? video.captureStream()
        : typeof video.mozCaptureStream === 'function'
          ? video.mozCaptureStream()
          : null

    if (!stream) {
      URL.revokeObjectURL(objectUrl)
      onProgress(100)
      return {
        file,
        trimmed: false,
        originalDuration,
        startSeconds: start,
        durationSeconds: clipLen,
        note: 'trim-unsupported',
      }
    }

    const chunks = []
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITRATE,
    })

    const result = await new Promise((resolve, reject) => {
      let stopped = false
      const finish = () => {
        if (stopped) return
        stopped = true
        try {
          if (recorder.state !== 'inactive') recorder.stop()
        } catch { /* ignore */ }
        video.pause()
        stream.getTracks().forEach((t) => t.stop())
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data)
      }
      recorder.onerror = () => {
        finish()
        reject(new Error('Recording failed while trimming'))
      }
      recorder.onstop = () => {
        const blobType = mimeType.split(';')[0] || 'video/webm'
        const blob = new Blob(chunks, { type: blobType })
        if (!blob.size) {
          reject(new Error('Trim produced empty video'))
          return
        }
        const base = (file.name || 'status-video').replace(/\.[^.]+$/, '')
        const ext = blobType.includes('mp4') ? 'mp4' : 'webm'
        const out = new File([blob], `${base}-trim.${ext}`, {
          type: blobType,
          lastModified: Date.now(),
        })
        resolve(out)
      }

      const startedAt = Date.now()
      const progressTimer = setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000
        const pct = Math.min(96, 8 + (elapsed / clipLen) * 88)
        onProgress(pct)
      }, 120)

      const stopTimer = setTimeout(() => {
        clearInterval(progressTimer)
        onProgress(98)
        finish()
      }, Math.round(clipLen * 1000))

      video.onended = () => {
        clearTimeout(stopTimer)
        clearInterval(progressTimer)
        onProgress(98)
        finish()
      }

      video
        .play()
        .then(() => {
          try {
            recorder.start(200)
          } catch (err) {
            clearTimeout(stopTimer)
            clearInterval(progressTimer)
            finish()
            reject(err)
          }
        })
        .catch((err) => {
          clearTimeout(stopTimer)
          clearInterval(progressTimer)
          finish()
          reject(err)
        })
    })

    URL.revokeObjectURL(objectUrl)
    onProgress(100)
    return {
      file: result,
      trimmed: true,
      originalDuration,
      startSeconds: start,
      durationSeconds: clipLen,
    }
  } catch (err) {
    URL.revokeObjectURL(objectUrl)
    console.warn('Status video trim failed, using original:', err)
    onProgress(100)
    return {
      file,
      trimmed: false,
      originalDuration,
      startSeconds: start,
      durationSeconds: clipLen,
      note: 'trim-failed',
    }
  }
}

export function formatDurationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}
