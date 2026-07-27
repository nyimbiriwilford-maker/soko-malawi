import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import StoryViewer from '../components/StoryViewer'
import { supabase } from '../lib/supabase'

export default function StoryViewerPage() {
  const { storyId } = useParams()
  const navigate = useNavigate()
  const [stories, setStories] = useState([])
  const [startIdx, setStartIdx] = useState(0)

  useEffect(() => {
    if (!storyId) return
    let cancelled = false
    ;(async () => {
      const { data: row } = await supabase
        .from('user_statuses')
        .select(`id, content, status_type, expires_at, created_at, media_urls, tagged_listing_id, tagged_kind, tagged_ref_id, user_id, location_hint,
          profiles:user_id ( id, full_name, avatar_url, city, is_verified ),
          tagged:tagged_listing_id ( id, title, price, images, category, description, city, district )`)
        .eq('id', storyId)
        .maybeSingle()
      if (cancelled || !row) return

      const { data: rest } = await supabase
        .from('user_statuses')
        .select(`id, content, status_type, expires_at, created_at, media_urls, tagged_listing_id, tagged_kind, tagged_ref_id, user_id, location_hint,
          profiles:user_id ( id, full_name, avatar_url, city, is_verified ),
          tagged:tagged_listing_id ( id, title, price, images, category, description, city, district )`)
        .eq('user_id', row.user_id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (cancelled) return

      const group = (rest?.length || 0) > 0
        ? (rest.some(s => s.id === row.id) ? rest : [row, ...rest])
        : [row]
      // Normalize profiles join (Supabase may return array)
      for (const s of group) {
        if (Array.isArray(s.profiles)) s.profiles = s.profiles[0] || null
      }

      setStories(group)
      setStartIdx(Math.max(0, group.findIndex(x => x.id === storyId)))
    })()
    return () => { cancelled = true }
  }, [storyId])

  if (stories.length === 0) return null

  return (
    <StoryViewer
      stories={stories}
      startIndex={startIdx}
      onClose={() => navigate('/', { replace: true })}
    />
  )
}
