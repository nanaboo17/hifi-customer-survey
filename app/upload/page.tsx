'use client'
import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, UploadCloud, AlertCircle, CheckCircle2, PauseCircle } from 'lucide-react'
import { parseBulk, type BulkCustomer } from '@/lib/bulk-client-parser'

type Job = {id:string;file_name:string;header_image_url:string;total_customers:number;total_batches:number;status:'uploading'|'ready'|'processing'|'complete'}
type Stats = {total:number;batches:number;uploaded:number;processed:number;created:number;reused:number;skipped:number}
type Status = {job:Job;stats:Stats;export_parts:number}

const storageKey = 'hifi_bulk_job_id'
const langKey = 'hifi_admin_language'
type Lang = 'id' | 'en'
const english: Record<string,string> = {
  "Upload Pelanggan": "Customer Upload",
  "Upload pelanggan hingga 500.000 dalam satu halaman · CSV/XLSX maksimal 100 MB · pemrosesan otomatis per 500 pelanggan": "Upload up to 500,000 customers on one page · CSV/XLSX up to 100 MB · automatic batches of 500",
  "Memeriksa sesi admin...": "Checking admin session...",
  "Login Admin": "Admin Login",
  "Password admin": "Admin password",
  "Masuk": "Log in",
  "Campaign baru": "New campaign",
  "Nama file:": "File name:",
  "Status:": "Status:",
  "Unggah satu file untuk membuat campaign baru. Semua batch disimpan di Supabase agar dapat dilanjutkan setelah refresh.": "Upload one file to create a campaign. All batches are saved in Supabase so you can resume after refreshing.",
  "Membaca file...": "Reading file...",
  "Pilih file CSV / XLSX hingga 100 MB": "Choose CSV / XLSX file up to 100 MB",
  "Untuk 500.000 baris, CSV lebih ringan dan disarankan menggunakan desktop.": "For 500,000 rows, CSV is more efficient. A desktop browser is recommended.",
  "pelanggan siap diproses": "customers ready to process",
  "Sudah punya Campaign ID?": "Already have a Campaign ID?",
  "Masukkan Campaign ID untuk resume": "Enter Campaign ID to resume",
  "Buka campaign": "Open campaign",
  "URL gambar header KATA (HTTPS)": "KATA header image URL (HTTPS)",
  "Batch data tersimpan": "Uploaded batches",
  "Batch diproses": "Processed batches",
  "Link baru": "New links",
  "Digunakan lagi": "Reused links",
  "Dilewati": "Skipped",
  "Memproses...": "Processing...",
  "Lanjutkan proses": "Resume processing",
  "Mulai campaign": "Start campaign",
  "Jeda": "Pause",
  "Proses berjalan selama halaman terbuka; Anda dapat menjeda atau melanjutkan campaign dengan ID tersimpan. Untuk pemrosesan tanpa browser terbuka, diperlukan worker terjadwal tambahan.": "Processing continues while this page is open. You can pause or resume using the saved campaign ID. Processing with the browser closed requires a separately configured scheduled worker.",
  "Pelanggan dilewati — unduh laporan alasan:": "Skipped customers — download reason reports:",
  "Gagal memproses data": "Failed to process data",
  "Gagal membaca campaign": "Failed to load campaign",
  "Tidak dapat mengecek sesi admin": "Unable to check admin session",
  "Masukkan Campaign ID yang valid": "Enter a valid Campaign ID",
  "Campaign berhasil ditemukan. Lanjutkan dari progress tersimpan.": "Campaign found. Resume from your saved progress.",
  "Campaign tidak ditemukan": "Campaign not found",
  "Password tidak valid": "Invalid password",
  "Gagal login": "Login failed",
  "Untuk melanjutkan upload yang tersimpan, pilih file yang sama atau buat campaign baru.": "To resume this upload, select the original file or create a new campaign.",
  " pelanggan valid. Siap diproses.": " valid customers. Ready to process.",
  "Gagal membaca file": "Unable to read file",
  "Pilih file terlebih dahulu": "Select a file first",
  "Masukkan URL gambar header HTTPS": "Enter an HTTPS header image URL",
  "Campaign belum siap": "Campaign is not ready",
  "Pilih ulang file awal untuk melanjutkan upload": "Select the original file again to resume uploading",
  "File berbeda dari campaign yang tersimpan": "This file does not match the saved campaign",
  "Dihentikan. Progress tersimpan; bisa dilanjutkan.": "Paused. Progress is saved and can be resumed.",
  "Ada batch yang sedang diproses. Coba lanjutkan kembali sebentar lagi.": "Another batch is being processed. Try resuming shortly.",
  "Proses dihentikan sementara. Klik Lanjutkan untuk memproses sisa batch.": "Processing paused. Click Resume to continue with the remaining batches.",
  "Selesai! Unduh semua bagian CSV untuk diunggah ke KATA.": "Complete! Download all CSV parts for KATA.",
  "Gagal memproses. Progress sudah tersimpan; silakan coba kembali.": "Processing failed. Your progress is saved; please try again.",
  "Gagal refresh": "Refresh failed"
}
const translate = (value:string,lang:Lang) => lang==='en'?(english[value]||value):value
const translateParserError = (value:string,lang:Lang) => {
 if(lang==='id') return value
 const exact:Record<string,string> = {
  'Maksimal ukuran file 100 MB':'Maximum file size is 100 MB',
  'Gunakan CSV atau XLSX':'Use a CSV or XLSX file',
  'File kosong':'The file is empty',
  'Kolom customer_id, customer_name, dan phone_number wajib ada':'Required columns: customer_id, customer_name, phone_number',
  'File XLSX tidak valid':'Invalid XLSX file',
  'File Excel terlalu besar':'Excel file is too large',
  'Kompresi XLSX tidak didukung':'XLSX compression is not supported',
  'Worksheet tidak ditemukan':'Excel worksheet not found',
  'Tidak ada pelanggan dalam file':'No customers found in the file',
  'CSV memiliki tanda kutip tidak tertutup':'CSV contains an unclosed quotation mark',
  'Maksimal 500.000 pelanggan':'Maximum 500,000 customers'
 }
 if(exact[value])return exact[value]
 if(value.startsWith('Customer ID duplikat'))return value.replace('Customer ID duplikat pada file:','Duplicate customer ID:').replace('Customer ID duplikat:','Duplicate customer ID:')
 if(value.startsWith('Kolom kosong pada baris '))return value.replace('Kolom kosong pada baris ','Missing required data on row ')
 if(value.startsWith('Customer ID, nama, atau nomor telepon tidak valid pada baris '))return value.replace('Customer ID, nama, atau nomor telepon tidak valid pada baris ','Invalid customer ID, name, or phone number on row ')
 return value
}
const translateServerError=(value:string,lang:Lang)=>lang==='en' ? ({'Tidak diizinkan':'Access denied','Password salah.':'Incorrect password.',"Campaign tidak ditemukan":'Campaign not found','Batch terlalu besar':'Batch is too large','Request tidak valid':'Invalid request','Campaign belum selesai diproses':'Campaign processing is not complete'} as Record<string,string>)[value]||value : value
async function request(body:Record<string,unknown>) {
 const r=await fetch('/api/upload/bulk',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 const data=await r.json().catch(()=>({})) as Record<string,unknown>
 if(!r.ok)throw Error(String(data.error||'Gagal memproses data'))
 return data
}
async function fetchStatus(jobId:string):Promise<Status> {
 const r=await fetch('/api/upload/bulk?job='+encodeURIComponent(jobId),{credentials:'same-origin',cache:'no-store'})
 const data=await r.json().catch(()=>({}))
 if(!r.ok)throw Error(data.error||'Gagal membaca campaign')
 return data as Status
}
function Progress({label,value,max,lang}:{label:string;value:number;max:number;lang:Lang}) {
 return <div className="space-y-2"><div className="flex justify-between gap-3 text-sm font-bold"><span>{label}</span><span>{value.toLocaleString(lang==='en'?'en-US':'id-ID')} / {max.toLocaleString(lang==='en'?'en-US':'id-ID')}</span></div>
  <div className="h-3 overflow-hidden rounded-full bg-[#ece6f5]"><div className="h-full rounded-full bg-[#ed174c] transition-all" style={{width:Math.max(0,Math.min(100,max?value/max*100:0))+'%'}}/></div></div>
}

export default function UploadPage(){
 const [lang,setLang]=useState<Lang>('id')
 const t=(value:string)=>translate(value,lang)
 const num=(value:number)=>value.toLocaleString(lang==='en'?'en-US':'id-ID')
 const [logged,setLogged]=useState(false)
 const [checking,setChecking]=useState(true)
 const [password,setPassword]=useState('')
 const [file,setFile]=useState<File|null>(null)
 const [rows,setRows]=useState<BulkCustomer[]>([])
 const [parsing,setParsing]=useState(false)
 const [imageUrl,setImageUrl]=useState('')
 const [resumeId,setResumeId]=useState('')
 const [status,setStatus]=useState<Status|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const stop=useRef(false)

 async function refresh(id?:string){
  const key=id||status?.job.id
  if(!key)return
  const next=await fetchStatus(key)
  setStatus(next)
  setImageUrl(next.job.header_image_url)
  return next
 }
 useEffect(()=>{try{const saved=localStorage.getItem(langKey);if(saved==='id'||saved==='en')setLang(saved)}catch{}},[])
 const changeLang=(value:Lang)=>{setLang(value);try{localStorage.setItem(langKey,value)}catch{}}
 useEffect(()=>{
  let active=true
  ;(async()=>{
   try {
    const r=await fetch('/api/upload/session',{cache:'no-store'})
    const session=await r.json()
    if(!active)return
    setLogged(!!session.authenticated)
    if(session.authenticated){
     const id=localStorage.getItem(storageKey)
     if(id) {
      try{const s=await fetchStatus(id);if(active){setStatus(s);setImageUrl(s.job.header_image_url)}}
      catch{localStorage.removeItem(storageKey)}
     }
    }
   }catch{if(active)setError(t("Tidak dapat mengecek sesi admin"))}
   finally{if(active)setChecking(false)}
  })()
  return()=>{active=false}
 },[])
 async function resumeCampaign(){
  setError('');setMessage('')
  try {
   const id=resumeId.trim()
   if(!/^[0-9a-f-]{36}$/i.test(id))throw Error(t("Masukkan Campaign ID yang valid"))
   const next=await fetchStatus(id)
   localStorage.setItem(storageKey,id)
   setStatus(next);setImageUrl(next.job.header_image_url);setRows([]);setFile(null)
   setMessage(t("Campaign berhasil ditemukan. Lanjutkan dari progress tersimpan."))
  }catch(e){setError(e instanceof Error?translateServerError(e.message,lang):t("Campaign tidak ditemukan"))}
 }
 async function login(){
  setBusy(true);setError('')
  try{
   const r=await fetch('/api/upload/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})})
   const d=await r.json()
   if(!r.ok)throw Error(d.error||t("Password tidak valid"))
   setPassword('');setLogged(true)
   const id=localStorage.getItem(storageKey)
   if(id){try{await refresh(id)}catch{localStorage.removeItem(storageKey)}}
  }catch(e){setError(e instanceof Error?translateServerError(e.message,lang):t("Gagal login"))}finally{setBusy(false)}
 }
 async function selectFile(selected:File|undefined) {
  if(!selected)return
  setParsing(true);setError('');setMessage('');setRows([]);setFile(null)
  try {
   const data=await parseBulk(selected)
   if(status?.job.status==='uploading'&&(data.length!==status.job.total_customers||selected.name!==status.job.file_name))
    throw Error(t("Untuk melanjutkan upload yang tersimpan, pilih file yang sama atau buat campaign baru."))
   setRows(data);setFile(selected);setMessage(num(data.length)+t(" pelanggan valid. Siap diproses."))
  }catch(e){setError(e instanceof Error?translateParserError(e.message,lang):t("Gagal membaca file"))}
  finally{setParsing(false)}
 }
 async function run(){
  if(busy)return
  stop.current=false;setBusy(true);setError('');setMessage('')
  try {
   let s=status,jobId=s?.job.id
   if(!jobId){
    if(!file||!rows.length)throw Error(t("Pilih file terlebih dahulu"))
    if(!/^https:\/\/[^\s]+$/.test(imageUrl))throw Error(t("Masukkan URL gambar header HTTPS"))
    const created=await request({action:'create',filename:file.name,total:rows.length,header_image_url:imageUrl})
    jobId=String(created.job_id)
    localStorage.setItem(storageKey,jobId)
    s=await fetchStatus(jobId);setStatus(s)
   }
   if(!s)throw Error(t("Campaign belum siap"))
   if(s.job.status==='uploading'){
    if(!rows.length||!file)throw Error(t("Pilih ulang file awal untuk melanjutkan upload"))
    if(rows.length!==s.job.total_customers||file.name!==s.job.file_name)throw Error(t("File berbeda dari campaign yang tersimpan"))
    for(let i=0;i<s.job.total_batches;i++){
     if(stop.current){setMessage(t("Dihentikan. Progress tersimpan; bisa dilanjutkan."));return}
     await request({action:'append',job_id:jobId,index:i,customers:rows.slice(i*500,(i+1)*500)})
     if((i+1)%10===0||i===s.job.total_batches-1){
      s=await fetchStatus(jobId);setStatus(s)
     }
    }
    await request({action:'finish',job_id:jobId})
    s=await fetchStatus(jobId);setStatus(s)
    setRows([]);setFile(null)
   }
   if(s.job.status!=='complete'){
    // Each request claims and processes one durable batch; safe to resume after network interruption.
    let waiting=0
    while(!stop.current){
     const output=await request({action:'process',job_id:jobId})
     if(output.complete){s=await fetchStatus(jobId);setStatus(s);break}
     if(output.busy){
      waiting++
      if(waiting>=4){s=await fetchStatus(jobId);setStatus(s);setMessage(t("Ada batch yang sedang diproses. Coba lanjutkan kembali sebentar lagi."));break}
      await new Promise(resolve=>setTimeout(resolve,1000))
     }else waiting=0
     if(output.processed||waiting){s=await fetchStatus(jobId);setStatus(s)}
     if(s.job.status==='complete')break
    }
   }
   if(stop.current)setMessage(t("Proses dihentikan sementara. Klik Lanjutkan untuk memproses sisa batch."))
   else if(s?.job.status==='complete')setMessage(t("Selesai! Unduh semua bagian CSV untuk diunggah ke KATA."))
  }catch(e){setError(e instanceof Error?translateServerError(e.message,lang):t("Gagal memproses. Progress sudah tersimpan; silakan coba kembali."))}
  finally{setBusy(false)}
 }
 function newCampaign(){
  if(busy)return
  stop.current=true;localStorage.removeItem(storageKey);setStatus(null);setFile(null);setRows([]);setImageUrl('');setError('');setMessage('')
 }
 const uploaded=status?.stats.uploaded||0,processed=status?.stats.processed||0,total=status?.job.total_batches||0
 const percent=total?Math.round(processed/total*100):0
 return <main className="min-h-screen bg-[#f7f3f7] px-4 py-8 text-[#28152e]">
  <div className="mx-auto max-w-3xl space-y-6">
   <div className="flex justify-end"><div className="inline-flex rounded-lg border border-[#e5d9e5] bg-white p-1" role="group" aria-label="Language / Bahasa"><button type="button" onClick={()=>changeLang('id')} aria-pressed={lang==='id'} className={'rounded-md px-4 py-2 text-sm font-bold '+(lang==='id'?'bg-[#ed174c] text-white':'text-[#6e6170]')}>Indonesia</button><button type="button" onClick={()=>changeLang('en')} aria-pressed={lang==='en'} className={'rounded-md px-4 py-2 text-sm font-bold '+(lang==='en'?'bg-[#ed174c] text-white':'text-[#6e6170]')}>English</button></div></div>
   <div className="rounded-2xl bg-[#ed174c] p-6 text-white sm:p-8"><p className="text-xs font-bold tracking-widest">HIFI SURVEY STUDIO</p><h1 className="mt-2 text-3xl font-black">{t("Upload Pelanggan")}</h1><p className="mt-2 text-sm">{t("Upload pelanggan hingga 500.000 dalam satu halaman · CSV/XLSX maksimal 100 MB · pemrosesan otomatis per 500 pelanggan")}</p></div>
   {checking?<p>{t("Memeriksa sesi admin...")}</p>:!logged?
    <form onSubmit={e=>{e.preventDefault();void login()}} className="rounded-xl bg-white p-6 shadow-sm">
     <h2 className="mb-3 text-lg font-bold">{t("Login Admin")}</h2>
     <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder={t("Password admin")} className="w-full rounded-lg border p-3"/>
     <button disabled={busy} className="mt-3 w-full rounded-lg bg-[#ed174c] px-4 py-3 font-bold text-white">{t("Masuk")}</button>
    </form>:
    <>
     <section className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">1. Campaign</h2>{status&&<div className="flex gap-2"><button onClick={()=>void refresh().catch(e=>setError(e instanceof Error?translateServerError(e.message,lang):t("Gagal refresh")))} disabled={busy} className="rounded-lg border px-3 py-2 text-sm font-semibold">Refresh</button><button onClick={newCampaign} disabled={busy} className="rounded-lg border px-3 py-2 text-sm font-semibold">{t("Campaign baru")}</button></div>}</div>
      {status?<div className="space-y-1 text-sm"><p><strong>{t("Nama file:")}</strong> {status.job.file_name}</p><p><strong>Campaign ID:</strong> <span className="break-all">{status.job.id}</span></p><p><strong>{t("Status:")}</strong> {status.job.status}</p></div>:
       <p className="text-sm text-[#746a76]">{t("Unggah satu file untuk membuat campaign baru. Semua batch disimpan di Supabase agar dapat dilanjutkan setelah refresh.")}</p>}
      {(status?.job.status==='uploading'||!status)&&<>
       <label className="block cursor-pointer rounded-xl border-2 border-dashed border-[#cebdca] bg-[#fdf9fc] px-5 py-8 text-center">
        <UploadCloud className="mx-auto mb-3" size={32}/>
        <span className="block text-sm font-bold">{parsing?t("Membaca file..."):file?file.name:t("Pilih file CSV / XLSX hingga 100 MB")}</span>
        <span className="mt-2 block text-xs text-[#827687]">{t("Untuk 500.000 baris, CSV lebih ringan dan disarankan menggunakan desktop.")}</span>
        <input type="file" accept=".csv,.xlsx" className="sr-only" disabled={parsing||busy} onChange={e=>void selectFile(e.target.files?.[0])}/>
       </label>
       <p className="text-sm font-semibold">{rows.length?num(rows.length)+' '+t('pelanggan siap diproses'):''}</p>
      </>}
      {!status&&<div className="rounded-lg border border-[#e7dce7] bg-[#fcf9fc] p-3"><label htmlFor="resume-id" className="mb-2 block text-sm font-bold">{t("Sudah punya Campaign ID?")}</label><div className="flex flex-wrap gap-2"><input id="resume-id" value={resumeId} onChange={e=>setResumeId(e.target.value)} placeholder={t("Masukkan Campaign ID untuk resume")} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"/><button type="button" onClick={()=>void resumeCampaign()} className="rounded-lg bg-[#4924ac] px-3 py-2 text-sm font-semibold text-white">{t("Buka campaign")}</button></div></div>}
      {!status&&<div><label htmlFor="bulk-image" className="mb-1 block text-sm font-bold">{t("URL gambar header KATA (HTTPS)")}</label><input id="bulk-image" type="url" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://example.com/hifi-banner.jpg" className="w-full rounded-lg border p-3 text-sm"/></div>}
     </section>
     <section className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">{lang==='en'?'2. Upload & Generate Links':'2. Upload & Generate Link'}</h2>
      {status&&<><Progress label={t('Batch data tersimpan')} lang={lang} value={uploaded} max={total}/><Progress label={t('Batch diproses')} lang={lang} value={processed} max={total}/>
       <div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-lg bg-[#f2f5ff] p-3"><strong className="block text-xl">{num(status.stats.created)}</strong>{t("Link baru")}</div><div className="rounded-lg bg-[#f2f5ff] p-3"><strong className="block text-xl">{num(status.stats.reused)}</strong>{t("Digunakan lagi")}</div><div className="rounded-lg bg-[#fff3f3] p-3"><strong className="block text-xl">{num(status.stats.skipped)}</strong>{t("Dilewati")}</div></div>
       <p className="text-sm text-[#706577]">{percent}% {lang==='en'?'complete · Progress saved in database':'selesai · Progres tersimpan di database'}</p>
      </>}
      {status?.job.status!=='complete'&&<div className="flex gap-3"><button onClick={()=>void run()} disabled={busy?true:!status&&(!file||!rows.length||!imageUrl.trim())} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#ed174c] px-4 py-3 font-bold text-white disabled:opacity-40">{busy?<><Loader2 className="animate-spin" size={19}/>{t("Memproses...")}</>:status?t('Lanjutkan proses'):t('Mulai campaign')}</button>{busy&&<button onClick={()=>{stop.current=true}} className="flex items-center gap-1 rounded-xl border px-3 py-2 font-semibold"><PauseCircle size={17}/>{t("Jeda")}</button>}</div>}
      <p className="text-xs text-[#756978]">{t("Proses berjalan selama halaman terbuka; Anda dapat menjeda atau melanjutkan campaign dengan ID tersimpan. Untuk pemrosesan tanpa browser terbuka, diperlukan worker terjadwal tambahan.")}</p>
     </section>
     {status?.job.status==='complete'&&<section className="rounded-xl bg-white p-6 shadow-sm"><h2 className="mb-3 text-xl font-bold">3. Download CSV KATA</h2><p className="mb-4 text-sm">{lang==='en'?`Download ${status.export_parts} CSV parts, each with up to 25,000 customers. Files contain KATA headers and website CTA tokens.`:`Unduh ${status.export_parts} bagian CSV, masing-masing hingga 25.000 pelanggan. File berisi header dan token website CTA untuk KATA.`}</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({length:status.export_parts},(_,i)=><a key={i} className="flex items-center justify-center gap-2 rounded-lg border border-[#ed174c] px-3 py-3 text-sm font-bold text-[#ad1244]" href={'/api/upload/bulk?mode=export&job='+status.job.id+'&part='+i} download><Download size={16}/>Part {i+1}</a>)}</div>{status.stats.skipped>0&&<div className="mt-5"><p className="mb-3 text-sm font-bold text-[#8d2636]">{t("Pelanggan dilewati — unduh laporan alasan:")}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({length:status.export_parts},(_,i)=><a key={i} className="rounded-lg bg-[#fff0f0] px-3 py-2 text-center text-xs font-bold text-[#962735]" href={'/api/upload/bulk?mode=errors&job='+status.job.id+'&part='+i} download>Errors Part {i+1}</a>)}</div></div>}</section>}
    </>
   }
   {error&&<p role="alert" className="flex items-start gap-2 rounded-lg bg-[#ffe7e7] p-4 text-sm font-semibold text-[#a22235]"><AlertCircle size={18}/>{error}</p>}
   {message&&<p role="status" className="flex items-start gap-2 rounded-lg bg-[#eff8f0] p-4 text-sm font-semibold text-[#266c37]"><CheckCircle2 size={18}/>{message}</p>}
  </div>
 </main>
}
