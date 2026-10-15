import { AlertTriangle, CheckCircle2, Link2Off, ShieldCheck, TimerOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type LinkProblem = 'missing' | 'invalid' | 'expired' | 'already_submitted' | 'unconfigured'

const STATUS_INFO: Record<LinkProblem, { title: string; message: string; tone: 'warn' | 'info' | 'ok' }> = {
  missing: {
    title: 'Tautan survei tidak ditemukan',
    message: 'Halaman ini harus dibuka melalui tautan khusus yang dikirimkan HiFi melalui WhatsApp. Silakan periksa kembali pesan Anda.',
    tone: 'warn',
  },
  invalid: {
    title: 'Tautan tidak valid',
    message: 'Tautan survei tidak dikenali. Pastikan Anda menggunakan tautan terbaru yang kami kirimkan.',
    tone: 'warn',
  },
  expired: {
    title: 'Tautan sudah kedaluwarsa',
    message: 'Masa berlaku tautan survei ini telah berakhir. Silakan hubungi HiFi apabila Anda masih ingin berpartisipasi.',
    tone: 'info',
  },
  already_submitted: {
    title: 'Survei sudah pernah diisi',
    message: 'Kami sudah menerima jawaban Anda. Terima kasih atas partisipasi Anda dalam survei HiFi.',
    tone: 'ok',
  },
  unconfigured: {
    title: 'Layanan survei belum siap',
    message: 'Layanan survei sedang tidak tersedia. Silakan coba beberapa saat lagi.',
    tone: 'warn',
  },
}

const TONES: Record<string, { badge: string; icon: LucideIcon }> = {
  warn: { badge: 'bg-[#FEF2F2] text-[#E11D48]', icon: Link2Off },
  info: { badge: 'bg-[#FFF7ED] text-[#EA8A16]', icon: TimerOff },
  ok: { badge: 'bg-[#EAFBF3] text-success', icon: CheckCircle2 },
}

export function StatusView({ status }: { status: LinkProblem }) {
  const info = STATUS_INFO[status]
  const tone = TONES[info.tone]
  const Icon = status === 'unconfigured' ? AlertTriangle : tone.icon

  return (
    <div className="mx-auto mt-10 max-w-[600px] border-[3px] border-[#241638] bg-white p-7 shadow-[7px_7px_0_#241638] sm:p-10">
      <span className={cn('flex h-14 w-14 items-center justify-center rounded-md border-2 border-[#241638]', tone.badge)} aria-hidden>
        <Icon size={22} strokeWidth={1.7} />
      </span>

      <h1 className="mt-6 text-2xl font-black leading-tight tracking-tight text-[#241638] sm:text-3xl">
        {info.title}
      </h1>
      <p className="mt-3 text-[15px] font-medium leading-7 text-[#655d70]">{info.message}</p>

      <div className="mt-7 border-t-2 border-[#241638] pt-5">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <ShieldCheck size={16} className="text-brand" aria-hidden /> Butuh bantuan?
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Hubungi tim Customer Experience HiFi melalui nomor layanan resmi atau balas pesan WhatsApp yang berisi tautan
          survei ini.
        </p>
      </div>
    </div>
  )
}
