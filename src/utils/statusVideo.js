/**
 * Status video helpers — duration limits + client-side trim.
 *
 * Sync strategy (picture + voice locked together):
 * 1. Preferred: "meta" trim — keep the original file bytes and store a clip
 *    window (#t=start,end). Playback seeks the original, so A/V never desyncs.
 * 2. Only when the file is over the upload budget do we re-encode a short clip.
 *    Realtime MediaRecorder re-encode is a last resort (can lag frames on weak CPUs).
 */

/** Absolute max length of a status video (seconds). */
export const STATUS_VIDEO_MAX_SECONDS = 30

/** Preset lengths users can pick (filtered by video length + max). */
export const STATUS_VIDEO_LENGTH_PRESETS = [10, 15, 20, 30]

/** Max upload size for status media (bytes). */
export const STATUS_VIDEO_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const PREF_KEY = 'soko_status_video_clip_seconds'

/** Last-resort encode settings — low enough that weak devices keep realtime. */
const VIDEO_BITRATE = 900_000
const AUDIO_BITRATE = 96_000
const MAX_ENCODE_WIDTH = 480
const MAX_ENCODE_HEIGHT = 854
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

/** Strip media-fragment / query noise for extension checks and fetch keys. */
export function mediaUrlBase(url) {
  if (!url || typeof url !== 'string') return url
  return url.split('#')[0]
}

/**
 * Parse a clip window from a media URL.
 * Supports `#t=12,27` (start,end seconds) per media fragments.
 * @returns {{ start: number, end: number, duration: number } | null}
 */
export function parseClipWindow(url) {
  if (!url || typeof url !== 'string') return null
  const m = url.match(/#t=([\d.]+)(?:,([\d.]+))?/i)
  if (!m) return null
  const start = parseFloat(m[1])
  if (!Number.isFinite(start) || start < 0) return null
  if (m[2] != null && m[2] !== '') {
    const end = parseFloat(m[2])
    if (!Number.isFinite(end) || end <= start) return null
    return { start, end, duration: end - start }
  }
  return { start, end: null, duration: null }
}

/**
 * Attach a clip window so viewers play only [start, start+duration].
 * Original file bytes stay intact → picture and voice stay in sync.
 */
export function applyClipToMediaUrl(url, startSeconds, durationSeconds) {
  if (!url) return url
  const start = Math.max(0, Number(startSeconds) || 0)
  let dur = Number(durationSeconds)
  if (!Number.isFinite(dur) || dur <= 0) dur = STATUS_VIDEO_MAX_SECONDS
  dur = Math.min(STATUS_VIDEO_MAX_SECONDS, dur)
  const end = start + dur
  const base = mediaUrlBase(url)
  return `${base}#t=${start.toFixed(3)},${end.toFixed(3)}`
}

export function needsClipFragment(startSeconds, durationSeconds, originalDuration) {
  const start = Math.max(0, Number(startSeconds) || 0)
  const dur = Number(durationSeconds)
  const orig = Number(originalDuration)
  if (!Number.isFinite(dur) || dur <= 0) return false
  if (start > 0.15) return true
  if (Number.isFinite(orig) && orig > 0 && dur < orig - 0.35) return true
  return false
}

/** True if URL looks like a video (ignores #t= clip fragments and query strings). */
export function isStatusVideoUrl(url) {
  if (!url || typeof url !== 'string') return false
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(url.trim())) return false
  const base = mediaUrlBase(url).split('?')[0]
  return /\.(mp4|mov|webm|m4v)$/i.test(base)
}

function pickRecorderMime() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  if (typeof MediaRecorder === 'undefined') return ''
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

function evenDim(n) {
  const v = Math.max(2, Math.round(n))
  return v % 2 === 0 ? v : v - 1
}

