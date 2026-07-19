/**
 * All 28 districts of Malawi (alphabetical).
 * Used for listings filters, status location, shops, etc.
 */
export const MALAWI_DISTRICTS = [
  'Balaka',
  'Blantyre',
  'Chikwawa',
  'Chiradzulu',
  'Chitipa',
  'Dedza',
  'Dowa',
  'Karonga',
  'Kasungu',
  'Likoma',
  'Lilongwe',
  'Machinga',
  'Mangochi',
  'Mchinji',
  'Mulanje',
  'Mwanza',
  'Mzimba',
  'Neno',
  'Nkhata Bay',
  'Nkhotakota',
  'Nsanje',
  'Ntcheu',
  'Ntchisi',
  'Phalombe',
  'Rumphi',
  'Salima',
  'Thyolo',
  'Zomba',
]

/** Major cities / towns often used as locations (optional chips). */
export const MALAWI_CITIES = [
  'Lilongwe',
  'Blantyre',
  'Mzuzu',
  'Zomba',
  'Karonga',
  'Mangochi',
  'Kasungu',
  'Salima',
  'Dedza',
  'Nkhotakota',
]

export function isMalawiDistrict(name) {
  if (!name) return false
  const n = String(name).trim().toLowerCase()
  return MALAWI_DISTRICTS.some(d => d.toLowerCase() === n)
}
