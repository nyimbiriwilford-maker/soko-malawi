import { Grid, Car, Smartphone, Shirt, Building2, Sprout, Wrench, Ellipsis } from 'lucide-react'

export const CATEGORIES = [
  { key: 'all',         label: 'All',            icon: Grid,        tint: '#eef2f7', accent: '#1f2937', action: '/listings' },
  { key: 'Vehicles',    label: 'Vehicles',       icon: Car,         tint: '#e0f2fe', accent: '#0369a1', action: '/listings?cat=Vehicles' },
  { key: 'Electronics', label: 'Electronics',    icon: Smartphone,  tint: '#f3e8ff', accent: '#6d28d9', action: '/listings?cat=Electronics' },
  { key: 'Clothing',    label: 'Fashion',        icon: Shirt,       tint: '#fce7f3', accent: '#be185d', action: '/listings?cat=Clothing' },
  { key: 'Property',    label: 'Property',       icon: Building2,   tint: '#fff7ed', accent: '#c2410c', action: '/listings?cat=Property' },
  { key: 'Agriculture', label: 'Agriculture',    icon: Sprout,      tint: '#ecfdf5', accent: '#0f766e', action: '/listings?cat=Agriculture' },
  { key: 'Services',    label: 'Services',       icon: Wrench,      tint: '#f1f5f9', accent: '#475569', action: '/services' },
  { key: 'More',        label: 'More',           icon: Ellipsis,    tint: '#fff4d8', accent: '#c88a00', action: '/categories' },
]
