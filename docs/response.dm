# Investigation (read-only)

## 1. Git and deploy state

```
## master...origin/master
 M docs/response.dm
23fb4f3 Services phase 6C: ranking data and tracking
cd2f7fd Services phase 6B: paging and card detail by breakpoint
8256372 Services phase 6A: ranking and Recommended sort
ae10a80 Services phase 5: featured rail and visibility
7730cc1 Services phase 4: states, My Services tab, polish
a151ed2 Services phase 3: cards and grid
545decc Services phase 2: mobile-first controls
b9725d0 Services phase 1: hero, search, segmented, remove posting controls
b3ff8ba Redesign Services page layout
265135f Remove remaining job references in ProviderModal and dead homerrr
```

Local sw.js version:
```
public\sw.js:1:const CACHE_VERSION = 'sokomw-v24'
```

Remote sw.js version:
```
const CACHE_VERSION = 'sokomw-v24'
```

## 2. Jobs removal check

Hits (case-insensitive "job") in src and public:

```
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\App.jsx:538: <Route path="/jobs"                    element={<Navigate to="/" replace />} />   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\App.jsx:539: <Route path="/jobs/*"                  element={<Navigate to="/" replace />} />   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\assets\looking-for-hero.jpg:2000: (binary)   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\assets\looking-for-hero.jpg:2135: (binary)   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\components\StatusUploadModal.jsx:493: // Snapshot everything the background job needs - the picker unmounts now.   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\lib\NetworkManager.js:211: const jobs = this._queue.splice(0, this._queue.length)   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\lib\NetworkManager.js:212: for (const config of jobs) {   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\lib\NetworkManager.js:220: console.error('[NetworkManager] queued job failed:', err)   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\lib\serviceRanking.js:33: if (s.type === 'job' || s.is_job || s.job === true) return false   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\lib\serviceRanking.js:57: const count = Number(s.completed_count != null ? s.completed_count : (s.jobs_done != null ? s.jobs_done : (s.review_count != null ? s.review_count : 0)))   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\lib\statusPublishStore.js:26: /** Begin a background publish. Returns a session token the background job holds. */   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\lib\statusPublishStore.js:34: /** Progress update from the background job. Ignored once dismissed. */   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Admin.jsx:4: import { isListingFeatured, isListingActive, isJobListing, getBannerCta } from '../utils/homeUtils'   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Admin.jsx:306: const list = (data || []).filter(l => !isJobListing(l)).map(l => ({ ...l, is_featured: isListingFeatured(l) }))   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Admin.jsx:2615: const rows = (data || []).filter(l => !isJobListing(l))   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:50: isFlashActive, isListingFeatured, isListingActive, isJobListing, getBannerCta, prioritizeFeatured, rotateFeaturedFairly,   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:551: .soko-jobs-services { grid-template-columns: 1fr 1fr !important; }   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:705: .soko-jobs-services { grid-template-columns: 1fr !important; gap: 12px !important; }   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:882: .soko-shops-jobs-section {   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:885: .soko-shops-jobs-section .soko-section-title,   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:886: .soko-shops-jobs-section h3 {   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:2942: const jobType = subParts[1] || ''   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:3007: {jobType && <span className="soko-wc-type">{jobType}</span>}   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:3115: function ShopsJobsServicesRow({ navigate, shops, services, loading, currentUser, onServiceClick, userLat, userLng, activeDistrict }) {   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:3189: <section className="soko-shops-jobs-section" style={{ padding: '10px 20px 18px', background: '#f8f9fa' }}>   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:3443: .soko-shops-jobs-bridge {   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:3464: /* �� Job Cards (horizontal listing style) �� */   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:3727: .soko-shops-jobs-section { padding: 10px 14px 12px !important; }   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:3741: /* Jobs - compact row card like a mobile app list item */   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:4290: listings: (listingsData.data || []).filter(l => !isJobListing(l)),   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:5470: const featuredRows = (featuredRaw || []).filter(l => !isJobListing(l))   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:5471: const recentRows = (recentRaw || []).filter(l => !isJobListing(l))   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:5625: .select('id, name, category, city, created_at, media_urls, rate, rating, verified, provider_id, description, skills, contact, coverage, experience, jobs_done, available, views')   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:5631: if (error && /media_urls|rate|rating|verified|provider_id|description|skills|contact|coverage|experience|jobs_done|available|views|column/i.test(error.message || '')) {   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Home.jsx:5906: <ShopsJobsServicesRow navigate={navigate} shops={shops} services={services} loading={sectionsLoading} currentUser={user} onServiceClick={setSelectedService} userLat={userLat} userLng={userLng} activeDistrict={activeDistrict} />   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\ListingsPage.jsx:21: import { isListingFeatured, isJobListing, rotateFeaturedFairly } from '../utils/homeUtils'   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\ListingsPage.jsx:524: /* generic row card (jobs / services / shops / requests) */   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\ListingsPage.jsx:1554: let rows = (allData || []).filter(l => !isJobListing(l))   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Profile.jsx:5: import { isListingFeatured, isJobListing } from '../utils/homeUtils'   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\Profile.jsx:1158: setListings((data || []).filter(l => !isJobListing(l)))   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\PublicProfile.jsx:4: import { isListingFeatured, isJobListing } from '../utils/homeUtils'   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\PublicProfile.jsx:193: let activeListings = (listingsRes.data || []).filter(l => !isJobListing(l))   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\PublicProfile.jsx:194: let soldFromQuery = Array.isArray(soldListRes.data) ? soldListRes.data.filter(l => !isJobListing(l)) : []   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\SearchPage.jsx:12: import { isListingFeatured, isJobListing, rotateFeaturedFairly } from '../utils/homeUtils'   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\SearchPage.jsx:559: /* generic row card (jobs / services / shops / requests) */   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\SearchPage.jsx:1783: return { data: (data || []).filter(l => !isJobListing(l)), count: count || 0 }   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\SearchPage.jsx:1910: let rows = (allData || []).filter(l => !isJobListing(l))   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\services\MyListings.jsx:113: <span>{svc.rating} ({svc.jobs_done || 0} jobs)</span>   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\services\ProviderModal.jsx:105: {provider.jobs_done > 0 && <span>{provider.jobs_done} jobs � </span>}   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\services\ProviderModal.jsx:146: <div style={S.statVal}>{provider.jobs_done || 0}</div>   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\services\ProviderModal.jsx:147: <div style={S.statLabel}>Jobs done</div>   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\pages\services\Services.jsx:302: {renderStars(svc.rating)} {svc.rating} � {svc.jobs_done || 0} jobs   [USER-VISIBLE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\utils\homeUtils.js:415: export function isJobListing(listing) {   [SAFE]
C:\Users\WILFORD NYIMBIRI\soko-malawi\src\utils\homeUtils.js:418: return v === 'job' || v === 'jobs'   [SAFE]
```

