'use client'

import { useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Loader2 } from 'lucide-react'
import { REASONS, type Reason } from '@/lib/survey'
import { cn } from '@/lib/utils'
import { AnswerCard } from '@/components/survey/answer-card'
import { ThankYouDialog } from '@/components/survey/thank-you-dialog'
import { StatusView, type LinkProblem } from '@/components/survey/status-view'

export type SurveyStatus = 'valid' | 'demo' | LinkProblem

const MAX_DETAILS = 500
const MIN_DETAILS = 3

export default function SurveyPage({ status, token }: { status: SurveyStatus; token: string }) {
  const isDemo = status === 'demo'
  const isSurvey = status === 'valid' || isDemo

  const [selected, setSelected] = useState<Reason | null>(null)
  const [otherText, setOtherText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const otherIsValid = otherText.trim().length >= MIN_DETAILS
  const canSubmit = selected !== null && (selected !== 'other' || otherIsValid)

  const choose = (id: Reason) => {
    if (pending || complete) return
    setSelected(id)
    setError('')
  }

  async function handleSubmit() {
    if (!selected || pending || complete) return
    if (selected === 'other' && !otherIsValid) {
      setError('Mohon tuliskan alasan Anda minimal 3 karakter agar dapat dikirim.')
      return
    }

    setPending(true)
    setError('')

    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 700))
      } else {
        if (!token) throw new Error('missing-token')
        const response = await fetch('/api/survey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            reason: selected,
            details: selected === 'other' ? otherText.trim() : null,
          }),
        })
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        if (response.status === 409) {
          setAlreadySubmitted(true)
          return
        }
        if (!response.ok) throw new Error(body.error || 'submit-failed')
      }

      setComplete(true)
      setDialogOpen(true)
    } catch {
      setError('Maaf, jawaban Anda belum berhasil dikirim. Silakan coba kembali.')
    } finally {
      setPending(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-canvas text-ink">
        <main className="mx-auto w-full max-w-[860px] px-5 pb-24 pt-12 sm:px-8 sm:pt-20">
          {isSurvey ? (
            alreadySubmitted ? (
              <StatusView status="already_submitted" />
            ) : (
              <>
                <Intro />
                <Question
                  selected={selected}
                  otherText={otherText}
                  pending={pending}
                  error={error}
                  complete={complete}
                  canSubmit={canSubmit}
                  otherIsValid={otherIsValid}
                  onChoose={choose}
                  onOtherText={(value) => {
                    setOtherText(value)
                    if (error) setError('')
                  }}
                  onSubmit={handleSubmit}
                  isDemo={isDemo}
                />
              </>
            )
          ) : (
            <StatusView status={status as LinkProblem} />
          )}
        </main>

        <ThankYouDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    </MotionConfig>
  )
}

function Intro() {
  return (
    <section className="max-w-[640px]">
      <div className="flex items-center gap-3 text-[13px] font-medium text-muted">
        <span className="h-px w-7 bg-brand" aria-hidden />
        Survei Pelanggan HiFi
      </div>

      <h1 className="mt-4 text-[29px] font-extrabold leading-[1.12] tracking-[-0.9px] text-ink sm:text-[40px]">
        Pengecekan <span className="text-brand">Penggunaan Internet</span> Pelanggan
      </h1>

      <p className="mt-5 max-w-[54ch] text-[15px] leading-[1.75] text-muted">
        Kami ingin memahami penyebab rendahnya penggunaan internet Anda agar kami dapat membantu mengatasi kendala yang
        dialami dan memastikan layanan tetap optimal.
      </p>

      <div className="mt-6 flex items-center gap-2 text-[13px] text-muted">
        <Clock3 className="h-4 w-4" aria-hidden />
        Kurang dari 1 menit
      </div>
    </section>
  )
}

type QuestionProps = {
  selected: Reason | null
  otherText: string
  pending: boolean
  error: string
  complete: boolean
  canSubmit: boolean
  otherIsValid: boolean
  onChoose: (id: Reason) => void
  onOtherText: (value: string) => void
  onSubmit: () => void
  isDemo: boolean
}

