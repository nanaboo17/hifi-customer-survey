export const REASONS = [
  { id: 'no_issue', title: 'Tidak Ada Isu', icon: 'power', file: 'no-longer-needed.png' },
  { id: 'network_issue', title: 'Koneksi Internet Bermasalah', icon: 'wifi', file: 'network-issue.png' },
  { id: 'away_from_home', title: 'Sedang Jarang Berada di Rumah', icon: 'home', file: 'away-from-home.png' },
  { id: 'on_holiday', title: 'Sedang Cuti / Liburan', icon: 'home', file: 'away-from-home.png' },
  { id: 'other_provider', title: 'Menggunakan Provider Internet Lain', icon: 'router', file: 'other-provider.png' },
  { id: 'no_longer_needed', title: 'Sementara Tidak Menggunakan Layanan', icon: 'power', file: 'no-longer-needed.png' },
  { id: 'other', title: 'Alasan Lainnya', icon: 'message', file: 'other-reason.png' },
] as const

export type ReasonOption = (typeof REASONS)[number]
export type Reason = ReasonOption['id']
export type ReasonIcon = ReasonOption['icon']
export const isReason = (value: unknown): value is Reason => typeof value === 'string' && REASONS.some(x => x.id === value)