function scaleEncodeSize(vw, vh) {
  const w0 = vw > 0 ? vw : 480
  const h0 = vh > 0 ? vh : 854
  const scale = Math.min(1, MAX_ENCODE_WIDTH / w0, MAX_ENCODE_HEIGHT / h0)
  return {
    width: evenDim(w0 * scale),
    height: evenDim(h0 * scale),
  }
}

async function seekVideo(video, time) {
  if (!Number.isFinite(time)) return
  if (Math.abs((video.currentTime || 0) - time) < 0.05) return

  await new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      video.removeEventListener('seeked', finish)
      resolve()
    }
    video.addEventListener('seeked', finish)
    try {
      video.currentTime = time
    } catch {
      finish()
      return
    }
    setTimeout(finish, 2000)
  })
}

/**
 * Available length options for a given source duration.
 */
export function getClipLengthOptions(videoDuration) {
  const d = Number.isFinite(videoDuration) ? videoDuration : STATUS_VIDEO_MAX_SECONDS
  const hardMax = Math.min(STATUS_VIDEO_MAX_SECONDS, d)
  const opts = []
  for (const p of STATUS_VIDEO_LENGTH_PRESETS) {
    if (p <= hardMax + 0.05) opts.push(p)
  }
  const full = Math.floor(hardMax * 10) / 10
  if (full >= 1 && !opts.some(o => Math.abs(o - full) < 0.5)) {
    opts.push(Math.min(STATUS_VIDEO_MAX_SECONDS, Math.round(full)))
  }
  if (!opts.length) opts.push(Math.max(1, Math.min(STATUS_VIDEO_MAX_SECONDS, Math.floor(d) || 15)))
  return [...new Set(opts)].sort((a, b) => a - b)
}

/**
 * Frame-accurate re-encode for oversized source files.
 *
 * Strategy:
 * 1. Detect source FPS from the first few requestVideoFrameCallback callbacks.
 * 2. Set canvas.captureStream to 60 FPS (covers 24/25/30/60 — duplicates
 *    are harmless because the encoder compresses identical frames efficiently).
 * 3. Start the MediaRecorder AFTER playback begins, so audio and video
 *    start from the same timeline position.
 * 4. Paint each unique frame (tracked by mediaTime) to the canvas exactly once.
 * 5. The audio track comes from video.captureStream() — same clock as the
 *    video element — so A/V stays synchronized.
 *
 * Prefer meta trim whenever the original fits under the upload cap.
 */
