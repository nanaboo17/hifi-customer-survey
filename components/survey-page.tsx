'use client'
import { useEffect, useState } from 'react'
import { ChevronLeft, Check, Loader2, AlertCircle } from 'lucide-react'
import { REASONS, type Reason } from '@/lib/survey'
import { StatusView, type LinkProblem } from '@/components/survey/status-view'

export type SurveyStatus = 'valid' | 'demo' | LinkProblem
type Answers = { ticket: string; freeze: string; other: string }
const initial: Answers = { ticket: '', freeze: '', other: '' }
const freezeReasons: Reason[] = ['reduced_usage', 'away_from_home', 'on_holiday']
const defaultThanks = 'Terima kasih sudah meluangkan waktu. Jawaban Anda membantu kami meningkatkan layanan HiFi.'
type Language = 'id' | 'en'
const languageKey = 'hifi_survey_language'
const en: Record<string,string> = {
 'Tidak Ada Kendala': 'No Issues',
 'Kendala Internet': 'Internet Connection Issues',
 'Sedang Jarang Berada di Rumah': 'Rarely at Home',
 'Sedang / Berencana Liburan di Bulan Desember': 'On Holiday / Planning a Holiday in December',
 'Penggunaan Internet Berkurang': 'Reduced Internet Usage',
 'Alasan Lainnya': 'Other Reasons',
 'Apa alasan penggunaan internet HiFi Anda sedang berkurang?': 'Why has your HiFi internet usage decreased?',
 'Apakah Anda membutuhkan bantuan terkait koneksi internet?': 'Do you need help with your internet connection?',
 'Apakah Anda ingin mendapatkan informasi tentang Freeze Bill?': 'Would you like more information about Freeze Bill?',
 'Pilih satu jawaban yang paling sesuai dengan kondisi Anda.': 'Select the answer that best describes your situation.',
 'Tuliskan alasan Anda secara singkat.': 'Briefly tell us your reason.',
 'Tim HiFi dapat membantu melakukan pengecekan koneksi berdasarkan permintaan Anda.': 'The HiFi team can help check your connection upon request.',
 'Freeze Bill merupakan pilihan layanan bagi pelanggan tertentu sesuai ketentuan yang berlaku. Memilih Ya hanya mencatat minat untuk mendapatkan informasi; tagihan tidak otomatis dibekukan.': 'Freeze Bill may be available to eligible customers, subject to applicable terms. Selecting Yes only requests more information; your bill will not be frozen automatically.',
 'Silakan tuliskan alasan lainnya': 'Please tell us your reason',
 'Ceritakan alasan Anda...': 'Tell us your reason...',
 'Ya, saya butuh bantuan': 'Yes, I need help',
 'Tidak, terima kasih': 'No, thank you',
 'Ya, saya ingin informasi Freeze Bill': 'Yes, I would like information about Freeze Bill',
 'Kirim jawaban': 'Submit answer',
 'Lanjutkan': 'Continue',
 'Mengirim...': 'Submitting...',
 'Jawaban terkirim!': 'Response submitted!',
 'Mode demo: jawaban tidak tersimpan.': 'Demo mode: your response is not saved.',
 'Kembali': 'Back',
 'Gagal menyimpan jawaban.': 'Unable to save your response.',
 'Gagal menyimpan jawaban. Silakan coba lagi.': 'Unable to save your response. Please try again.',
 'Data terlalu besar.': 'Your response is too large.',
 'Format tidak valid.': 'Invalid response format.',
 'Tautan survei tidak valid.': 'Invalid survey link.',
 'Pilihan alasan tidak valid.': 'Invalid reason selection.',
 'Rincian jawaban maksimal 500 karakter.': 'Your answer must be no longer than 500 characters.',
 'Mohon isi alasan (3–500 karakter).': 'Please enter a reason (3–500 characters).',
 'Mohon tentukan apakah ingin dibantu membuat tiket.': 'Please select whether you need technical assistance.',
 'Mohon pilih apakah ingin mendapatkan informasi Freeze Bill.': 'Please select whether you want Freeze Bill information.',
 'Jawaban ini tidak memerlukan rincian tambahan.': 'This answer does not require additional details.',
 'Layanan survei belum dikonfigurasi.': 'The survey service is not configured.',
 'Tautan survei sudah kedaluwarsa.': 'The survey link has expired.',
 'Survei ini sudah pernah dijawab.': 'This survey has already been completed.',
 'Konfigurasi survei sedang diperbarui. Silakan coba kembali beberapa saat lagi.': 'The survey is being updated. Please try again later.',
 'Terima kasih sudah meluangkan waktu. Jawaban Anda membantu kami meningkatkan layanan HiFi.': 'Thank you for your time. Your feedback helps us improve HiFi services.',
 'Terima kasih. Permintaan bantuan Anda sudah dicatat dan akan ditindaklanjuti tim HiFi.': 'Thank you. Your request for assistance has been recorded and the HiFi team will follow up.',
 'Terima kasih. Minat Anda untuk mendapatkan informasi Freeze Bill sudah dicatat. Tim HiFi akan menghubungi Anda.': 'Thank you. Your interest in Freeze Bill information has been recorded. The HiFi team will contact you.'
}
const translate = (text:string, language:Language) => language==='en' ? en[text]||text : text


