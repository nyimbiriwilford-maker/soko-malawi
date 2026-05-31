import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { S, timeAgo, renderStars } from './serviceData'

export default function ReviewSection({ serviceId, providerId, currentUser }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [myRating, setMyRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { loadReviews() }, [serviceId])

  async function loadReviews() {
    setLoading(true)
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false })
    setReviews(data || [])
    setLoading(false)
    if (currentUser) {
      const mine = (data || []).find(r => r.reviewer_id === currentUser.id)
      if (mine) setSubmitted(true)
    }
  }

  async function submitReview() {
    if (!myRating) { setError('Please select a star rating'); return }
    setError('')
    setSubmitting(true)
    const { error: err } = await supabase.from('reviews').insert({
      service_id: serviceId,
      provider_id: providerId,
      reviewer_id: currentUser.id,
      reviewer_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Customer',
      rating: myRating,
      comment: reviewText.trim(),
    })
    if (err) { setError(err.message); setSubmitting(false); return }

    // Update average rating
    const allRatings = [...reviews.map(r => r.rating), myRating]
    const avg = parseFloat((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1))
    await supabase.from('services').update({ rating: avg }).eq('id', serviceId)

    setSubmitting(false)
    setSubmitted(true)
    setShowForm(false)
    loadReviews()
  }

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null

  return (
    <div style={S.modalSection}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={S.modalSectionTitle}>
          Reviews {reviews.length > 0 && `(${reviews.length})`}
        </div>
        {avgRating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#d4920a', fontSize: '15px' }}>★</span>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f1410' }}>{avgRating}</span>
          </div>
        )}
      </div>

      {/* Write review — any logged-in user who hasn't yet reviewed */}
      {currentUser && !submitted && !showForm && (
        <button
          style={{ width: '100%', background: '#f4f8f5', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: '700', color: '#1a7a4a', cursor: 'pointer', marginBottom: '14px', fontFamily: 'inherit' }}
          onClick={() => setShowForm(true)}
        >
          ⭐ Write a review
        </button>
      )}

      {currentUser && !submitted && showForm && (
        <div style={S.reviewBox}>
          <div style={S.reviewTitle}>Rate this provider</div>
          <div style={S.starRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                style={S.starBtn}
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setMyRating(n)}
              >
                <span style={{ color: n <= (hoverRating || myRating) ? '#d4920a' : '#ddd' }}>★</span>
              </button>
            ))}
          </div>
          <textarea
            style={S.reviewTextarea}
            rows={2}
            placeholder="Share your experience (optional)..."
            value={reviewText}
            onChange={e => setReviewText(e.target.value)}
          />
          {error && <p style={{ color: '#c0392b', fontSize: '12px', marginTop: '6px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ flex: 1, background: '#f0f4f1', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', marginTop: '10px' }} onClick={() => setShowForm(false)}>Cancel</button>
            <button
              style={{ ...S.reviewSubmitBtn, flex: 2, opacity: submitting ? 0.7 : 1 }}
              onClick={submitReview}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : '⭐ Submit'}
            </button>
          </div>
        </div>
      )}

      {submitted && (
        <div style={{ background: '#e6f7ee', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', color: '#1a7a4a', fontWeight: '600' }}>
          ✅ Thanks for your review!
        </div>
      )}

      {!currentUser && (
        <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '12px' }}>
          Sign in to leave a review.
        </p>
      )}

      {loading && <div style={{ ...S.skeleton, height: '60px' }} />}

      {!loading && reviews.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '28px', marginBottom: '6px' }}>💬</div>
          <p style={{ fontSize: '13px', color: '#aaa' }}>No reviews yet — be the first!</p>
        </div>
      )}

      {!loading && reviews.map(r => (
        <div key={r.id} style={S.reviewCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={S.reviewerName}>{r.reviewer_name || 'Customer'}</div>
            <div style={S.reviewTime}>{timeAgo(r.created_at)}</div>
          </div>
          <div style={S.reviewStars}>{renderStars(r.rating)}</div>
          {r.comment && <div style={S.reviewText}>{r.comment}</div>}
        </div>
      ))}
    </div>
  )
}
