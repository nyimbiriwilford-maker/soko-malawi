import { useState, useRef } from 'react'
import { isStatusVideoUrl } from '../utils/statusVideo'
import { buildCommentTree } from '../hooks/useStatusComments'

const GREEN = '#1a7a4a'

function timeAgo(date) {
  const diff = Date.now() - new Date(date)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function isMobileShareDevice() {
  return /Android|iPhone|iPad|iPod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')
}

function IconReplyArrow({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 17H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11" />
      <path d="M15 3l5 5-5 5" />
    </svg>
  )
}

function IconHeartSm({ size = 13, filled }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#ea4335' : 'none'} stroke={filled ? '#ea4335' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  )
}

/**
 * Threaded comment list + composer. Drop this inside the StoryViewer comments
 * sheet or the StatusPage feed drawer — it renders the full thread UI.
 * `api` is the object returned by useStatusComments.
 */
export default function StatusCommentsPanel({ api, story, currentUserId, onOpenChat }) {
  const [replyingTo, setReplyingTo] = useState(null)
  const [expanded, setExpanded] = useState({})

  const { topLevel, childrenOf, nameById } = buildCommentTree(api.comments)

  function toggleThread(id) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  if (api.loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>Loading comments…</div>
  }

  if (api.comments.length === 0) {
    return (
      <div style={{ padding: '28px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#64748b' }}>No comments yet</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 600 }}>Be the first to comment below</div>
      </div>
    )
  }

  return (
    <div>
      {topLevel.map(c => (
        <CommentNode
          key={c.id}
          comment={c}
          depth={0}
          api={api}
          story={story}
          currentUserId={currentUserId}
          onOpenChat={onOpenChat}
          childrenOf={childrenOf}
          nameById={nameById}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          expanded={expanded}
          toggleThread={toggleThread}
        />
      ))}

      {!replyingTo && (
        <CommentComposer
          api={api}
          parentId={null}
          placeholder="Write a comment…"
        />
      )}
    </div>
  )
}

