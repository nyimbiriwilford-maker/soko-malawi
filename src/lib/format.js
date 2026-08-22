export function formatPrice(amount) {
  return `MK ${Number(amount || 0).toLocaleString('en-US')}`
}
