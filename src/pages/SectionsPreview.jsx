import { CategoryMosaic, SpotlightSection, TrustBand } from '../components/HomeSections'
import '../styles/homeSections.css'

const IMG = (id) => `https://picsum.photos/seed/${id}/600/600`
const CATS = ['Electronics', 'Vehicles', 'Property', 'Furniture', 'Clothing', 'Agriculture', 'Food']
const CITIES = ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba']
const TITLES = ['Samsung Galaxy A57 256GB', 'Toyota Vitz 2015 clean', '3 bedroom house in Area 47', 'Modern leather sofa set', 'Designer ankara dress', 'Fresh maize 50kg bag', 'Dell XPS laptop i7', 'Mazda Demio low mileage', 'Office desk + chair', 'Mountain bike 26 inch']

const MOCK = Array.from({ length: 24 }).map((_, i) => ({
  id: 'm' + i,
  title: TITLES[i % TITLES.length],
  price: 50000 + (i * 31000) % 4000000,
  flash_sale_price: i % 5 === 0 ? 38000 + i * 1000 : null,
  flash_sale_expires_at: i % 5 === 0 ? new Date(Date.now() + 3600_000).toISOString() : null,
  images: [IMG(i + 1)],
  city: CITIES[i % CITIES.length],
  category: CATS[i % CATS.length],
  seller_id: 's' + (i % 9),
  created_at: new Date(Date.now() - i * 3600_000).toISOString(),
}))

export default function SectionsPreview() {
  return (
    <div className="soko-main-content" style={{ background: '#f7f8f6', minHeight: '100vh', paddingBottom: 60 }}>
      <SpotlightSection listings={MOCK} navigate={() => {}} />
      <CategoryMosaic listings={MOCK} setCategory={() => {}} />
      <TrustBand listings={MOCK} />
    </div>
  )
}
