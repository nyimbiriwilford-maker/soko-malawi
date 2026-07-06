import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

const CRAWLER_UA_PATTERNS = [
  'facebookexternalhit', 'Facebot', 'Twitterbot', 'WhatsApp',
  'LinkedInBot', 'TelegramBot', 'Discordbot', 'Slackbot',
  'Pinterest', 'redditbot', 'vkShare', 'SkypeUriPreview',
]

function isCrawler(userAgent = '') {
  return CRAWLER_UA_PATTERNS.some(p => userAgent.toLowerCase().includes(p.toLowerCase()))
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default async function handler(req, res) {
  const { slug } = req.query
  const userAgent = req.headers['user-agent'] || ''
  const siteUrl = `https://${req.headers.host}`
  const pageUrl = `${siteUrl}/shop/${slug}`

  // Humans: send them straight into the SPA at the same URL.
  if (!isCrawler(userAgent)) {
    res.setHeader('Content-Type', 'text/html')
    res.status(200).send(`<!doctype html>
<html><head><meta http-equiv="refresh" content="0;url=${pageUrl}?spa=1" />
<script>window.location.replace(${JSON.stringify(pageUrl + '?spa=1')})</script>
</head><body>Redirecting…</body></html>`)
    return
  }

  // Crawlers: fetch shop data and render static OG tags.
  let shop = null
  try {
    const { data } = await supabase
      .from('shops')
      .select('name, description, logo_url, category, city, district, rating, review_count')
      .eq('slug', slug)
      .maybeSingle()
    shop = data
  } catch (err) {
    console.error('[shop-og] fetch failed:', err)
  }

  const title = shop?.name ? `${shop.name} | SokoMW` : 'SokoMW Shop'
  const description = shop?.description
    || (shop ? `${shop.category || 'Shop'} on SokoMW \u2013 ${shop.city || shop.district || 'Malawi'}` : 'Buy and sell on SokoMW, Malawi\u2019s marketplace.')
  const image = shop?.logo_url || `${siteUrl}/og-default.png`

  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="400" />
  <meta property="og:image:height" content="400" />
  <meta property="og:site_name" content="SokoMW" />

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>
  <p>${escapeHtml(title)}</p>
</body>
</html>`)
}