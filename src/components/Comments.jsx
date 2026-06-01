import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

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

export default function Comments({ listingId, currentUser }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState(null) // { id, name }
  const [expandedReplies, setExpandedReplies] = useState({})

  useEffect(() => { loadComments() }, [listingId])

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
  }

  async function deleteComment(id) {
    await supabase.from('comments').delete().eq('id', id)
    setComments(c => c.filter(x => x.id !== id))
  }

  // Build tree structure
  const topLevel = comments.filter(c => !c.parent_id)
  const getReplies = (parentId) => comments.filter(c => c.parent_id === parentId)

  function toggleReplies(id) {
    setExpandedReplies(e => ({ ...e, [id]: !e[id] }))
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
        Comments ({comments.length})
      </div>

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
          currentUser={currentUser}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          expandedReplies={expandedReplies}
          toggleReplies={toggleReplies}
          onDelete={deleteComment}
          onNewComment={(c) => setComments(prev => [...prev, c])}
          listingId={listingId}
          depth={0}
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

function CommentThread({ comment, replies, allComments, currentUser, replyingTo, setReplyingTo,
  expandedReplies, toggleReplies, onDelete, onNewComment, listingId, depth }) {

  const hasReplies = replies.length > 0
  const isExpanded = expandedReplies[comment.id]
  const isReplying = replyingTo?.id === comment.id
  const isOwn = currentUser?.id === comment.user_id
  const name = comment.profiles?.full_name || 'Anonymous'
  const avatar = comment.profiles?.avatar_url

  return (
    <div style={{ marginLeft: depth > 0 ? 32 : 0, marginBottom: 2 }}>
      {/* Comment bubble */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', border: '1px solid #edf2ee', marginBottom: 6 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a7a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
            {avatar
              ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : name[0].toUpperCase()
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1410' }}>{name}</div>
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
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            onClick={() => setReplyingTo(isReplying ? null : { id: comment.id, name })}
            style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: isReplying ? '#1a7a4a' : '#9ca3af', cursor: 'pointer', padding: 0 }}
          >
            {isReplying ? '✕ Cancel' : '↩ Reply'}
          </button>
          {hasReplies && (
            <button
              onClick={() => toggleReplies(comment.id)}
              style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: '#1a7a4a', cursor: 'pointer', padding: 0 }}
            >
              {isExpanded ? `▲ Hide ${replies.length} repl${replies.length !== 1 ? 'ies' : 'y'}` : `▼ ${replies.length} repl${replies.length !== 1 ? 'ies' : 'y'}`}
            </button>
          )}
        </div>
      </div>

      {/* Reply box */}
      {isReplying && (
        <div style={{ marginLeft: 32, marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: '#1a7a4a', fontWeight: 600, marginBottom: 4 }}>
            Replying to {replyingTo.name}
          </div>
          <CommentBox
            listingId={listingId}
            parentId={comment.id}
            currentUser={currentUser}
            onSubmit={(c) => { onNewComment(c); setReplyingTo(null); toggleReplies(comment.id) }}
            placeholder={`Reply to ${replyingTo.name}…`}
            autoFocus
          />
        </div>
      )}

      {/* Nested replies */}
      {hasReplies && isExpanded && (
        <div style={{ borderLeft: '2px solid #e6f4ec', marginLeft: 16, paddingLeft: 4 }}>
          {replies.map(reply => (
            <CommentThread
              key={reply.id}
              comment={reply}
              replies={allComments.filter(c => c.parent_id === reply.id)}
              allComments={allComments}
              currentUser={currentUser}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              expandedReplies={expandedReplies}
              toggleReplies={toggleReplies}
              onDelete={onDelete}
              onNewComment={onNewComment}
              listingId={listingId}
              depth={depth + 1}
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
  const { error } = await supabase.storage.from('comments').upload(path, file)
  if (error) throw error
  return supabase.storage.from('comments').getPublicUrl(path).data.publicUrl
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
      onSubmit(data)
      setText('')
      setImages([])
      setVideos([])
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