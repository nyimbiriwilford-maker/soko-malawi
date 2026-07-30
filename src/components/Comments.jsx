import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { uploadToR2, getR2Url, deleteFromR2 } from '../lib/r2'

const GREEN = '#1a7a4a'

function timeAgo(date) {
  const diff = Date.now() - new Date(date)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
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

function IconCopy({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export default function Comments({ listingId, currentUser }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState(null) // { id, name }
  const [expandedReplies, setExpandedReplies] = useState({})
  const [copyToast, setCopyToast] = useState('')
  const [highlightId, setHighlightId] = useState(null)
  const itemRefs = useRef({})

  useEffect(() => { loadComments() }, [listingId])

  // Deep-link highlight: /listing/:id?comment=:id
  useEffect(() => {
    try {
      const id = new URLSearchParams(window.location.search).get('comment')
      if (id) setHighlightId(id)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!highlightId || loading) return
    const t = setTimeout(() => {
      itemRefs.current[highlightId]?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    }, 150)
    return () => clearTimeout(t)
  }, [highlightId, loading, comments])

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true })

    const list = data || []
    const userIds = [...new Set(list.map(c => c.user_id).filter(Boolean))]
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds)
      const map = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      list.forEach(c => { c.profiles = map[c.user_id] || null })
    }
    setComments(list)
    setLoading(false)
    // Auto-expand threads that contain the deep-linked comment
    try {
      const target = new URLSearchParams(window.location.search).get('comment')
      if (target) {
        const byId = Object.fromEntries(list.map(c => [c.id, c]))
        let cur = byId[target]
        const open = {}
        while (cur?.parent_id) {
          open[cur.parent_id] = true
          cur = byId[cur.parent_id]
        }
        if (Object.keys(open).length) setExpandedReplies(e => ({ ...e, ...open }))
      }
    } catch { /* ignore */ }
  }

  async function deleteComment(id) {
    await supabase.from('comments').delete().eq('id', id)
    setComments(c => c.filter(x => x.id !== id))
  }

  async function shareOrCopyComment(commentId) {
    const url = `${window.location.origin}/listing/${listingId}?comment=${commentId}`
    if (isMobileShareDevice() && typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, title: 'Comment on Soko Malawi' })
      } catch { /* cancelled */ }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopyToast('Link copied')
    setTimeout(() => setCopyToast(''), 1600)
  }

  // Build tree structure
  const topLevel = comments.filter(c => !c.parent_id)
  const getReplies = (parentId) => comments.filter(c => c.parent_id === parentId)
  const parentNameById = Object.fromEntries(
    comments.map(c => [c.id, c.profiles?.full_name || 'Anonymous'])
  )

  function toggleReplies(id) {
    setExpandedReplies(e => ({ ...e, [id]: !e[id] }))
  }

  return (
    <div style={{ marginBottom: 16, position: 'relative' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
        Comments ({comments.length})
      </div>

      {copyToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', color: '#fff', padding: '8px 16px', borderRadius: 999,
          fontSize: 13, fontWeight: 700, zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          {copyToast}
        </div>
      )}

      {loading && (
        <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: '16px 0' }}>Loading comments…</div>
      )}

      {!loading && topLevel.length === 0 && (
        <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: '16px 0', background: '#fff', borderRadius: 12, border: '1px dashed #e0e8e2' }}>
          No comments yet. Be the first to comment!
        </div>
      )}

      {topLevel.map(comment => (
        <CommentThread
          key={comment.id}
          comment={comment}
          replies={getReplies(comment.id)}
          allComments={comments}
          parentNameById={parentNameById}
          currentUser={currentUser}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          expandedReplies={expandedReplies}
          toggleReplies={toggleReplies}
          onDelete={deleteComment}
          onNewComment={(c) => setComments(prev => [...prev, c])}
          onShare={shareOrCopyComment}
          listingId={listingId}
          depth={0}
          highlightId={highlightId}
          itemRefs={itemRefs}
        />
      ))}

      {/* Main comment box */}
      {!replyingTo && (
        <CommentBox
          listingId={listingId}
          parentId={null}
          currentUser={currentUser}
          onSubmit={(c) => setComments(prev => [...prev, c])}
          placeholder="Write a comment…"
        />
      )}
    </div>
  )
}

