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
      <div className="min-h-screen bg-[#f5f2ec] text-[#241638]">
        <header className="border-b-[3px] border-[#241638] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><img src="/images/indosat-wordmark.svg" alt="Indosat Ooredoo Hutchison" className="h-auto w-[145px] sm:w-[190px]" /><span className="text-xs font-black uppercase tracking-[0.18em]">Customer Survey</span></div></header><main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-8 sm:px-8 sm:pt-10">
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
 return <section className="border-[3px] border-[#241638] bg-[#4924ac] px-6 py-9 text-white shadow-[7px_7px_0_#241638] sm:px-10 sm:py-12">
  <div className="relative max-w-3xl">
   <span className="inline-block -rotate-2 bg-[#ffce00] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#241638]">HiFi ingin tahu!</span>
   <h1 className="mt-6 text-3xl font-black leading-[1.08] tracking-tight sm:text-5xl">Boleh cerita sedikit tentang <span className="text-[#ffce00]">internet kamu?</span></h1>
   <p className="mt-4 max-w-[58ch] text-sm font-medium leading-7 text-white/90 sm:text-base">Kami ingin memahami alasan penggunaan internet Anda menurun, agar layanan HiFi bisa jadi lebih baik.</p>
   <p className="mt-6 inline-flex items-center gap-2 rounded-md border-2 border-white/60 bg-white/15 px-3 py-2 text-xs font-bold"><Clock3 size={16}/> Cuma butuh kurang dari 1 menit</p>
  </div>
 </section>
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
    <section className="mt-9 sm:mt-12" aria-labelledby="survey-question">
      <h2
        id="survey-question"
        className="max-w-[820px] text-2xl font-black leading-tight tracking-tight text-[#241638] sm:text-3xl"
      >
        <span className="mr-3 inline-block -rotate-3 rounded-md bg-[#ffce00] px-2 py-1 text-base font-black tabular-nums text-[#241638]" aria-hidden>
          01
        </span>
        Apa alasan utama penggunaan internet Anda menurun akhir-akhir ini?
      </h2>
      <p className="mt-3 text-[15px] font-medium text-[#655d70]">Pilih satu alasan yang paling sesuai dengan kondisi Anda saat ini.</p>

      <div
        role="radiogroup"
        aria-labelledby="survey-question"
        className="mt-7 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3"
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
            <div className="mt-7 max-w-[760px] border-[3px] border-[#241638] bg-white p-5 shadow-[5px_5px_0_#241638]">
              <label htmlFor="other-reason" className="text-[15px] font-black text-[#241638]">
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
                className="mt-3 block w-full resize-y rounded-md border-2 border-[#241638] bg-white p-4 text-sm leading-relaxed text-[#241638] outline-none focus:ring-4 focus:ring-[#ffce00] disabled:opacity-60"
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
          <div className="mt-9 flex sm:justify-end">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit || pending}
              aria-busy={pending}
              className={cn(
                'inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-md border-[3px] border-[#241638] px-10 text-base font-black text-white shadow-[5px_5px_0_#241638] transition sm:w-auto',
                canSubmit && !pending ? 'bg-[#26890c] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_#241638]' : 'cursor-not-allowed bg-[#9e94ab]'
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
        <p className="mt-8 border-l-4 border-[#ffce00] bg-white p-3 text-[12px] font-bold text-[#241638]">
          Mode demo: jawaban tidak disimpan. Buka melalui tautan survei asli untuk menyimpan jawaban.
        </p>
      )}
    </section>
  )
}
