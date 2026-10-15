'use client'
import {useRef,useState} from 'react'
import {UploadCloud,FileSpreadsheet,FileCheck2,Download,ArrowRight,LockKeyhole,LogOut,CheckCircle2,AlertCircle,Loader2,ShieldCheck,ChevronRight,RefreshCw,Info,CloudUpload} from 'lucide-react'
type Customer={customer_id:string;phone_number:string}
function csv(text:string):string[][]{const first=text.split(/\r?\n/)[0];const delimiter=first.includes(';')&&!first.includes(',')?';':',';const rows:string[][]=[];let row:string[]=[],field='',quoted=false
for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else if(c==='"')quoted=true;else if(c===delimiter){row.push(field);field=''}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field=''}else field+=c}if(row.length||field){row.push(field);rows.push(row)}return rows.filter(x=>x.some(y=>y.trim()))}
async function xlsx(buffer:ArrayBuffer):Promise<string[][]>{
 const v=new DataView(buffer),bytes=new Uint8Array(buffer),decoder=new TextDecoder(),parts=new Map<string,string>()
 const u16=(i:number)=>v.getUint16(i,true),u32=(i:number)=>v.getUint32(i,true)
 let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(u32(i)===0x06054b50){eocd=i;break}}
 if(eocd<0)throw Error('File XLSX tidak valid')
 let pos=u32(eocd+16),total=0
 for(let i=0;i<u16(eocd+10);i++){
  if(u32(pos)!==0x02014b50)throw Error('ZIP directory tidak valid')
  const method=u16(pos+10),compressed=u32(pos+20),size=u32(pos+24),nameLength=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32),offset=u32(pos+42)
  const name=decoder.decode(bytes.slice(pos+46,pos+46+nameLength));pos+=46+nameLength+extra+comment
  if(name!=='xl/sharedStrings.xml'&&!/^xl\/worksheets\/sheet\d+\.xml$/.test(name))continue
  if(size>8000000||compressed>2000000||u32(offset)!==0x04034b50)throw Error('File Excel tidak didukung')
  const start=offset+30+u16(offset+26)+u16(offset+28),data=bytes.slice(start,start+compressed);let result:Uint8Array
  if(method===0)result=data
  else if(method===8){const out=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));result=new Uint8Array(await new Response(out).arrayBuffer())}
  else throw Error('Kompresi XLSX tidak didukung')
  total+=result.length;if(total>12000000)throw Error('File Excel terlalu besar')
  parts.set(name,decoder.decode(result))
 }
 const parse=(x:string)=>{const doc=new DOMParser().parseFromString(x,'application/xml');if(doc.querySelector('parsererror'))throw Error('XML Excel tidak valid');return doc}
 const strings=parts.get('xl/sharedStrings.xml')?Array.from(parse(parts.get('xl/sharedStrings.xml')!).getElementsByTagName('si')).map(x=>x.textContent||''):[]
 const sheet=[...parts.keys()].filter(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort()[0];if(!sheet)throw Error('Worksheet Excel tidak ditemukan')
 const rows=Array.from(parse(parts.get(sheet)!).getElementsByTagName('row'));if(rows.length>501)throw Error('Maksimal 500 pelanggan')
 return rows.map(r=>{const row:string[]=[];for(const c of Array.from(r.getElementsByTagName('c'))){const ref=c.getAttribute('r')?.match(/^[A-Z]+/)?.[0]||'A';let index=0;for(const char of ref)index=index*26+char.charCodeAt(0)-64;index--;if(index>30)continue;const raw=c.getElementsByTagName('v')[0]?.textContent||'';row[index]=c.getAttribute('t')==='s'?(strings[Number(raw)]||''):c.getAttribute('t')==='inlineStr'?(c.getElementsByTagName('is')[0]?.textContent||''):raw}return row})
}
function customers(rows:string[][]):Customer[]{if(rows.length<2)throw Error('File kosong');const h=rows[0].map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[\s-]+/g,'_'));const id=h.findIndex(x=>['customer_id','customerid','cust_id','id'].includes(x)),phone=h.findIndex(x=>['phone_number','phone','msisdn','no_hp','whatsapp'].includes(x));if(id<0||phone<0)throw Error('Kolom customer_id dan phone_number wajib ada');if(rows.length>501)throw Error('Maksimal 500 pelanggan');return rows.slice(1).map(x=>({customer_id:(x[id]||'').trim(),phone_number:(x[phone]||'').trim()}))}