function CommentThread({ comment, replies, allComments, parentNameById, currentUser, replyingTo, setReplyingTo,
  expandedReplies, toggleReplies, onDelete, onNewComment, onShare, listingId, depth, highlightId, itemRefs }) {

  const hasReplies = replies.length > 0
  const isExpanded = expandedReplies[comment.id]
  const isReplying = replyingTo?.id === comment.id
  const isOwn = currentUser?.id === comment.user_id
  const name = comment.profiles?.full_name || 'Anonymous'
  const avatar = comment.profiles?.avatar_url
  const isReply = depth > 0 && comment.parent_id
  const repliedToName = isReply ? (parentNameById[comment.parent_id] || 'someone') : null
  const isHighlighted = highlightId === comment.id
  const desktopCopy = !isMobileShareDevice()

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0, marginBottom: 2 }}>
      {/* Comment bubble */}
      <div
        ref={el => { if (el && itemRefs) itemRefs.current[comment.id] = el }}
        style={{
          background: isHighlighted ? 'rgba(26,122,74,0.06)' : '#fff',
          borderRadius: 14,
          padding: '12px 14px',
          border: isHighlighted ? `1.5px solid ${GREEN}` : '1px solid #edf2ee',
          marginBottom: 6,
          transition: 'background 0.2s, border 0.2s',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a7a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
            {avatar
              ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : name[0].toUpperCase()
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f1410' }}>{name}</span>
              {repliedToName && (
                <span
                  title={`Replied to ${repliedToName}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontSize: 11, fontWeight: 700, color: GREEN,
                    background: 'rgba(26,122,74,0.08)',
                    borderRadius: 999, padding: '1px 8px 1px 6px',
                  }}
                >
                  <IconReplyArrow size={10} />
                  {repliedToName}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(comment.created_at)}</div>
          </div>
          {isOwn && (
            <button onClick={() => onDelete(comment.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, cursor: 'pointer', padding: '2px 6px' }}>
              Delete
            </button>
          )}
        </div>

        {/* Content */}
        {comment.content && (
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: comment.images?.length || comment.videos?.length ? 8 : 0 }}>
            {comment.content}
          </div>
        )}

        {/* Images */}
        {comment.images?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: comment.videos?.length ? 6 : 0 }}>
            {comment.images.map((url, i) => (
              <img key={i} src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
                onClick={() => window.open(url, '_blank')} />
            ))}
          </div>
        )}

        {/* Videos */}
        {comment.videos?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {comment.videos.map((url, i) => (
              <video key={i} src={url} controls style={{ width: 160, height: 100, borderRadius: 8, objectFit: 'cover' }} />
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
            type="button"
            onClick={() => onShare?.(comment.id)}
            title={desktopCopy ? 'Copy link to this comment' : 'Share this comment'}
            style={{
              background: 'none', border: 'none', fontSize: 12, fontWeight: 600,
              color: '#9ca3af', cursor: 'pointer', padding: 0,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            {desktopCopy && <IconCopy size={11} />}
            {desktopCopy ? 'Copy link' : 'Share'}
          </button>
          {hasReplies && (
            <button
              onClick={() => toggleReplies(comment.id)}
              style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: GREEN, cursor: 'pointer', padding: 0 }}
            >
              {isExpanded ? `▲ Hide ${replies.length} repl${replies.length !== 1 ? 'ies' : 'y'}` : `▼ ${replies.length} repl${replies.length !== 1 ? 'ies' : 'y'}`}
            </button>
          )}
        </div>
      </div>

      {/* Reply box */}
      {isReplying && (
        <div style={{ marginLeft: depth > 0 ? 12 : 32, marginBottom: 6 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: GREEN, fontWeight: 700, marginBottom: 6,
            background: 'rgba(26,122,74,0.08)', borderRadius: 999, padding: '4px 10px',
          }}>
            <IconReplyArrow size={11} />
            Replying to {replyingTo.name}
          </div>
          <CommentBox
            listingId={listingId}
            parentId={comment.id}
            currentUser={currentUser}
            onSubmit={(c) => {
              onNewComment(c)
              setReplyingTo(null)
              if (!expandedReplies[comment.id]) toggleReplies(comment.id)
            }}
            placeholder={`Reply to ${replyingTo.name}…`}
            autoFocus
          />
        </div>
      )}

      {/* Nested replies with thread line */}
      {hasReplies && isExpanded && (
        <div style={{ borderLeft: '2px solid #d1fae5', marginLeft: 16, paddingLeft: 8 }}>
          {replies.map(reply => (
            <CommentThread
              key={reply.id}
              comment={reply}
              replies={allComments.filter(c => c.parent_id === reply.id)}
              allComments={allComments}
              parentNameById={parentNameById}
              currentUser={currentUser}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              expandedReplies={expandedReplies}
              toggleReplies={toggleReplies}
              onDelete={onDelete}
              onNewComment={onNewComment}
              onShare={onShare}
              listingId={listingId}
              depth={depth + 1}
              highlightId={highlightId}
              itemRefs={itemRefs}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CommentBox({ listingId, parentId, currentUser, onSubmit, placeholder, autoFocus }) {
  const [text, setText] = useState('')
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const imgRef = useRef()
  const vidRef = useRef()

  async function uploadFile(file, type) {
  const ext = file.name.split('.').pop()
  const path = `${currentUser.id}/${type}_${Date.now()}.${ext}`
  const url = await uploadToR2(file, 'comments/' + path)
  if (!url) throw new Error('Upload failed')
  return url
}

  async function handleSubmit() {
    if (!text.trim() && images.length === 0 && videos.length === 0) return
    if (!currentUser) { setError('Please sign in to comment'); return }
    setUploading(true)
    setError('')
    try {
      const imageUrls = []
      for (const img of images) {
        imageUrls.push(await uploadFile(img.file, 'img'))
      }
      const videoUrls = []
      for (const vid of videos) {
        videoUrls.push(await uploadFile(vid.file, 'vid'))
      }

      const { data, error } = await supabase.from('comments').insert({
        listing_id: listingId,
        user_id: currentUser.id,
        parent_id: parentId || null,
        content: text.trim() || null,
        images: imageUrls.length ? imageUrls : null,
        videos: videoUrls.length ? videoUrls : null,
      }).select('*').single()

      if (error) throw error
      // Attach current user's profile so reply arrows show the right name immediately
      onSubmit({
        ...data,
        profiles: data.profiles || {
          id: currentUser.id,
          full_name: currentUser.full_name || currentUser.user_metadata?.full_name || 'You',
          avatar_url: currentUser.avatar_url || currentUser.user_metadata?.avatar_url || null,
        },
      })
      setText('')
      setImages([])
      setVideos([])

      // ── Notify listing owner ──────────────────────────────
      try {
        // Get listing to find owner + title
        const { data: listing } = await supabase
          .from('listings')
          .select('seller_id, title, images')
          .eq('id', listingId)
          .single()

        // Don't notify yourself
        if (listing && listing.seller_id !== currentUser.id) {
          // Get commenter's name
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', currentUser.id)
            .single()

          const commenterName = profile?.full_name || 'Someone'
          const isReply = !!parentId

          // If replying, also notify the parent comment author
          if (isReply) {
            const { data: parentComment } = await supabase
              .from('comments')
              .select('user_id')
              .eq('id', parentId)
              .single()

            if (parentComment && parentComment.user_id !== currentUser.id) {
              await supabase.from('notifications').insert({
                user_id: parentComment.user_id,
                type: 'listing_comment',
                title: `${commenterName} replied to you`,
                body: text.trim()
                  ? `"${text.trim().slice(0, 60)}${text.length > 60 ? '…' : ''}"`
                  : '📷 Sent a photo',
                data: {
                  listing_id: listingId,
                  listing_title: listing.title,
                  listing_image: listing.images?.[0] || null,
                  sender_name: commenterName,
                  comment_id: data.id,
                },
                read: false,
              })
            }
          }

          // Always notify listing owner (if not the commenter and not the parent author)
          await supabase.from('notifications').insert({
            user_id: listing.seller_id,
            type: 'listing_comment',
            title: isReply
              ? `${commenterName} commented on your listing`
              : `${commenterName} commented on "${listing.title}"`,
            body: text.trim()
              ? `"${text.trim().slice(0, 60)}${text.length > 60 ? '…' : ''}"`
              : '📷 Sent a photo',
            data: {
              listing_id: listingId,
              listing_title: listing.title,
              listing_image: listing.images?.[0] || null,
              sender_name: commenterName,
              comment_id: data.id,
            },
            read: false,
          })
        }
      } catch (notifErr) {
        // Notification failure should never block the comment
        console.warn('Notification error:', notifErr)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  function addImages(e) {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/') && f.size < 10 * 1024 * 1024)
    setImages(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))].slice(0, 4))
  }

  function addVideos(e) {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('video/') && f.size < 50 * 1024 * 1024)
    setVideos(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))].slice(0, 2))
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e0e8e2', padding: '10px 12px', marginBottom: 10 }}>
      <textarea
        autoFocus={autoFocus}
        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 14, color: '#374151', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, background: 'transparent', boxSizing: 'border-box' }}
        placeholder={placeholder}
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit() }}
      />

      {/* Image previews */}
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={img.preview} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />
              <button onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#dc2626', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Video previews */}
      {videos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {videos.map((vid, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <video src={vid.preview} style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 8 }} muted />
              <button onClick={() => setVideos(prev => prev.filter((_, idx) => idx !== i))}
                style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#dc2626', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 6 }}>⚠️ {error}</div>}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => imgRef.current?.click()}
            style={{ background: '#f0faf4', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#1a7a4a', cursor: 'pointer', fontWeight: 600 }}>
            📷 Photo
          </button>
          <button onClick={() => vidRef.current?.click()}
            style={{ background: '#f0faf4', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#1a7a4a', cursor: 'pointer', fontWeight: 600 }}>
            🎥 Video
          </button>
          <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={addImages} />
          <input ref={vidRef} type="file" accept="video/*" multiple style={{ display: 'none' }} onChange={addVideos} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={uploading || (!text.trim() && images.length === 0 && videos.length === 0)}
          style={{ background: uploading ? '#d1d5db' : '#1a7a4a', color: '#fff', border: 'none', borderRadius: 10, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer' }}
        >
          {uploading ? '…' : 'Post'}
        </button>
      </div>
    </div>
  )
}