function Question({
  selected,
  otherText,
  pending,
  error,
  complete,
  canSubmit,
  otherIsValid,
  onChoose,
  onOtherText,
  onSubmit,
  isDemo,
}: QuestionProps) {
  const locked = pending || complete

  return (
    <section className="mt-12 border-t border-line pt-10 sm:mt-16 sm:pt-12" aria-labelledby="survey-question">
      <h2
        id="survey-question"
        className="max-w-[760px] text-[20px] font-bold leading-snug tracking-[-0.3px] text-ink sm:text-[24px]"
      >
        <span className="mr-2.5 tabular-nums text-slate-300" aria-hidden>
          01
        </span>
        Apa alasan utama penggunaan internet Anda menurun akhir-akhir ini?
      </h2>
      <p className="mt-2.5 text-[14px] text-muted">Pilih satu alasan yang paling sesuai dengan kondisi Anda saat ini.</p>

      <div
        role="radiogroup"
        aria-labelledby="survey-question"
        className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3"
      >
        {REASONS.map((reason, index) => (
          <AnswerCard
            key={reason.id}
            item={reason}
            index={index}
            active={selected === reason.id}
            disabled={locked}
            onSelect={onChoose}
          />
        ))}
      </div>

      <AnimatePresence initial={false}>
        {selected === 'other' && !complete && (
          <motion.div
            key="other-reason"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-6 max-w-[640px]">
              <label htmlFor="other-reason" className="text-[13px] font-semibold text-ink">
                Ceritakan alasan Anda <span className="text-brand">*</span>
              </label>
              <textarea
                id="other-reason"
                value={otherText}
                onChange={(event) => onOtherText(event.target.value)}
                maxLength={MAX_DETAILS}
                rows={3}
                disabled={locked}
                placeholder="Tuliskan alasan penggunaan internet Anda menurun..."
                className="mt-2 block w-full resize-y rounded-lg border border-line bg-white p-3.5 text-sm leading-relaxed text-ink outline-none transition placeholder:text-slate-400 focus:border-brand disabled:opacity-60"
              />
              <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
                <span className={cn(otherIsValid ? 'text-muted' : 'text-brand')}>
                  {otherIsValid ? 'Terima kasih.' : `Minimal ${MIN_DETAILS} karakter.`}
                </span>
                <span className={cn('tabular-nums', otherText.length > 480 ? 'text-brand' : 'text-muted')}>
                  {otherText.length}/{MAX_DETAILS}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div
          role="alert"
          className="mt-6 flex max-w-[640px] items-start gap-2.5 rounded-lg border border-brand/25 bg-brand-soft p-3.5 text-[13px] text-ink"
        >
          <AlertCircle className="mt-0.5 h-[17px] w-[17px] shrink-0 text-brand" aria-hidden />
          <p className="leading-relaxed">
            {error}
            {selected && !pending && (
              <button type="button" onClick={onSubmit} className="ml-1.5 font-semibold text-brand underline">
                Coba lagi
              </button>
            )}
          </p>
        </div>
      )}

      {complete ? (
        <div className="mt-7 flex max-w-[640px] items-center gap-2.5 rounded-lg border border-success/25 bg-[#F0FBF5] p-3.5 text-[13px] font-medium text-ink">
          <CheckCircle2 className="h-[17px] w-[17px] shrink-0 text-success" aria-hidden />
          Jawaban Anda telah berhasil dikirim. Terima kasih!
        </div>
      ) : (
        selected && (
          <div className="mt-7 flex sm:justify-end">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit || pending}
              aria-busy={pending}
              className={cn(
                'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold text-white transition-colors duration-200 sm:w-auto',
                canSubmit && !pending ? 'bg-brand hover:bg-brand-hover' : 'cursor-not-allowed bg-brand/40'
              )}
            >
              {pending ? (
                <>
                  <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                  Mengirim Jawaban...
                </>
              ) : (
                <>
                  Kirim Jawaban
                  <ArrowRight size={18} aria-hidden />
                </>
              )}
            </button>
          </div>
        )
      )}

      {isDemo && (
        <p className="mt-6 text-[12px] text-amber-700">
          Mode demo: jawaban tidak disimpan. Buka melalui tautan survei asli untuk menyimpan jawaban.
        </p>
      )}
    </section>
  )
}