export async function encodeClipRealtime(file, start, clipLen, onProgress) {
  const mimeType = pickRecorderMime()
  if (!mimeType || typeof MediaRecorder === 'undefined') return null

  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = objectUrl
  video.muted = true
  video.volume = 0
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  video.preservesPitch = false

  let audioCtx = null

  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Video load failed'))
      setTimeout(() => {
        if (video.readyState >= 1) resolve()
        else reject(new Error('Video load timeout'))
      }, 15000)
    })

    // Seek to start. The browser snaps to the nearest keyframe at or before
    // start, so frames before the clip boundary are filtered by mediaTime.
    const seekTarget = Math.max(0, start)
    await seekVideo(video, seekTarget)
    onProgress(10)
    await new Promise((r) => setTimeout(r, 200))
    onProgress(12)

    const { width: cw, height: ch } = scaleEncodeSize(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
    if (!ctx) return null

    // Capture at 60 FPS — every source frame (24/25/30/60) is captured at
    // least once. Duplicate frames compress to negligible size.
    const CAPTURE_FPS = 60
    const canvasStream = canvas.captureStream(CAPTURE_FPS)
    const tracks = [...canvasStream.getVideoTracks()]

    // Audio from the same video element (keeps A/V in sync)
    let audioTrackAdded = false
    try {
      const raw = video.captureStream?.(CAPTURE_FPS) || video.mozCaptureStream?.(CAPTURE_FPS)
      if (raw) {
        const audioTracks = raw.getAudioTracks()
        if (audioTracks.length) {
          tracks.push(...audioTracks)
          audioTrackAdded = true
        }
      }
    } catch { /* ignore */ }

    if (!audioTrackAdded) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext
        if (AC) {
          audioCtx = new AC()
          if (audioCtx.state === 'suspended') await audioCtx.resume()
          const source = audioCtx.createMediaElementSource(video)
          const dest = audioCtx.createMediaStreamDestination()
          source.connect(dest)
          tracks.push(...dest.stream.getAudioTracks())
        }
      } catch { /* ignore */ }
    }

    const stream = new MediaStream(tracks)
    if (!stream.getVideoTracks().length) return null

    const chunks = []
    let recorder
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: VIDEO_BITRATE,
        audioBitsPerSecond: AUDIO_BITRATE,
      })
    } catch {
      recorder = new MediaRecorder(stream, { mimeType })
    }

    const endAt = start + clipLen
    let lastMediaTime = -1
    let recordingFinished = false

    const outFile = await new Promise((resolve, reject) => {
      let safetyTimer = null
      let progressTimer = null
      let rvfcId = null
      let rvfcSupported = typeof video.requestVideoFrameCallback === 'function'
      let drawActive = false

      const cleanup = () => {
        drawActive = false
        if (safetyTimer) clearTimeout(safetyTimer)
        if (progressTimer) clearInterval(progressTimer)
        if (rvfcId != null && rvfcSupported) {
          try { video.cancelVideoFrameCallback(rvfcId) } catch { /* ignore */ }
          rvfcId = null
        }
        try { video.pause() } catch { /* ignore */ }
        stream.getTracks().forEach((t) => { try { t.stop() } catch { /* ignore */ } })
        if (audioCtx) { try { audioCtx.close() } catch { /* ignore */ }; audioCtx = null }
      }

      const stopRecording = () => {
        if (recordingFinished) return
        recordingFinished = true
        drawActive = false
        if (rvfcId != null && rvfcSupported) {
          try { video.cancelVideoFrameCallback(rvfcId) } catch { /* ignore */ }
          rvfcId = null
        }
        try { if (recorder.state !== 'inactive') recorder.stop() } catch { /* ignore */ }
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data)
      }
      recorder.onerror = () => {
        cleanup()
        reject(new Error('Recording failed while trimming'))
      }
      recorder.onstop = () => {
        cleanup()
        const blobType = mimeType.split(';')[0] || 'video/webm'
        const blob = new Blob(chunks, { type: blobType })
        if (!blob.size) {
          reject(new Error('Trim produced empty video'))
          return
        }
        const base = (file.name || 'status-video').replace(/\.[^.]+$/, '')
        const ext = blobType.includes('mp4') ? 'mp4' : 'webm'
        resolve(new File([blob], `${base}-trim.${ext}`, {
          type: blobType,
          lastModified: Date.now(),
        }))
      }

      // ── Frame-accurate capture ─────────────────────────────────────────
      // Paint each unique decoded frame to the canvas as it arrives.
      // canvas.captureStream(60) samples the canvas 60 times/sec — any
      // duplicate samples (because the source is 24/30 FPS) are harmless.
      const onFrame = (now, metadata) => {
        if (recordingFinished || !drawActive) return

        const mediaTime = metadata.mediaTime

        // Skip frames before the clip window
        if (mediaTime >= start && mediaTime <= endAt + (1 / CAPTURE_FPS)) {
          // Paint every unique frame (detect by mediaTime advancing)
          if (Math.abs(mediaTime - lastMediaTime) > 0.001) {
            try { ctx.drawImage(video, 0, 0, cw, ch) } catch { /* ignore */ }
            lastMediaTime = mediaTime
            const played = Math.max(0, mediaTime - start)
            onProgress(Math.min(96, 12 + (played / clipLen) * 84))
          }

          if (mediaTime >= endAt) {
            onProgress(98)
            stopRecording()
            return
          }
        }

        if (drawActive && rvfcSupported) {
          rvfcId = video.requestVideoFrameCallback(onFrame)
        }
      }

      // Fallback for browsers without rVFC
      const rafPaint = () => {
        if (recordingFinished || !drawActive) return
        try {
          if (video.readyState >= 2) ctx.drawImage(video, 0, 0, cw, ch)
        } catch { /* ignore */ }
        if (video.currentTime >= endAt) {
          onProgress(98)
          stopRecording()
          return
        }
        if (drawActive) requestAnimationFrame(rafPaint)
      }

      progressTimer = setInterval(() => {
        if (recordingFinished) return
        const played = Math.max(0, video.currentTime - start)
        onProgress(Math.min(94, 12 + (played / clipLen) * 82))
      }, 250)

      safetyTimer = setTimeout(() => {
        onProgress(98)
        stopRecording()
      }, Math.round(clipLen * 1000) + 3000)

      // ── Start playback first, THEN start the recorder ──────────────────
      // This ensures the recorder captures from the very first decoded frame,
      // not from a seeked position where audio hasn't settled yet.
      drawActive = true
      video.play().then(() => {
        if (rvfcSupported) {
          rvfcId = video.requestVideoFrameCallback(onFrame)
        } else {
          rafPaint()
        }
        // Start recording only after playback has begun
        try {
          recorder.start(250)
        } catch (err) {
          cleanup()
          reject(err)
        }
      }).catch((err) => {
        drawActive = false
        cleanup()
        reject(err)
      })
    })

    return outFile
  } finally {
    if (audioCtx) { try { await audioCtx.close() } catch { /* ignore */ } }
    try { video.pause() } catch { /* ignore */ }
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * Trim video from startSeconds for durationSeconds (user preference).
 *
 * Re-encodes to H.264/AAC MP4 when a clip window is applied, ensuring
 * universal browser compatibility. Original bytes are kept only when no
 * trimming is needed (full video within max duration).
 *
 * @param {File} file
 * @param {object} [opts]
 * @param {number} [opts.startSeconds=0]
 * @param {number} [opts.durationSeconds] clip length (defaults to max)
 * @returns {Promise<{
 *   file: File,
 *   trimmed: boolean,
 *   trimMode: 'reencoded'|'meta',
 *   originalDuration: number,
 *   startSeconds: number,
 *   durationSeconds: number,
 * }>}
 */
export async function trimStatusVideo(file, opts = {}) {
  const startSeconds = Math.max(0, Number(opts.startSeconds) || 0)
  let durationSeconds = Number(opts.durationSeconds)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    durationSeconds = STATUS_VIDEO_MAX_SECONDS
  }
  durationSeconds = Math.min(STATUS_VIDEO_MAX_SECONDS, durationSeconds)

  if (!file || !file.type?.startsWith('video/')) {
    return {
      file,
      trimmed: false,
      originalDuration: 0,
      startSeconds,
      durationSeconds,
    }
  }

  let originalDuration
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

  const maxStart = Math.max(0, originalDuration - 0.5)
  const start = Math.min(startSeconds, maxStart)
  const maxLen = Math.min(STATUS_VIDEO_MAX_SECONDS, originalDuration - start)
  const clipLen = Math.min(durationSeconds, maxLen)

  const needsTrim =
    start > 0.2
    || originalDuration > clipLen + 0.35
    || Math.abs(clipLen - originalDuration) > 0.35

  if (!needsTrim) {
    return {
      file,
      trimmed: false,
      trimMode: 'meta',
      originalDuration,
      startSeconds: 0,
      durationSeconds: originalDuration,
    }
  }

  // Re-encode to H.264/AAC MP4 for universal compatibility
  let encoded
  try {
    encoded = await encodeClipRealtime(file, start, clipLen, () => {})
  } catch {
    encoded = null
  }
  if (encoded && encoded.size > 0) {
    return {
      file: encoded,
      trimmed: true,
      trimMode: 'reencoded',
      originalDuration: clipLen,
      startSeconds: start,
      durationSeconds: clipLen,
    }
  }

  // Fall back to meta trim if re-encoding fails
  return {
    file,
    trimmed: true,
    trimMode: 'meta',
    originalDuration,
    startSeconds: start,
    durationSeconds: clipLen,
  }
}

