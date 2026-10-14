export const REASONS = [
  { id: 'network_issue', title: 'Kendala Jaringan Internet', icon: 'wifi', file: 'network-issue.png' },
  { id: 'away_from_home', title: 'Sedang Tidak di Rumah', icon: 'home', file: 'away-from-home.png' },
  { id: 'other_provider', title: 'Menggunakan Provider Internet Lain', icon: 'router', file: 'other-provider.png' },
  { id: 'budget', title: 'Harga Paket Kurang Sesuai dengan Anggaran', icon: 'wallet', file: 'package-price.png' },
  { id: 'no_longer_needed', title: 'Sudah Tidak Membutuhkan Layanan Internet', icon: 'power', file: 'no-longer-needed.png' },
  { id: 'other', title: 'Alasan Lainnya', icon: 'message', file: 'other-reason.png' },
] as const

export type ReasonOption = (typeof REASONS)[number]
export type Reason = ReasonOption['id']
export type ReasonIcon = ReasonOption['icon']

export const isReason = (value: unknown): value is Reason =>
  typeof value === 'string' && REASONS.some((reason) => reason.id === value)