Full contents of sql/remove_jobs.sql:

```
-- Remove Jobs feature: database cleanup (run manually; do not auto-execute from app)
-- Safe/idempotent. Leaves historical migrations untouched.

DO $$
BEGIN
  -- Drop job-related tables
  IF to_regclass('public.jobs') IS NOT NULL THEN
    DROP TABLE public.jobs CASCADE;
  END IF;
  IF to_regclass('public.job_alerts') IS NOT NULL THEN
    DROP TABLE public.job_alerts CASCADE;
  END IF;
  IF to_regclass('public.cv_profiles') IS NOT NULL THEN
    DROP TABLE public.cv_profiles CASCADE;
  END IF;

  -- Remove job_id column and index from messages
  IF to_regclass('public.messages') IS NOT NULL THEN
    DROP INDEX IF EXISTS public.idx_messages_job_id;
    ALTER TABLE public.messages DROP COLUMN IF EXISTS job_id;
    UPDATE public.messages SET chat_source = 'direct' WHERE chat_source = 'job';
    BEGIN
      ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_chat_source_check;
      ALTER TABLE public.messages
        ADD CONSTRAINT messages_chat_source_check
        CHECK (
          chat_source IS NULL
          OR chat_source IN ('listing', 'service', 'shop', 'request', 'direct')
        );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'messages_chat_source_check skip: %', SQLERRM;
    END;
  END IF;

  -- Remove job tagging from statuses
  IF to_regclass('public.user_statuses') IS NOT NULL THEN
    UPDATE public.user_statuses SET tagged_kind = NULL, tagged_ref_id = NULL WHERE tagged_kind = 'job';
    BEGIN
      ALTER TABLE public.user_statuses DROP CONSTRAINT IF EXISTS user_statuses_tagged_kind_check;
      ALTER TABLE public.user_statuses
        ADD CONSTRAINT user_statuses_tagged_kind_check
        CHECK (
          tagged_kind IS NULL
          OR tagged_kind IN ('listing', 'service', 'shop', 'request')
        );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'user_statuses_tagged_kind_check skip: %', SQLERRM;
    END;
  END IF;

  -- Remove job-match notifications
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM public.notifications WHERE type = 'job_match';
  END IF;
END $$;
```

## 3. Services data layer

supabase .from('services') calls (src):

