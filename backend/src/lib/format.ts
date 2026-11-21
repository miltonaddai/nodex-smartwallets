/** "3m ago", "5h ago", "2d ago" from an ISO timestamp. Non-dates are returned unchanged. */
export function formatLastActive(value: string, now = Date.now()): string {
  const time = Date.parse(value)
  if (Number.isNaN(time)) return value
  const minutes = Math.max(1, Math.floor((now - time) / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
}
