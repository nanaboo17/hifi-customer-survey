'use client'
import { useState } from 'react'
import { ChevronLeft, Check, Loader2, AlertCircle } from 'lucide-react'
import { REASONS, type Reason } from '@/lib/survey'
import { StatusView, type LinkProblem } from '@/components/survey/status-view'

export type SurveyStatus = 'valid' | 'demo' | LinkProblem
type Answers={ticket:string;provider:string;price:string;continueHifi:string;freeze:string;duration:string;other:string}
const initial:Answers={ticket:'',provider:'',price:'',continueHifi:'',freeze:'',duration:'',other:''}

export default function SurveyPage({status,token}:{status:SurveyStatus;token:string}){
 const [reason,setReason]=useState<Reason|null>(null)
 const [answers,setAnswers]=useState<Answers>(initial)
 const [step,setStep]=useState(1)
 const [busy,setBusy]=useState(false)
 const [done,setDone]=useState(false)
 const [already,setAlready]=useState(false)
 const [error,setError]=useState('')
 const [thankYou,setThankYou]=useState('Terima kasih sudah meluangkan waktu. Jawaban Anda membantu kami meningkatkan layanan HiFi.')
 const demo=status==='demo'
 const survey=status==='valid'||demo
 const set=(key:keyof Answers,value:string)=>{setAnswers(a=>({...a,[key]:value}));setError('')}
 const ready=reason==='network_issue'?Boolean(answers.ticket):reason==='other_provider'?Boolean(answers.provider.trim()&&answers.price.trim()&&Number(answers.price)>0&&answers.continueHifi):reason==='no_longer_needed'?Boolean(answers.freeze&&answers.duration.trim()):reason==='other'?answers.other.trim().length>=3:true
 function notes(r:Reason){
  if(r==='network_issue')return 'Buat tiket: '+answers.ticket
  if(r==='other_provider')return 'Provider: '+answers.provider.trim().replace(/[;\n]/g,' ')+ '; Harga: '+answers.price.replace(/\D/g,'')+'; Lanjut HiFi: '+answers.continueHifi
  if(r==='no_longer_needed')return 'Minta informasi freeze tagihan: '+answers.freeze+'; Durasi: '+answers.duration.trim().replace(/[;\n]/g,' ')
  if(r==='other')return answers.other.trim()
  return null
 }
 async function submit(r:Reason){
  if(busy)return
  setBusy(true);setError('')
  try{
   if(demo){await new Promise(resolve=>setTimeout(resolve,450))}
   else{
    const response=await fetch('/api/survey',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,reason:r,details:notes(r)})})
    const body=await response.json().catch(()=>({})) as {error?:string}
    if(response.status===409){setAlready(true);return}
    if(!response.ok)throw Error(body.error||'Gagal menyimpan jawaban.')
   }
   setThankYou(r==='no_longer_needed'?'Terima kasih. Permintaan informasi Anda sudah dicatat. Tim HiFi akan menghubungi Anda untuk menjelaskan pilihan yang tersedia.':r==='network_issue'&&answers.ticket==='Ya'?'Terima kasih. Permintaan bantuan tiket gangguan sudah dicatat. Tim kami akan menindaklanjutinya.':'Terima kasih sudah meluangkan waktu. Jawaban Anda membantu kami meningkatkan layanan HiFi.')
   setDone(true)
  }catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan jawaban. Silakan coba lagi.')}finally{setBusy(false)}
 }
 function choose(r:Reason){
  setReason(r);setAnswers(initial);setError('')
  if(r==='away_from_home'){void submit(r)}else setStep(2)
 }
 const choice=(value:string,label:string,active:boolean,action:()=>void,index:number)=> <button key={value} type="button" onClick={action} disabled={busy} className={'flex min-h-[54px] w-full items-center gap-3 rounded-full border-2 px-4 py-3 text-left text-sm font-semibold transition '+(active?'border-[#163c99] bg-[#dce7ff] text-[#153b9a] ring-2 ring-white':'border-white bg-white text-[#235be2] hover:bg-[#edf3ff]')}><span className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold '+(active?'bg-[#2d63f4] text-white':'bg-[#edf2ff] text-[#1f3180]')}>{active?<Check size={16}/>:String.fromCharCode(65+index)}</span>{label}</button>
 const inputStyle='w-full rounded-xl border border-[#ccd7ef] bg-white p-3 text-sm text-[#17223f] outline-none focus:border-[#2f6bff] focus:ring-2 focus:ring-[#bdd0ff]'
 return <div className="min-h-screen bg-[#eef5ff] px-3 py-7 text-[#111d3e] sm:px-6 sm:py-12">
  <div className="mx-auto w-full max-w-[440px] overflow-hidden rounded-[26px] border border-[#dbe5fb] bg-white shadow-[0_18px_65px_rgba(38,91,188,0.16)]">
   <div className="h-4 bg-[#2f6bff]"/>
   <header className="flex h-[68px] items-center justify-between border-b border-[#e9eef7] px-6">
    <img src="/images/indosat-wordmark.svg" alt="Indosat Ooredoo Hutchison" className="h-auto w-[112px]"/>
    <span className="text-xs font-bold text-[#2f6bff]">Survei HiFi</span>
   </header>
   {!survey?<div className="p-6"><StatusView status={status as LinkProblem}/></div>:already?<div className="p-6"><StatusView status="already_submitted"/></div>:done?<div className="px-8 py-16 text-center"><div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full bg-[#e0f6e6] text-[#24944b]"><Check size={40} strokeWidth={3}/></div><h1 className="text-2xl font-extrabold">Jawaban terkirim!</h1><p className="mt-4 text-sm leading-7 text-[#6d7590]">{thankYou}</p>{demo&&<p className="mt-5 text-xs font-semibold text-[#2f6bff]">Mode demo: jawaban tidak tersimpan.</p>}</div>:<>
    <div className="px-6 pb-5 pt-6">
     <div className="mb-4 flex items-center justify-between">
      <button type="button" aria-label="Kembali" onClick={()=>{if(step>1&&!busy){setStep(1);setError('')}}} disabled={step===1||busy} className="rounded-lg p-1 text-[#2f6bff] disabled:opacity-20"><ChevronLeft size={23}/></button>
      <span className="text-base font-extrabold">{String(step).padStart(2,'0')} <span className="text-[#a7afc1]">/ {reason==='away_from_home'?'01':'02'}</span></span>
      <div className="w-7"/>
     </div>
     <div className="flex gap-1.5">{[1,2].map(n=><div key={n} className={'h-1 flex-1 rounded-full '+(n<=step?'bg-[#2f6bff]':'bg-[#dce5fb]')}/>)}</div>
    </div>
    <div className="min-h-[240px] px-7 pb-9 pt-5">
     <h1 className="text-[24px] font-extrabold leading-snug tracking-tight">{step===1?'Apa alasan utama penggunaan internet Anda menurun?':reason==='network_issue'?'Mau kami bantu buat tiket gangguan?':reason==='other_provider'?'Boleh tahu provider lain yang digunakan?':reason==='no_longer_needed'?'Ingin tahu pilihan jeda tagihan sementara?':'Apa alasan lainnya?'}</h1>
     <p className="mt-4 text-sm leading-6 text-[#7a8299]">{step===1?'Pilih satu jawaban yang paling sesuai dengan kondisi Anda.':reason==='network_issue'?'Kami bisa mencatat permintaan bantuan agar tim HiFi dapat menindaklanjuti.':reason==='other_provider'?'Ceritakan provider dan harga paketnya, serta apakah Anda akan melanjutkan HiFi.':reason==='no_longer_needed'?'Jawaban ini hanya mencatat minat Anda, bukan otomatis membekukan tagihan. Tim kami akan menghubungi Anda.':'Tuliskan alasan Anda secara singkat.'}</p>
     {step===2&&reason==='other_provider'&&<div className="mt-6 grid gap-3"><label className="text-xs font-bold">Nama provider<input className={'mt-1 '+inputStyle} value={answers.provider} maxLength={75} onChange={e=>set('provider',e.target.value)} placeholder="Contoh: Biznet"/></label><label className="text-xs font-bold">Harga paket per bulan (Rp)<input className={'mt-1 '+inputStyle} type="number" min="1" value={answers.price} onChange={e=>set('price',e.target.value)} placeholder="Contoh: 300000"/></label></div>}
     {step===2&&reason==='no_longer_needed'&&<div className="mt-6"><label className="text-xs font-bold">Perkiraan berapa lama tidak digunakan?<input className={'mt-1 '+inputStyle} value={answers.duration} maxLength={100} onChange={e=>set('duration',e.target.value)} placeholder="Contoh: 2 bulan"/></label></div>}
     {step===2&&reason==='other'&&<div className="mt-6"><textarea aria-label="Alasan lainnya" className={inputStyle} rows={4} maxLength={500} value={answers.other} onChange={e=>set('other',e.target.value)} placeholder="Ceritakan alasan Anda..."/><p className="mt-2 text-right text-xs text-[#7a8299]">{answers.other.length}/500</p></div>}
    </div>
    <div className="space-y-3 bg-[#2f6bff] px-6 py-8">
     {step===1&&REASONS.map((item,i)=>choice(item.id,item.title,false,()=>choose(item.id),i))}
     {step===2&&reason==='network_issue'&&['Ya','Tidak'].map((v,i)=>choice(v,v==='Ya'?'Ya, bantu buat tiket':'Tidak, terima kasih',answers.ticket===v,()=>set('ticket',v),i))}
     {step===2&&reason==='other_provider'&&<><p className="pb-1 text-sm font-bold text-white">Apakah tetap akan menggunakan HiFi?</p>{['Ya','Tidak'].map((v,i)=>choice(v,v==='Ya'?'Ya, tetap menggunakan HiFi':'Tidak, tidak melanjutkan',answers.continueHifi===v,()=>set('continueHifi',v),i))}</>}
     {step===2&&reason==='no_longer_needed'&&<><p className="pb-1 text-sm font-bold text-white">Ingin dihubungi untuk informasi freeze tagihan?</p>{['Ya','Tidak'].map((v,i)=>choice(v,v==='Ya'?'Ya, hubungi saya':'Tidak, terima kasih',answers.freeze===v,()=>set('freeze',v),i))}</>}
     {step===2&&reason&&<button type="button" onClick={()=>void submit(reason)} disabled={!ready||busy} className="mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#132b69] px-4 text-sm font-bold text-white transition hover:bg-[#102251] disabled:cursor-not-allowed disabled:opacity-45">{busy?<><Loader2 size={17} className="animate-spin"/>Mengirim...</>:'Kirim jawaban'}</button>}
     {error&&<p role="alert" className="flex items-start gap-2 rounded-lg bg-white p-3 text-xs font-semibold text-red-700"><AlertCircle size={16} className="shrink-0"/>{error}</p>}
    </div>
   </>}
  </div>
 </div>
}