```
src/components/ForwardSheet.jsx:110: maybe(serviceIds, supabase.from('services').select('id,name').in('id', serviceIds)),
src/components/ProductTagPicker.jsx:450: supabase.from('services').select('id, name, category, city, rate, media_urls, status').eq('provider_id', userId)...
src/hooks/useStatuses.js:144: supabase.from('services').select('id, name, rate, category, city, media_urls, description').in('id', [...byKind.service])
src/pages/Chat.jsx:740: supabase.from('services').select('id').eq('id', id).maybeSingle()
src/pages/Chat.jsx:760: supabase.from('services').select('*').eq('id', id).maybeSingle()
src/pages/ChatList.jsx:257: supabase.from('services').select('id,name,category,rate,city,media_urls').in('id', serviceIds)
src/pages/ChatListPanel.jsx:579: supabase.from('services').select('id,name,category,rate,city,media_urls').in('id', serviceIds)
src/pages/Home.jsx:5624: supabase.from('services').select('id, name, category, city, created_at, media_urls, rate, rating, verified, provider_id, description, skills, contact, coverage, experience, jobs_done, available, views')
src/pages/Home.jsx:5632: supabase.from('services').select('id, name, category, city, created_at, media_urls, rate, provider_id, description')
src/pages/Home.jsx:5639: supabase.from('services').select('id, name, category, city, created_at')
src/pages/Home.jsx:5646: supabase.from('services').select('id, name, category, city, created_at, media_urls, rate')
src/pages/ListingsPage.jsx:1488: supabase.from('services').select('id', { count:'exact', head:true }).eq('status', 'active').ilike('name', `%${q}%`)
src/pages/ListingsPage.jsx:1656: supabase.from('services').select('id, name, category, city, created_at', { count: 'exact' })
src/pages/MyListings.jsx:28: supabase.from('services').update({ status: newStatus }).eq('id', svc.id)
src/pages/MyListings.jsx:34: supabase.from('services').delete().eq('id', id)
src/pages/Notifications.jsx:555: supabase.from('services').select('id, name, media_urls, rate, city, district')
src/pages/ReviewSection.jsx:51: supabase.from('services').update({ rating: avg }).eq('id', serviceId)
src/pages/SearchPage.jsx:1792: supabase.from('services').select('id,name,category,city', { count: 'exact' })
src/pages/SearchPage.jsx:1856: supabase.from('services').select('id', { count:'exact', head:true }).eq('status', 'active').ilike('name', `%${q}%`)
src/pages/SearchPage.jsx:2044: supabase.from('services').select('id, name, category, city, created_at', { count: 'exact' })
src/pages/ServiceForm.jsx:118: supabase.from('services').update(payload).eq('id', editingService.id)
src/pages/ServiceForm.jsx:120: supabase.from('services').insert(payload)
src/pages/ServicesPage.jsx:737: supabase.from('services').select('*').eq('status', 'active').order('created_at', { ascending: false })
src/pages/services/MyListings.jsx:13: supabase.from('services').update({ status: newStatus }).eq('id', svc.id)
src/pages/services/MyListings.jsx:19: supabase.from('services').delete().eq('id', id)
src/pages/services/ProviderModal.jsx:22: supabase.from('services') (multi-line; see below)
src/pages/services/ReviewSection.jsx:50: supabase.from('services').update({ rating: avg }).eq('id', serviceId)
src/pages/services/ServiceForm.jsx:112: supabase.from('services').update(payload).eq('id', editingService.id)
src/pages/services/ServiceForm.jsx:114: supabase.from('services').insert(payload)
src/pages/services/Services.jsx:41: supabase.from('services').select('*').eq('status', 'active').order('created_at', { ascending: false })
```

services/ProviderModal.jsx (legacy) query block:
```
src/pages/services/ProviderModal.jsx:22: supabase.from('services')
```
(multi-line select not captured as single string).

services table id type and columns:
- No CREATE TABLE services found in sql/ or supabase/migrations.
- Live columns: available, category, city, contact, coverage, created_at, description, experience, id (uuid), jobs_done, media_urls, name, provider_id, rate, rating, skills, status, tags, verified, views, whatsapp.
- sql/services_ranking.sql references id as uuid.

rpc('increment_service_stat') calls in src:
```
src/pages/ProviderModal.jsx:29: supabase.rpc('increment_service_stat', { p_service_id: provider.id, p_stat: 'views' }).then(() => {}).catch(() => {})
src/pages/ProviderModal.jsx:39: supabase.rpc('increment_service_stat', { p_service_id: provider.id, p_stat: 'chats_count' }).then(() => {}).catch(() => {})
src/pages/ServicesPage.jsx:677: supabase.rpc('increment_service_stat', { p_service_id: selectedProvider.id, p_stat: 'views' }).then(() => {}).catch(() => {})
src/pages/ServicesPage.jsx:835: supabase.rpc('increment_service_stat', { p_service_id: svc.id, p_stat: 'chats_count' }).then(() => {}).catch(() => {})
```