export default function SurveyPage({ status, token }: { status: SurveyStatus; token: string }) {
  const [language, setLanguage] = useState<Language>('id')
  const t = (text:string) => translate(text, language)
  useEffect(() => { try { if(localStorage.getItem(languageKey)==='en')setLanguage('en') } catch {} }, [])
  const chooseLanguage=(value:Language)=>{setLanguage(value);try{localStorage.setItem(languageKey,value)}catch{}}
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
  const direct = reason === 'no_issue' || reason === 'other'
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
      <header className="relative flex h-[55px] shrink-0 items-center justify-center border-b border-[#f6e0e8] px-4">
        <img src="/images/indosat-wordmark.svg" alt="Indosat Ooredoo Hutchison" className="h-auto w-[125px] sm:w-[165px]" />
        <div role="group" aria-label="Survey language / Bahasa survei" className="absolute right-2 top-1/2 flex -translate-y-1/2 rounded-full border border-[#f0b6c8] bg-white p-0.5 sm:right-4">
          <button type="button" onClick={()=>chooseLanguage('id')} aria-pressed={language==='id'} className={'rounded-full px-2 py-1 text-[10px] font-bold sm:px-3 sm:text-xs '+(language==='id'?'bg-[#ed174c] text-white':'text-[#a52049]')}>ID</button>
          <button type="button" onClick={()=>chooseLanguage('en')} aria-pressed={language==='en'} className={'rounded-full px-2 py-1 text-[10px] font-bold sm:px-3 sm:text-xs '+(language==='en'?'bg-[#ed174c] text-white':'text-[#a52049]')}>EN</button>
        </div>
      </header>
      {!survey ? <div className="p-6"><StatusView status={status as LinkProblem} language={language} /></div>
      : already ? <div className="p-6"><StatusView status="already_submitted" language={language} /></div>
      : done ? <div className="px-8 py-16 text-center"><div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full bg-[#e0f6e6] text-[#24944b]"><Check size={40} strokeWidth={3} /></div><h1 className="text-2xl font-extrabold">{t("Jawaban terkirim!")}</h1><p className="mt-4 text-sm leading-7 text-[#6d7590]">{t(thankYou)}</p>{demo && <p className="mt-5 text-xs font-semibold text-[#c31349]">{t("Mode demo: jawaban tidak tersimpan.")}</p>}</div>
      : <>
        <div className="mx-auto w-full max-w-[600px] shrink-0 px-5 pb-2 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label={t("Kembali")} onClick={() => { if (step > 1 && !busy) { setStep(1); setError('') } }} disabled={step === 1 || busy} className="rounded-lg p-1 text-[#c31349] disabled:opacity-20"><ChevronLeft size={23} /></button>
            <span className="text-base font-extrabold">{String(step).padStart(2, '0')} <span className="text-[#a7afc1]">/ {direct ? '01' : '02'}</span></span><div className="w-7" />
          </div>
          <div className="flex gap-1.5">{Array.from({ length: direct ? 1 : 2 }, (_, i) => <div key={i} className={'h-1 flex-1 rounded-full ' + (i + 1 <= step ? 'bg-[#ed174c]' : 'bg-[#f7dce6]')} />)}</div>
        </div>
        <div className="mx-auto min-h-0 w-full max-w-[600px] flex-1 overflow-y-auto px-6 pb-8 pt-3">
          <h1 className="text-[clamp(17px,2.8vh,23px)] font-extrabold leading-snug tracking-tight">
            {t(step === 1 ? 'Apa alasan penggunaan internet HiFi Anda sedang berkurang?' : reason === 'network_issue' ? 'Apakah Anda membutuhkan bantuan terkait koneksi internet?' : reason === 'other' ? 'Alasan Lainnya' : 'Apakah Anda ingin mendapatkan informasi tentang Freeze Bill?')}
          </h1>
          <p className="mt-2 text-[12px] leading-[1.45] text-[#7a8299]">
            {t(step === 1 ? 'Pilih satu jawaban yang paling sesuai dengan kondisi Anda.' : reason === 'network_issue' ? 'Tim HiFi dapat membantu melakukan pengecekan koneksi berdasarkan permintaan Anda.' : reason === 'other' ? 'Tuliskan alasan Anda secara singkat.' : 'Freeze Bill merupakan pilihan layanan bagi pelanggan tertentu sesuai ketentuan yang berlaku. Memilih Ya hanya mencatat minat untuk mendapatkan informasi; tagihan tidak otomatis dibekukan.')}
          </p>
          <div className="mt-3 space-y-2 rounded-2xl bg-[#ed174c] p-3">
            {step === 1 && REASONS.map((item, i) => choice(item.id, t(item.title), reason === item.id, () => choose(item.id), i, reason !== null && reason !== item.id))}
            {step === 1 && reason === 'other' && <div className="rounded-xl bg-white p-3"><label htmlFor="other-reason" className="mb-2 block text-xs font-bold text-[#30202a]">{t("Silakan tuliskan alasan lainnya")}</label><textarea id="other-reason" className={inputStyle} rows={3} maxLength={500} value={answers.other} onChange={e => set('other', e.target.value)} placeholder={t("Ceritakan alasan Anda...")} /><p className="mt-1 text-right text-xs text-[#7a8299]">{answers.other.length}/500</p></div>}
            {step === 2 && reason === 'network_issue' && ['Ya', 'Tidak'].map((v, i) => choice(v, t(v === 'Ya' ? 'Ya, saya butuh bantuan' : 'Tidak, terima kasih'), answers.ticket === v, () => set('ticket', v), i, !!answers.ticket && answers.ticket !== v))}
            {step === 2 && reason !== null && freezeReasons.includes(reason) && ['Ya', 'Tidak'].map((v, i) => choice(v, t(v === 'Ya' ? 'Ya, saya ingin informasi Freeze Bill' : 'Tidak, terima kasih'), answers.freeze === v, () => set('freeze', v), i, !!answers.freeze && answers.freeze !== v))}
            {step === 1 && <button type="button" disabled={!reason || busy || (reason === 'other' && !ready)} onClick={() => { if (!reason) return; if (reason === 'no_issue' || reason === 'other') void submit(reason); else setStep(2) }} className="mt-2 flex min-h-[43px] w-full items-center justify-center gap-2 rounded-full bg-[#641634] px-3 text-[13px] font-bold text-white transition hover:bg-[#481026] disabled:cursor-not-allowed disabled:opacity-45">{busy ? <><Loader2 size={17} className="animate-spin" />{t('Mengirim...')}</> : direct ? t('Kirim jawaban') : t('Lanjutkan')}</button>}
            {step === 2 && reason && <button type="button" onClick={() => void submit(reason)} disabled={!ready || busy} className="mt-2 flex min-h-[43px] w-full items-center justify-center gap-2 rounded-full bg-[#641634] px-3 text-[13px] font-bold text-white transition hover:bg-[#481026] disabled:cursor-not-allowed disabled:opacity-45">{busy ? <><Loader2 size={17} className="animate-spin" />{t('Mengirim...')}</> : t('Kirim jawaban')}</button>}
            {error && <p role="alert" className="flex items-start gap-2 rounded-lg bg-white p-3 text-xs font-semibold text-red-700"><AlertCircle size={16} className="shrink-0" />{t(error)}</p>}
          </div>
        </div>
      </>}
    </div>
  </div>
}
