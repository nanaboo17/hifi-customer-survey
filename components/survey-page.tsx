'use client'
import { useState } from 'react'
import { ChevronLeft, Check, Loader2, AlertCircle } from 'lucide-react'
import { REASONS, type Reason } from '@/lib/survey'
import { StatusView, type LinkProblem } from '@/components/survey/status-view'

export type SurveyStatus = 'valid' | 'demo' | LinkProblem
type Answers = { ticket: string; freeze: string; other: string }
const initial: Answers = { ticket: '', freeze: '', other: '' }
const freezeReasons: Reason[] = ['reduced_usage', 'away_from_home', 'on_holiday']
const defaultThanks = 'Terima kasih sudah meluangkan waktu. Jawaban Anda membantu kami meningkatkan layanan HiFi.'

export default function SurveyPage({ status, token }: { status: SurveyStatus; token: string }) {
  const [reason, setReason] = useState<Reason | null>(null)
  const [answers, setAnswers] = useState<Answers>(initial)
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [already, setAlready] = useState(false)
  const [error, setError] = useState('')
  const [thankYou, setThankYou] = useState(defaultThanks)
  const demo = status === 'demo'
  const survey = status === 'valid' || demo
  const set = (key: keyof Answers, value: string) => { setAnswers(a => ({ ...a, [key]: value })); setError('') }
  const direct = reason === 'no_issue'
  const ready = reason === 'network_issue' ? !!answers.ticket : reason && freezeReasons.includes(reason) ? !!answers.freeze : reason === 'other' ? answers.other.trim().length >= 3 : false
  function notes(r: Reason) {
    if (r === 'network_issue') return 'Butuh bantuan internet: ' + answers.ticket
    if (freezeReasons.includes(r)) return 'Minat info Freeze Bill: ' + answers.freeze
    if (r === 'other') return answers.other.trim()
    return null
  }
  async function submit(r: Reason) {
    if (busy) return
    setBusy(true); setError('')
    try {
      if (demo) { await new Promise(resolve => setTimeout(resolve, 350)) }
      else {
        const response = await fetch('/api/survey', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, reason: r, details: notes(r) }) })
        const body = await response.json().catch(() => ({})) as { error?: string }
        if (response.status === 409) { setAlready(true); return }
        if (!response.ok) throw Error(body.error || 'Gagal menyimpan jawaban.')
      }
      setThankYou(r === 'network_issue' && answers.ticket === 'Ya'
        ? 'Terima kasih. Permintaan bantuan Anda sudah dicatat dan akan ditindaklanjuti tim HiFi.'
        : freezeReasons.includes(r) && answers.freeze === 'Ya'
        ? 'Terima kasih. Minat Anda untuk mendapatkan informasi Freeze Bill sudah dicatat. Tim HiFi akan menghubungi Anda.'
        : defaultThanks)
      setDone(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menyimpan jawaban. Silakan coba lagi.') }
    finally { setBusy(false) }
  }
  function choose(r: Reason) { setReason(r); setAnswers(initial); setError('') }
  const choice = (value: string, label: string, active: boolean, action: () => void, index: number, dimmed = false) =>
    <button key={value} type="button" aria-pressed={active} onClick={action} disabled={busy}
      className={'flex min-h-[42px] w-full items-center gap-2 rounded-full border-2 px-3 py-2 text-left text-[12px] font-semibold leading-snug transition-colors duration-150 ' + (active ? 'border-[#b90a3c] bg-white text-[#b90a3c] ring-[3px] ring-[#ffd100]' : dimmed ? 'border-[#e1e1e5] bg-[#dedee3] text-[#74747e] hover:bg-[#f0f0f2]' : 'border-white bg-white text-[#b90a3c] hover:bg-[#fff0f5]')}>
      <span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ' + (active ? 'bg-[#ed174c] text-white' : dimmed ? 'bg-[#c7c7ce] text-[#666672]' : 'bg-[#ffe5ee] text-[#b90a3c]')}>{active ? <Check size={16} /> : String.fromCharCode(65 + index)}</span>{label}
    </button>
  const inputStyle = 'w-full rounded-xl border border-[#e9cad5] bg-white p-3 text-sm text-[#281727] outline-none focus:border-[#ed174c] focus:ring-2 focus:ring-[#ffd3df]'
  return <div className="h-[100dvh] w-full overflow-hidden bg-white text-[#30202a]">
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="h-1.5 shrink-0 bg-[#ed174c]" />
      <header className="flex h-[55px] shrink-0 items-center justify-center border-b border-[#f6e0e8] px-6">
        <img src="/images/indosat-wordmark.svg" alt="Indosat Ooredoo Hutchison" className="h-auto w-[145px] sm:w-[165px]" />
      </header>
      {!survey ? <div className="p-6"><StatusView status={status as LinkProblem} /></div>
      : already ? <div className="p-6"><StatusView status="already_submitted" /></div>
      : done ? <div className="px-8 py-16 text-center"><div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full bg-[#e0f6e6] text-[#24944b]"><Check size={40} strokeWidth={3} /></div><h1 className="text-2xl font-extrabold">Jawaban terkirim!</h1><p className="mt-4 text-sm leading-7 text-[#6d7590]">{thankYou}</p>{demo && <p className="mt-5 text-xs font-semibold text-[#c31349]">Mode demo: jawaban tidak tersimpan.</p>}</div>
      : <>
        <div className="mx-auto w-full max-w-[600px] shrink-0 px-5 pb-2 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Kembali" onClick={() => { if (step > 1 && !busy) { setStep(1); setError('') } }} disabled={step === 1 || busy} className="rounded-lg p-1 text-[#c31349] disabled:opacity-20"><ChevronLeft size={23} /></button>
            <span className="text-base font-extrabold">{String(step).padStart(2, '0')} <span className="text-[#a7afc1]">/ {direct ? '01' : '02'}</span></span><div className="w-7" />
          </div>
          <div className="flex gap-1.5">{Array.from({ length: direct ? 1 : 2 }, (_, i) => <div key={i} className={'h-1 flex-1 rounded-full ' + (i + 1 <= step ? 'bg-[#ed174c]' : 'bg-[#f7dce6]')} />)}</div>
        </div>
        <div className="mx-auto min-h-0 w-full max-w-[600px] flex-1 overflow-y-auto px-6 pb-8 pt-3">
          <h1 className="text-[clamp(17px,2.8vh,23px)] font-extrabold leading-snug tracking-tight">
            {step === 1 ? 'Apa alasan penggunaan internet HiFi Anda sedang berkurang?' : reason === 'network_issue' ? 'Apakah Anda membutuhkan bantuan terkait koneksi internet?' : reason === 'other' ? 'Apa alasan lainnya?' : 'Apakah Anda ingin mendapatkan informasi tentang Freeze Bill?'}
          </h1>
          <p className="mt-2 text-[12px] leading-[1.45] text-[#7a8299]">
            {step === 1 ? 'Pilih satu jawaban yang paling sesuai dengan kondisi Anda.' : reason === 'network_issue' ? 'Tim HiFi dapat membantu melakukan pengecekan koneksi berdasarkan permintaan Anda.' : reason === 'other' ? 'Tuliskan alasan Anda secara singkat.' : 'Freeze Bill merupakan pilihan layanan bagi pelanggan tertentu sesuai ketentuan yang berlaku. Memilih Ya hanya mencatat minat untuk mendapatkan informasi; tagihan tidak otomatis dibekukan.'}
          </p>
          {step === 2 && reason === 'other' && <div className="mt-6"><textarea aria-label="Alasan lainnya" className={inputStyle} rows={3} maxLength={500} value={answers.other} onChange={e => set('other', e.target.value)} placeholder="Ceritakan alasan Anda..." /><p className="mt-2 text-right text-xs text-[#7a8299]">{answers.other.length}/500</p></div>}
          <div className="mt-3 space-y-2 rounded-2xl bg-[#ed174c] p-3">
            {step === 1 && REASONS.map((item, i) => choice(item.id, item.title, reason === item.id, () => choose(item.id), i, reason !== null && reason !== item.id))}
            {step === 2 && reason === 'network_issue' && ['Ya', 'Tidak'].map((v, i) => choice(v, v === 'Ya' ? 'Ya, saya butuh bantuan' : 'Tidak, terima kasih', answers.ticket === v, () => set('ticket', v), i, !!answers.ticket && answers.ticket !== v))}
            {step === 2 && reason !== null && freezeReasons.includes(reason) && ['Ya', 'Tidak'].map((v, i) => choice(v, v === 'Ya' ? 'Ya, saya ingin informasi Freeze Bill' : 'Tidak, terima kasih', answers.freeze === v, () => set('freeze', v), i, !!answers.freeze && answers.freeze !== v))}
            {step === 1 && <button type="button" disabled={!reason || busy} onClick={() => { if (!reason) return; if (reason === 'no_issue') void submit(reason); else setStep(2) }} className="mt-2 flex min-h-[43px] w-full items-center justify-center gap-2 rounded-full bg-[#641634] px-3 text-[13px] font-bold text-white transition hover:bg-[#481026] disabled:cursor-not-allowed disabled:opacity-45">{busy ? <><Loader2 size={17} className="animate-spin" />Mengirim...</> : reason === 'no_issue' ? 'Kirim jawaban' : 'Lanjutkan'}</button>}
            {step === 2 && reason && <button type="button" onClick={() => void submit(reason)} disabled={!ready || busy} className="mt-2 flex min-h-[43px] w-full items-center justify-center gap-2 rounded-full bg-[#641634] px-3 text-[13px] font-bold text-white transition hover:bg-[#481026] disabled:cursor-not-allowed disabled:opacity-45">{busy ? <><Loader2 size={17} className="animate-spin" />Mengirim...</> : 'Kirim jawaban'}</button>}
            {error && <p role="alert" className="flex items-start gap-2 rounded-lg bg-white p-3 text-xs font-semibold text-red-700"><AlertCircle size={16} className="shrink-0" />{error}</p>}
          </div>
        </div>
      </>}
    </div>
  </div>
}