Phase presence:
- src/lib/serviceRanking.js exists: yes
- Recommended sort present: yes (src/pages/ServicesPage.jsx)
- paging hook present: yes (pageSize state in src/pages/ServicesPage.jsx)
- increment calls present: yes (src/pages/ServicesPage.jsx, src/pages/ProviderModal.jsx)

## 4. Admin identification

How the app decides a user is admin (src/pages/Admin.jsx):

```
src/pages/Admin.jsx:123-128:
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') { navigate('/'); return }
```

Admin sets featured on listings: src/pages/Admin.jsx, function toggleFeatured (around line 771):

```
async function toggleFeatured(listing) {
  setToggling(listing.id)
  try {
    if (!listing.is_featured) {
      const daysInput = window.prompt('Feature this listing for how many days?', '14')
      const days = parseInt(daysInput, 10)
      if (!daysInput || !days || days <= 0) return

      const { error } = await supabase.rpc('admin_set_listing_featured', {
        p_listing_id: listing.id,
        p_duration_days: days,
      })
      if (error) throw error

      showToast(`Featured for ${days} days ⭐`)
      await loadListings()
    } else {
      const { error } = await supabase.rpc('admin_unset_listing_featured', {
        p_listing_id: listing.id,
      })
      if (error) throw error

      showToast('Removed from featured')
      await loadListings()
    }
  } catch (e) {
    showToast(`❌ ${e?.message || 'Feature update failed'}`)
  } finally {
    setToggling(null)
  }
}
```

No admin feature toggle exists for services.

## 5. Security of services rows

RLS policies on services (from supabase/migrations/20260711_security_hardening.sql):

```
CREATE POLICY "services_select" ON public.services
  FOR SELECT TO authenticated, anon
  USING (COALESCE(status, 'active') = 'active' OR provider_id = auth.uid() OR public.is_admin());
CREATE POLICY "services_insert" ON public.services
  FOR INSERT TO authenticated WITH CHECK (provider_id = auth.uid());
CREATE POLICY "services_update" ON public.services
  FOR UPDATE TO authenticated USING (provider_id = auth.uid() OR public.is_admin());
CREATE POLICY "services_delete" ON public.services
  FOR DELETE TO authenticated USING (provider_id = auth.uid() OR public.is_admin());
```

Client update calls on services (.update(...)):
```
src/pages/MyListings.jsx:28: await supabase.from('services').update({ status: newStatus }).eq('id', svc.id)
src/pages/ReviewSection.jsx:51: await supabase.from('services').update({ rating: avg }).eq('id', serviceId)
src/pages/ServiceForm.jsx:118: ;({ error } = await supabase.from('services').update(payload).eq('id', editingService.id))
src/pages/services/MyListings.jsx:13: await supabase.from('services').update({ status: newStatus }).eq('id', svc.id)
src/pages/services/ReviewSection.jsx:50: await supabase.from('services').update({ rating: avg }).eq('id', serviceId)
src/pages/services/ServiceForm.jsx:112: ;({ error } = await supabase.from('services').update(payload).eq('id', editingService.id))
src/pages/services/ProviderModal.jsx:22-24 (legacy): supabase.from('services').update({ views: (provider.views || 0) + 1 }).eq('id', provider.id)
```

## 6. Open items

Build warnings: none in last build (npm run build succeeded, built in ~2.5s). Lint: pre-existing warning in src/pages/ServicesPage.jsx:612 (React Hook useEffect missing dependency: 'init').

Temporary test flags:
```
src/pages/Home.jsx:5323: // Temporary testing flags: ?emptyStatus=1 / ?errorStatus=1
src/pages/Home.jsx:5324: const forceEmptyStatus = new URLSearchParams(window.location.search).get('emptyStatus') === '1'
src/pages/Home.jsx:5325: const forceErrorStatus = new URLSearchParams(window.location.search).get('errorStatus') === '1'
src/pages/Home.jsx:5828: stories={forceEmptyStatus ? [] : stories}
src/pages/Home.jsx:5829: loading={forceEmptyStatus || forceErrorStatus ? false : storiesLoading}
src/pages/Home.jsx:5830: error={forceErrorStatus ? new Error('forced') : (forceEmptyStatus ? null : storiesError)}
```

Skipped items: ?banner=1 and ?fakeStatuses= flags not found in src. No thumbnail/resize mechanism for service images (original URLs retained). No record_service_view RPC (views tracking uses increment_service_stat after SQL run). services table has no region/is_featured/chats_count/rating_avg/rating_count/completed_count columns yet (sql/services_ranking.sql not executed).