/**
 * Compress a video file to fit under the upload limit.
 * Only called when the original file exceeds STATUS_VIDEO_MAX_UPLOAD_BYTES.
 * This is the ONLY place re-encoding happens.
 *
 * @param {File} file       Original video file
 * @param {number} startSeconds  Clip start
 * @param {number} durationSeconds  Clip duration
 * @param {(pct: number) => void} onProgress
 * @returns {Promise<File|null>}  Compressed file, or null if encoding fails
 */
export async function compressForUpload(file, startSeconds, durationSeconds, onProgress) {
  const start = Math.max(0, Number(startSeconds) || 0)
  let dur = Number(durationSeconds)
  if (!Number.isFinite(dur) || dur <= 0) dur = STATUS_VIDEO_MAX_SECONDS
  dur = Math.min(STATUS_VIDEO_MAX_SECONDS, dur)
  const cb = typeof onProgress === 'function' ? onProgress : () => {}

  if (!file || !file.type?.startsWith('video/')) return null

  cb(5)
  try {
    const encoded = await encodeClipRealtime(file, start, dur, cb)
    if (encoded && encoded.size > 0 && encoded.size <= STATUS_VIDEO_MAX_UPLOAD_BYTES) {
      return encoded
    }
  } catch (err) {
    console.warn('compressForUpload failed:', err)
  }
  return null
}