function CommentNode({ comment, depth, api, story, currentUserId, onOpenChat, childrenOf, nameById, replyingTo, setReplyingTo, expanded, toggleThread }) {
  const replies = childrenOf(comment.id)
  const isExpanded = !!expanded[comment.id]
  const isReplying = replyingTo?.id === comment.id
  const isOwn = currentUserId === comment.user_id
  const name = comment.author?.full_name || 'Anonymous'
  const avatar = comment.author?.avatar_url
  const repliedToName = comment.parent_id ? (nameById[comment.parent_id] || 'someone') : null
  const media = Array.isArray(comment.media_urls) ? comment.media_urls : []

  const statusId = story?.id
  const [copied, setCopied] = useState(false)

  async function shareComment() {
    const url = `${window.location.origin}/status/${statusId}?comment=${comment.id}`
    if (isMobileShareDevice() && typeof navigator.share === 'function') {
      try { await navigator.share({ url, title: 'Comment on Soko Malawi' }) } catch { /* cancelled */ }
      return
    }
    try { await navigator.clipboard.writeText(url) } catch {
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div style={{ marginLeft: depth > 0 ? 18 : 0, marginBottom: 2 }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: '11px 13px',
        border: '1px solid #edf2ee', marginBottom: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: GREEN,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0, overflow: 'hidden',
          }}>
            {avatar
              ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (name[0] || 'A').toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f1410' }}>{name}</span>
              {repliedToName && (
                <span title={`Replied to ${repliedToName}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 10.5, fontWeight: 700, color: GREEN,
                  background: 'rgba(26,122,74,0.08)', borderRadius: 999, padding: '1px 8px 1px 6px',
                }}>
                  <IconReplyArrow size={10} /> {repliedToName}
                </span>
              )}
              {comment._legacy && (
                <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', background: '#f3f4f6', borderRadius: 999, padding: '1px 7px' }}>reply</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(comment.created_at)}</div>
          </div>
          {isOwn && !comment._legacy && (
            <button onClick={() => api.deleteComment(comment)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, cursor: 'pointer', padding: '2px 6px' }}>
              Delete
            </button>
          )}
        </div>

        {comment.body && (
          <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.5, marginBottom: media.length ? 8 : 0, wordBreak: 'break-word' }}>
            {comment.body}
          </div>
        )}

        {media.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {media.map((m, i) => m.kind === 'video' || isStatusVideoUrl(m.url)
              ? <video key={i} src={m.url} controls playsInline style={{ width: 150, height: 96, borderRadius: 8, objectFit: 'cover' }} />
              : <img key={i} src={m.url} alt="" onClick={() => window.open(m.url, '_blank')} style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }} />
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {!comment._legacy && (
            <button
              onClick={() => api.toggleLike(comment)}
              style={{
                background: 'none', border: 'none', fontSize: 12, fontWeight: 700,
                color: comment.myLike ? '#ea4335' : '#9ca3af', cursor: 'pointer', padding: 0,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <IconHeartSm size={12} filled={comment.myLike} />
              {comment.likeCount > 0 ? comment.likeCount : 'Like'}
            </button>
          )}
          <button
            onClick={() => setReplyingTo(isReplying ? null : { id: comment.id, name })}
            style={{
              background: 'none', border: 'none', fontSize: 12, fontWeight: 600,
              color: isReplying ? GREEN : '#9ca3af', cursor: 'pointer', padding: 0,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <IconReplyArrow size={11} />
            {isReplying ? 'Cancel' : 'Reply'}
          </button>
          <button
            onClick={shareComment}
            style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: '#9ca3af', cursor: 'pointer', padding: 0 }}
          >
            {copied ? 'Link copied' : 'Share'}
          </button>
          {onOpenChat && comment.user_id && comment.user_id !== currentUserId && (
            <button
              onClick={() => onOpenChat(comment.user_id)}
              style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 800, color: GREEN, cursor: 'pointer', padding: 0 }}
            >
              Open chat →
            </button>
          )}
          {replies.length > 0 && (
            <button
              onClick={() => toggleThread(comment.id)}
              style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 700, color: GREEN, cursor: 'pointer', padding: 0 }}
            >
              {isExpanded ? `▲ Hide ${replies.length}` : `▼ ${replies.length} repl${replies.length !== 1 ? 'ies' : 'y'}`}
            </button>
          )}
        </div>
      </div>

      {isReplying && (
        <div style={{ marginLeft: depth > 0 ? 8 : 26, marginBottom: 6 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: GREEN, fontWeight: 700, marginBottom: 6,
            background: 'rgba(26,122,74,0.08)', borderRadius: 999, padding: '4px 10px',
          }}>
            <IconReplyArrow size={11} /> Replying to {replyingTo.name}
          </div>
          <CommentComposer
            api={api}
            parentId={comment.id}
            placeholder={`Reply to ${replyingTo.name}…`}
            autoFocus
            onDone={() => {
              setReplyingTo(null)
              if (!expanded[comment.id]) toggleThread(comment.id)
            }}
          />
        </div>
      )}

      {replies.length > 0 && isExpanded && (
        <div style={{ borderLeft: '2px solid #d1fae5', marginLeft: 14, paddingLeft: 8 }}>
          {replies.map(r => (
            <CommentNode
              key={r.id}
              comment={r}
              depth={depth + 1}
              api={api}
              story={story}
              currentUserId={currentUserId}
              onOpenChat={onOpenChat}
              childrenOf={childrenOf}
              nameById={nameById}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              expanded={expanded}
              toggleThread={toggleThread}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CommentComposer({ api, parentId, placeholder, autoFocus, onDone }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const imgRef = useRef()
  const vidRef = useRef()

  const canPost = (text.trim().length > 0 || files.length > 0) && !api.posting

  async function handlePost() {
    if (!canPost) return
    setError('')
    const ok = await api.postComment({ body: text, parentId, files: files.map(f => f.file) })
    if (ok) {
      setText('')
      setFiles([])
      onDone?.()
    }
  }

  function addFiles(e, kind) {
    const max = kind === 'image' ? 4 : 2
    const maxBytes = kind === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024
    const picked = Array.from(e.target.files || []).filter(f =>
      f.type.startsWith(kind === 'image' ? 'image/' : 'video/') && f.size < maxBytes
    )
    setFiles(prev => [...prev, ...picked.map(f => ({ file: f, preview: URL.createObjectURL(f), kind }))].slice(0, max + 2))
    e.target.value = ''
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e0e8e2', padding: '9px 11px', marginBottom: 10 }}>
      <textarea
        autoFocus={autoFocus}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePost() }}
        placeholder={placeholder}
        rows={2}
        maxLength={400}
        style={{
          width: '100%', border: 'none', outline: 'none', resize: 'none',
          fontSize: 13.5, color: '#374151', lineHeight: 1.5, fontFamily: 'inherit',
          background: 'transparent', boxSizing: 'border-box',
        }}
      />

      {files.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {files.map((f, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {f.kind === 'image'
                ? <img src={f.preview} alt="" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8 }} />
                : <video src={f.preview} muted style={{ width: 84, height: 54, objectFit: 'cover', borderRadius: 8 }} />}
              <button
                onClick={() => setFiles(prev => prev.filter((_, x) => x !== i))}
                style={{
                  position: 'absolute', top: -4, right: -4, width: 17, height: 17, borderRadius: '50%',
                  background: '#dc2626', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 6 }}>{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => imgRef.current?.click()} style={{ background: '#f0faf4', border: 'none', borderRadius: 8, padding: '5px 9px', fontSize: 12, color: GREEN, cursor: 'pointer', fontWeight: 600 }}>📷</button>
          <button onClick={() => vidRef.current?.click()} style={{ background: '#f0faf4', border: 'none', borderRadius: 8, padding: '5px 9px', fontSize: 12, color: GREEN, cursor: 'pointer', fontWeight: 600 }}>🎥</button>
          <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addFiles(e, 'image')} />
          <input ref={vidRef} type="file" accept="video/*" multiple style={{ display: 'none' }} onChange={e => addFiles(e, 'video')} />
        </div>
        <button
          onClick={handlePost}
          disabled={!canPost}
          style={{
            background: api.posting ? '#d1d5db' : GREEN, color: '#fff', border: 'none',
            borderRadius: 10, padding: '6px 15px', fontSize: 13, fontWeight: 700,
            cursor: canPost ? 'pointer' : 'not-allowed',
          }}
        >
          {api.posting ? '…' : 'Post'}
        </button>
      </div>
    </div>
  )
}
