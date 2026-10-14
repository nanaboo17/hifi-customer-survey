'use client'

import { Check, Home, MessageCircle, Power, Router, Wallet, Wifi } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AnswerArtwork } from './answer-artwork'
import { cn } from '@/lib/utils'
import type { Reason, ReasonIcon, ReasonOption } from '@/lib/survey'

const ICONS: Record<ReasonIcon, LucideIcon> = {
  wifi: Wifi,
  home: Home,
  router: Router,
  wallet: Wallet,
  power: Power,
  message: MessageCircle,
}

type AnswerCardProps = {
  item: ReasonOption
  index: number
  active: boolean
  disabled: boolean
  onSelect: (id: Reason) => void
}

export function AnswerCard({ item, index, active, disabled, onSelect }: AnswerCardProps) {
  const Icon = ICONS[item.icon]

  return (
    <label
      style={{ animationDelay: `${index * 40}ms` }}
      className={cn(
        'group relative flex h-full animate-fade-up cursor-pointer flex-col rounded-xl border bg-white p-2.5 transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out sm:p-3',
        'border-line hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm motion-reduce:hover:translate-y-0',
        'has-[:focus-visible]:border-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/25',
        active && 'border-brand bg-brand-soft ring-1 ring-brand hover:border-brand',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      <input
        type="radio"
        name="survey-reason"
        value={item.id}
        checked={active}
        disabled={disabled}
        onChange={() => onSelect(item.id)}
        className="sr-only"
      />

      <span
        aria-hidden
        className={cn(
          'absolute right-2.5 top-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white transition-all duration-200 ease-out',
          active ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
        )}
      >
        <Check size={12} strokeWidth={3.5} />
      </span>

      <AnswerArtwork src={`/images/${item.file}`} alt={item.title} Icon={Icon} active={active} />

      <span className="mt-3 flex flex-1 items-start text-left text-[13px] font-medium leading-snug text-ink sm:text-[14px]">
        {item.title}
      </span>

      {item.id === 'other' && (
        <span className={cn('mt-1 text-left text-[11px]', active ? 'text-brand' : 'text-muted')}>
          Isi alasan Anda
        </span>
      )}
    </label>
  )
}
