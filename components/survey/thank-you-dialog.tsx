'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Check } from 'lucide-react'

type ThankYouDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ThankYouDialog({ open, onOpenChange }: ThankYouDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-white p-7 shadow-xl outline-none data-[state=open]:animate-pop">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden>
            <Check size={22} strokeWidth={2.5} />
          </span>

          <Dialog.Title className="mt-5 text-[20px] font-extrabold tracking-[-0.3px] text-ink">
            Terima kasih atas jawaban Anda
          </Dialog.Title>
          <Dialog.Description className="mt-2.5 text-[14px] leading-relaxed text-muted">
            Masukan Anda sangat berarti bagi kami. Jawaban yang diberikan akan membantu HiFi memahami kebutuhan
            pelanggan dan terus meningkatkan kualitas layanan internet.
          </Dialog.Description>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-5 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-hover"
          >
            Selesai
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