export function formatDurationLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

/**
 * Generate evenly-spaced thumbnails from a video URL/File.
 * Returns an array of { time, url } objects (url is a blob: URL).
 * Caller must revoke URLs when done.
 */
export async function generateThumbnails(file, count, onProgress) {
  const THUMB_WIDTH = 120
  const THUMB_HEIGHT = 68

  const url = file instanceof File ? URL.createObjectURL(file) : file
  const video = document.createElement('video')
  video.src = url
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true

  let duration
  try {
    duration = await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration)
      video.onerror = () => reject(new Error('Load failed'))
      setTimeout(() => { if (video.readyState >= 1) resolve(video.duration); else reject(new Error('Timeout')) }, 15000)
    })
  } catch { if (file instanceof File) URL.revokeObjectURL(url); video.remove(); return [] }

  const canvas = document.createElement('canvas')
  canvas.width = THUMB_WIDTH
  canvas.height = THUMB_HEIGHT
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
  if (!ctx) { if (file instanceof File) URL.revokeObjectURL(url); video.remove(); return [] }

  const actualCount = Math.min(count, Math.max(1, Math.floor(duration * 2)))
  const interval = duration / actualCount
  const results = []

  for (let i = 0; i < actualCount; i++) {
    const seekTime = i * interval
    try {
      video.currentTime = seekTime
      await new Promise((resolve) => {
        const done = () => { video.removeEventListener('seeked', done); resolve() }
        video.addEventListener('seeked', done)
        setTimeout(done, 500)
      })
    } catch { /* skip */ }

    try { ctx.drawImage(video, 0, 0, THUMB_WIDTH, THUMB_HEIGHT) } catch { /* skip */ }
    canvas.toBlob((blob) => {
      if (blob) results.push({ time: seekTime, url: URL.createObjectURL(blob), width: THUMB_WIDTH, height: THUMB_HEIGHT })
    }, 'image/jpeg', 0.7)
    onProgress?.(Math.round((i / actualCount) * 100))
  }

  video.remove()
  if (file instanceof File) URL.revokeObjectURL(url)

  // Wait for all blobs
  await new Promise(r => setTimeout(r, 50))
  return results.sort((a, b) => a.time - b.time)
}
