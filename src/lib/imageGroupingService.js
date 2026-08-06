/**
 * ImageGroupingService
 *
 * Groups consecutive image messages from the same sender sent within
 * a configurable time window (default 60 s) into a single _isGroup bubble.
 *
 * Rules:
 *  - Only consecutive images are grouped (a text message breaks the group)
 *  - Max group size: 9 (groups larger than 9 are split automatically)
 *  - Groups are sender-scoped (never mix messages from different users)
 *
 * Public API used by Chat.jsx:
 *  - imageGroupingService.groupMessages(messages)  → full rebuild from raw rows
 *  - imageGroupingService.appendMessage(grouped, msg) → O(1) incremental append
 *
 * Do not add UI logic here. This module is pure data transformation.
 */
const DEFAULT_OPTIONS = {
  maxGroupSize: 9,
  windowMs: 60000,
}

function isImageMessage(msg) {
  return !!(msg && msg.media_type === 'image' && msg.media_url)
}

function toTime(msg) {
  const t = new Date(msg?.created_at).getTime()
  return Number.isNaN(t) ? Infinity : t
}

function toSorted(messages) {
  return [...messages].sort((a, b) => toTime(a) - toTime(b))
}

function dedupe(messages) {
  const seen = new Set()
  const out = []
  for (const m of messages) {
    if (!m || m.id == null) continue
    const key = String(m.id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(m)
  }
  return out
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

export class ImageGroupingService {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  withOptions(options = {}) {
    return new ImageGroupingService({ ...this.options, ...options })
  }

  resolveOptions(options = {}) {
    const merged = { ...this.options, ...options }
    return {
      maxGroupSize: Math.max(1, merged.maxGroupSize || DEFAULT_OPTIONS.maxGroupSize),
      windowMs: Math.max(0, merged.windowMs ?? DEFAULT_OPTIONS.windowMs),
    }
  }

  canJoinGroup(group, candidate, options) {
    if (!candidate || !isImageMessage(candidate)) return false
    const anchor = group[0]
    if (candidate.from_user !== anchor.from_user) return false
    const gap = toTime(candidate) - toTime(group[group.length - 1])
    if (gap !== gap || gap < 0 || gap > options.windowMs) return false
    return group.length < options.maxGroupSize
  }

  groupMessages(messages) {
    const options = this.resolveOptions()
    const sorted = dedupe(toSorted(messages || []))
    const result = []
    let i = 0
    while (i < sorted.length) {
      const msg = sorted[i]
      if (!isImageMessage(msg)) {
        result.push(this.asBubble(msg))
        i++
        continue
      }
      const group = [msg]
      let j = i + 1
      while (j < sorted.length && this.canJoinGroup(group, sorted[j], options)) {
        group.push(sorted[j])
        j++
      }
      for (const slice of chunk(group, options.maxGroupSize)) {
        result.push(this.asGroup(slice))
      }
      i = j
    }
    return result
  }

  appendMessage(groupedMessages, message) {
    if (!message) return groupedMessages
    const options = this.resolveOptions()
    if (isImageMessage(message)) {
      const last = groupedMessages[groupedMessages.length - 1]
      let group = null
      if (last) {
        if (last._isGroup) group = last._imageGroup
        else if (isImageMessage(last)) group = [last]
      }
      if (group && this.canJoinGroup(group, message, options)) {
        const merged = [...group, message]
        const chunks = merged.length > options.maxGroupSize
          ? chunk(merged, options.maxGroupSize)
          : [merged]
        return [...groupedMessages.slice(0, -1), ...chunks.map(g => this.asGroup(g))]
      }
    }
    return [...groupedMessages, this.asBubble(message)]
  }

  asGroup(group) {
    if (group.length === 1) return this.asBubble(group[0])
    return { ...group[0], _imageGroup: group, _isGroup: true }
  }

  asBubble(msg) {
    return { ...msg, _imageGroup: undefined, _isGroup: false }
  }
}

export function createImageGroupingService(options = {}) {
  return new ImageGroupingService(options)
}

export const defaultService = createImageGroupingService()

export default defaultService