export default function UploadPage(){
 const [pass,setPass]=useState('')
 const [logged,setLogged]=useState(false)
 const [list,setList]=useState<Customer[]>([])
 const [filename,setFilename]=useState('')
 const [busy,setBusy]=useState(false)
 const [parsing,setParsing]=useState(false)
 const [dragging,setDragging]=useState(false)
 const [error,setError]=useState('')
 const [csvText,setCsvText]=useState('')
 const [result,setResult]=useState('')
 const [success,setSuccess]=useState<{created:number;reused:number;skipped:number}|null>(null)
 const [showMore,setShowMore]=useState(false)
 const fileInput=useRef<HTMLInputElement>(null)

 async function login(){
   setBusy(true);setError('')
   try{
     const r=await fetch('/api/upload/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:pass})})
     const d=await r.json()
     if(!r.ok)throw Error(d.error)
     setLogged(true);setPass('')
   }catch(e){setError(e instanceof Error?e.message:'Gagal login')}finally{setBusy(false)}
 }
 async function fileChanged(file:File|undefined){
   setList([]);setCsvText('');setError('');setResult('');setSuccess(null)
   if(!file){setFilename('');return}
   setFilename(file.name);setParsing(true)
   try{
     if(file.size>2000000)throw Error('Ukuran file maksimal 2 MB.')
     const name=file.name.toLowerCase()
     const rows=name.endsWith('.csv')?csv(await file.text()):name.endsWith('.xlsx')?await xlsx(await file.arrayBuffer()):(()=>{throw Error('Gunakan file CSV atau Excel (.xlsx).')})()
     const parsed=customers(rows)
     if(!parsed.length)throw Error('Tidak ada pelanggan dalam file.')
     setList(parsed)
   }catch(e){setError(e instanceof Error?e.message:'Gagal membaca file.')}finally{setParsing(false)}
 }
 async function generate(){
   setBusy(true);setError('');setResult('');setCsvText('');setSuccess(null)
   try{
     const r=await fetch('/api/upload/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({customers:list})})
     const d=await r.json()
     if(!r.ok)throw Error(d.error)
     setCsvText(d.csv)
     setSuccess({created:d.created,reused:d.reused,skipped:d.skipped.length})
     setResult(d.skipped.length?d.skipped.slice(0,10).join('; '):'')
   }catch(e){setError(e instanceof Error?e.message:'Gagal membuat link.')}finally{setBusy(false)}
 }
 function download(name:string,content:string){
   const u=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}))
   const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove()
   setTimeout(()=>URL.revokeObjectURL(u),5000)
 }
 async function logout(){
   await fetch('/api/upload/logout',{method:'POST'})
   setLogged(false);setCsvText('');setList([]);setFilename('');setError('');setSuccess(null)
 }
 const hasFile=list.length>0
 const step=success?3:hasFile?2:1
 return <main className="min-h-screen bg-[#f7f9fd] text-slate-900">
   <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-rose-50/80 to-transparent"/>
   <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-8 sm:pt-9">
    <header className="flex items-center justify-between border-b border-slate-200/80 pb-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-16 items-center justify-center rounded-xl bg-[#ed174c] text-xl font-extrabold tracking-tight text-white shadow-sm">HiFi</div>
        <div className="hidden border-l border-slate-200 pl-3 sm:block"><p className="text-sm font-semibold">Survey Tools</p><p className="text-xs text-slate-500">Internal workspace</p></div>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"><ShieldCheck size={14} className="text-[#ed174c]"/> Staff only</span>
        {logged&&<button onClick={()=>void logout()} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><LogOut size={16}/> <span className="hidden sm:inline">Keluar</span></button>}
      </div>
    </header>
    <div className="pb-7 pt-10 sm:pb-9 sm:pt-12">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-rose-100/70 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[#b70c3a]">Customer engagement <span className="h-1 w-1 rounded-full bg-rose-400"/> Link generator</div>
      <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-[#17243b] sm:text-4xl">Generate Link <span className="text-[#ed174c]">Survei Pelanggan</span></h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">Siapkan link survei unik untuk setiap pelanggan HiFi. Upload data, cek hasilnya, lalu unduh file yang siap digunakan di KATA.</p>
    </div>
    {!logged?
     <section className="mx-auto max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_60px_rgba(25,42,79,0.06)]">
      <div className="p-7 sm:p-10">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-[#ed174c]"><LockKeyhole size={24}/></div>
        <h2 className="text-xl font-bold">Akses Petugas</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Masukkan password internal untuk membuat dan mengunduh link pelanggan.</p>
        <form className="mt-7 space-y-4" onSubmit={e=>{e.preventDefault();void login()}}>
          <div><label htmlFor="pwd" className="mb-2 block text-sm font-semibold">Password</label><input id="pwd" type="password" autoComplete="current-password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Masukkan password petugas" className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none transition focus:border-[#ed174c] focus:ring-4 focus:ring-rose-100"/></div>
          <button disabled={busy||!pass} type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ed174c] font-semibold text-white transition hover:bg-[#ce0f40] disabled:cursor-not-allowed disabled:opacity-45">{busy?<><Loader2 size={18} className="animate-spin"/>Memverifikasi...</>:<>Masuk <ArrowRight size={18}/></>}</button>
        </form>
        {error&&<p role="alert" className="mt-4 flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{error}</p>}
      </div>
     </section>
    :<>
     <div className="mb-7 grid grid-cols-3 items-center rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
       {[{n:1,title:'Upload data',short:'Upload'},{n:2,title:'Generate links',short:'Generate'},{n:3,title:'Unduh untuk KATA',short:'Download'}].map((s,i)=><div key={s.n} className="flex items-center justify-center gap-2 sm:gap-3">
        <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold '+(step>=s.n?'bg-[#ed174c] text-white':'bg-slate-100 text-slate-400')}>{step>s.n?<CheckCircle2 size={17}/>:s.n}</span>
        <span className={'text-xs font-semibold sm:text-sm '+(step>=s.n?'text-[#17243b]':'text-slate-400')}><span className="sm:hidden">{s.short}</span><span className="hidden sm:inline">{s.title}</span></span>
        {i<2&&<ChevronRight className="ml-1 hidden text-slate-300 md:block" size={15}/>}
       </div>)}
     </div>
     <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
       <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_45px_rgba(25,42,79,0.04)] sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
         <div><p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#ed174c]">Langkah 1</p><h2 className="text-xl font-bold">Upload data pelanggan</h2><p className="mt-1 text-sm text-slate-500">Pilih file CSV atau Excel yang berisi data pelanggan.</p></div>
         <button onClick={()=>download('template_hifi_survey.csv','customer_id,phone_number\r\nDEMO00001,6281200000101\r\nDEMO00002,6281300000102\r\n')} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50"><Download size={14}/> Template</button>
        </div>
        <input ref={fileInput} id="upload" className="sr-only" type="file" accept=".csv,.xlsx" onChange={e=>void fileChanged(e.target.files?.[0])}/>
        <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ') {e.preventDefault();fileInput.current?.click()}}} onClick={()=>fileInput.current?.click()} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void fileChanged(e.dataTransfer.files[0])}} className={'cursor-pointer rounded-2xl border-2 border-dashed px-5 py-9 text-center outline-none transition focus-visible:ring-4 focus-visible:ring-rose-200 '+(dragging?'border-[#ed174c] bg-rose-50':hasFile?'border-emerald-300 bg-emerald-50/40':'border-slate-200 bg-[#fafbfe] hover:border-rose-300 hover:bg-rose-50/30')}>
         <div className={'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl '+(hasFile?'bg-emerald-100 text-emerald-700':'bg-rose-50 text-[#ed174c]')}>{hasFile?<FileCheck2 size={27}/>:<UploadCloud size={27}/>}</div>
         <p className="text-sm font-bold sm:text-base">{parsing?'Membaca file...':hasFile?filename:'Drag & drop file di sini'}</p>
         <p className="mt-1 text-sm text-slate-500">{hasFile?list.length+' pelanggan terbaca • Klik untuk mengganti file':'atau klik untuk memilih file dari perangkat'}</p>
         <span className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">CSV, XLSX • Maks. 2 MB • 500 pelanggan</span>
        </div>
        <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><Info size={15} className="mt-0.5 shrink-0"/>Pastikan file memiliki kolom <code className="font-bold text-slate-700">customer_id</code> dan <code className="font-bold text-slate-700">phone_number</code>. CSV dengan koma atau titik koma didukung.</div>
       </section>
       {hasFile&&<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_45px_rgba(25,42,79,0.04)] sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-3"><div><p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#ed174c]">Pratinjau</p><h2 className="text-lg font-bold">Data pelanggan</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">{list.length} baris</span></div>
        <div className="overflow-hidden rounded-xl border border-slate-200"><div className="max-h-72 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 font-bold">Customer ID</th><th className="px-4 py-3 font-bold">Phone number</th></tr></thead><tbody>{list.slice(0,10).map((c,i)=><tr key={i} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{c.customer_id}</td><td className="px-4 py-3 text-slate-600">{c.phone_number}</td></tr>)}</tbody></table></div></div>
        {list.length>10&&<p className="mt-3 text-xs text-slate-500">Menampilkan 10 dari {list.length} pelanggan.</p>}
       </section>}
       <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_45px_rgba(25,42,79,0.04)] sm:p-7">
         <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#ed174c]">Langkah 2</p><h2 className="text-xl font-bold">Generate unique URLs</h2><p className="mt-2 mb-5 text-sm leading-6 text-slate-500">Setiap pelanggan mendapatkan link survei pribadi. Hasilnya otomatis tersimpan di Supabase.</p>
         <button onClick={()=>void generate()} disabled={busy||parsing||!hasFile} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ed174c] px-4 font-bold text-white shadow-sm transition hover:bg-[#ce0f40] disabled:cursor-not-allowed disabled:bg-rose-200 disabled:shadow-none">{busy?<><Loader2 size={18} className="animate-spin"/>Sedang membuat link...</>:<><RefreshCw size={18}/>Generate Unique URLs <ArrowRight size={18}/></>}</button>
         {!hasFile&&<p className="mt-3 text-center text-xs text-slate-400">Upload file terlebih dahulu untuk mengaktifkan tombol.</p>}
       </section>
       {success&&<section className="rounded-3xl border border-emerald-200 bg-white p-5 sm:p-7" role="status">
          <div className="flex items-center gap-3"><CheckCircle2 size={28} className="text-emerald-600"/><div><h2 className="text-lg font-bold">Link berhasil diproses!</h2><p className="text-sm text-slate-500">File siap diunduh untuk KATA.</p></div></div>
          <div className="mt-5 grid grid-cols-3 gap-3">{[{n:success.created,l:'Baru'},{n:success.reused,l:'Digunakan lagi'},{n:success.skipped,l:'Dilewati'}].map(x=><div key={x.l} className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-2xl font-extrabold">{x.n}</p><p className="mt-1 text-xs text-slate-500">{x.l}</p></div>)}</div>
          <button onClick={()=>download('kata_survey_links.csv',csvText)} disabled={!csvText} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 font-bold text-white transition hover:bg-slate-700 disabled:opacity-40"><Download size={18}/>Download CSV untuk KATA</button>
          {result&&<p className="mt-4 text-sm text-amber-700">{result}</p>}
       </section>}
       {error&&<p role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-900"><AlertCircle size={18} className="mt-0.5 shrink-0"/>{error}</p>}
      </div>
      <aside className="space-y-5">
       <div className="rounded-3xl border border-slate-200 bg-white p-6"><h3 className="font-bold">Cara kerja</h3><div className="mt-5 space-y-5">{[{icon:FileSpreadsheet,t:'Upload data',d:'Gunakan template atau file CSV/Excel.'},{icon:RefreshCw,t:'Generate URL',d:'Link unik dibuat dan disimpan.'},{icon:Download,t:'Export ke KATA',d:'Unduh CSV untuk WhatsApp blast.'}].map((x,i)=><div key={i} className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#ed174c]"><x.icon size={18}/></div><div><p className="text-sm font-semibold">{x.t}</p><p className="mt-1 text-xs leading-5 text-slate-500">{x.d}</p></div></div>)}</div></div>
       <div className="rounded-3xl bg-[#17243b] p-6 text-white"><ShieldCheck size={24} className="text-rose-300"/><h3 className="mt-4 font-bold">Data pelanggan tetap aman</h3><p className="mt-2 text-xs leading-6 text-slate-300">Akses khusus petugas. Link unik tidak menampilkan Customer ID atau nomor telepon di alamat URL.</p></div>
       <p className="px-2 text-xs leading-5 text-slate-500">Link yang lama dari generator lokal tidak dapat dipulihkan tanpa file CSV aslinya. Simpan file ekspor secara aman.</p>
      </aside>
     </div>
    </>}
    <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">© HiFi • Internal Survey Link Generator</footer>
   </div>
 </main>
}
