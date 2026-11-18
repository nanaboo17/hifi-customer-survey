export const REASONS = [
  { id: 'no_issue', title: 'Tidak Ada Kendala', icon: 'power', file: 'no-longer-needed.png' },
  { id: 'network_issue', title: 'Kendala Internet', icon: 'wifi', file: 'network-issue.png' },
  { id: 'away_from_home', title: 'Sedang Jarang Berada di Rumah', icon: 'home', file: 'away-from-home.png' },
  { id: 'on_holiday', title: 'Sedang / Berencana Liburan di Bulan Desember', icon: 'home', file: 'away-from-home.png' },
  { id: 'reduced_usage', title: 'Penggunaan Internet Berkurang', icon: 'power', file: 'no-longer-needed.png' },
  { id: 'other', title: 'Alasan Lainnya', icon: 'message', file: 'other-reason.png' },
] as const

export type ReasonOption = (typeof REASONS)[number]
export type Reason = ReasonOption['id']
export type ReasonIcon = ReasonOption['icon']
export const isReason = (value: unknown): value is Reason => typeof value === 'string' && REASONS.some(x => x.id === value)
