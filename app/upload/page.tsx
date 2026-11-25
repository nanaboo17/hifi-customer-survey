'use client'
import {useEffect,useRef,useState} from 'react'
import {UploadCloud,FileSpreadsheet,Download,ArrowRight,LockKeyhole,LogOut,CheckCircle2,AlertCircle,Loader2,RefreshCw} from 'lucide-react'
type Customer={customer_id:string;customer_name:string;phone_number:string}
type Job={id:string;file_name:string;file_size:number;header_image_url:string;total_rows:number;uploaded_rows:number;processed_rows:number;created_count:number;reused_count:number;skipped_count:number;status:string;export_files:number}
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
  if(size>150000000||compressed>100000000||u32(offset)!==0x04034b50)throw Error('File Excel tidak didukung')
  const start=offset+30+u16(offset+26)+u16(offset+28),data=bytes.slice(start,start+compressed);let result:Uint8Array
  if(method===0)result=data
  else if(method===8){const out=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));result=new Uint8Array(await new Response(out).arrayBuffer())}
  else throw Error('Kompresi XLSX tidak didukung')
  total+=result.length;if(total>200000000)throw Error('File Excel terlalu besar setelah diekstrak')
  parts.set(name,decoder.decode(result))
 }
 const parse=(x:string)=>{const doc=new DOMParser().parseFromString(x,'application/xml');if(doc.querySelector('parsererror'))throw Error('XML Excel tidak valid');return doc}
 const strings=parts.get('xl/sharedStrings.xml')?Array.from(parse(parts.get('xl/sharedStrings.xml')!).getElementsByTagName('si')).map(x=>x.textContent||''):[]
 const sheet=[...parts.keys()].filter(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort()[0];if(!sheet)throw Error('Worksheet Excel tidak ditemukan')
 const rows=Array.from(parse(parts.get(sheet)!).getElementsByTagName('row'));if(rows.length>500001)throw Error('Maksimal 500.000 pelanggan')
 return rows.map(r=>{const row:string[]=[];for(const c of Array.from(r.getElementsByTagName('c'))){const ref=c.getAttribute('r')?.match(/^[A-Z]+/)?.[0]||'A';let index=0;for(const char of ref)index=index*26+char.charCodeAt(0)-64;index--;if(index>30)continue;const raw=c.getElementsByTagName('v')[0]?.textContent||'';row[index]=c.getAttribute('t')==='s'?(strings[Number(raw)]||''):c.getAttribute('t')==='inlineStr'?(c.getElementsByTagName('is')[0]?.textContent||''):raw}return row})
}
function customers(rows:string[][]):Customer[]{if(rows.length<2)throw Error('File kosong');const h=rows[0].map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[\s-]+/g,'_'));const id=h.findIndex(x=>['customer_id','customerid','cust_id','id'].includes(x)),name=h.findIndex(x=>['customer_name','customername','nama_pelanggan','nama','name'].includes(x)),phone=h.findIndex(x=>['phone_number','phone','msisdn','no_hp','whatsapp'].includes(x));if(id<0||name<0||phone<0)throw Error('Kolom customer_id, customer_name, dan phone_number wajib ada');if(rows.length>500001)throw Error('Maksimal 500.000 pelanggan');return rows.slice(1).map(x=>({customer_id:(x[id]||'').trim(),customer_name:(x[name]||'').trim(),phone_number:(x[phone]||'').trim()}))}

export default function UploadPage(){
 const [pass,setPass]=useState('')
 const [logged,setLogged]=useState(false)
 const [list,setList]=useState<Customer[]>([])
 const [filename,setFilename]=useState('')
 const [fileSize,setFileSize]=useState(0)
 const [job,setJob]=useState<Job|null>(null)
 const [exportPage,setExportPage]=useState(0)
 const [headerImageUrl,setHeaderImageUrl]=useState('')
 const [busy,setBusy]=useState(false)
 const [parsing,setParsing]=useState(false)
 const [dragging,setDragging]=useState(false)
 const [error,setError]=useState('')
 const fileInput=useRef<HTMLInputElement>(null)
 useEffect(()=>{if(!logged)return;const id=localStorage.getItem('hifi_bulk_job');if(!id)return;void fetch('/api/upload/jobs/'+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Job belum dapat dibuka');const d=await r.json() as Job;setJob(d);setHeaderImageUrl(d.header_image_url)}).catch(()=>setError('Job sebelumnya belum dapat dimuat. Periksa migrasi dan akses Supabase.'))},[logged])
 async function request(url:string,payload:object){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error(d.error||'Permintaan gagal');return d}

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
   setList([]);setError('')
   if(!file){setFilename('');setFileSize(0);return}
   setFilename(file.name);setFileSize(file.size);setParsing(true)
   try{
     if(file.size>100000000)throw Error('Ukuran file maksimal 100 MB.')
     const name=file.name.toLowerCase()
     const rows=name.endsWith('.csv')?csv(await file.text()):name.endsWith('.xlsx')?await xlsx(await file.arrayBuffer()):(()=>{throw Error('Gunakan file CSV atau Excel (.xlsx).')})()
     const parsed=customers(rows)
     if(!parsed.length)throw Error('Tidak ada pelanggan dalam file.')
     setList(parsed)
   }catch(e){setError(e instanceof Error?e.message:'Gagal membaca file.')}finally{setParsing(false)}
 }
 async function generate(){
   if(busy)return
   setBusy(true);setError('')
   try{
     let active=job
     if(!active){
       if(!list.length)throw Error('Upload file pelanggan terlebih dahulu.')
       if(!headerImageUrl.trim())throw Error('Masukkan link gambar header.')
       const created=await request('/api/upload/jobs',{total_rows:list.length,header_image_url:headerImageUrl.trim(),file_name:filename,file_size:fileSize}) as {id:string}
       localStorage.setItem('hifi_bulk_job',created.id)
       const resp=await fetch('/api/upload/jobs/'+created.id,{cache:'no-store'})
       if(!resp.ok)throw Error('Gagal membaca job baru.')
       active=await resp.json() as Job
       setJob(active)
     }
     const url='/api/upload/jobs/'+encodeURIComponent(active.id)
     if(active.status==='uploading'){
       if(!list.length)throw Error('Upload ulang file yang sama untuk melanjutkan proses import.')
       if(active.file_name!==filename||active.file_size!==fileSize||active.total_rows!==list.length)throw Error('File tidak cocok dengan job sebelumnya. Gunakan file asli atau buat campaign baru.')
       let offset=active.uploaded_rows
       while(offset<active.total_rows){
         const batch=list.slice(offset,offset+500)
         try{
           const data=await request(url,{action:'stage',start:offset,rows:batch}) as {uploaded_rows:number}
           offset=data.uploaded_rows
         }catch(e){
           const latest=await fetch(url,{cache:'no-store'}).then(r=>r.json()) as Job
           if(latest.uploaded_rows>offset){offset=latest.uploaded_rows;continue}
           throw e
         }
         setJob(prev=>prev?{...prev,uploaded_rows:offset,status:offset===active!.total_rows?'ready':'uploading'}:prev)
       }
     }
     let finished=false
     while(!finished){
       const data=await request(url,{action:'process'}) as Job & {complete:boolean}
       finished=!!data.complete
       setJob(prev=>prev?{...prev,...data}:prev)
     }
     const latest=await fetch(url,{cache:'no-store'}).then(r=>r.json()) as Job
     setJob(latest)
   }catch(e){setError((e instanceof Error?e.message:'Gagal memproses campaign.')+' Progress tersimpan; Anda dapat melanjutkan nanti.')}
   finally{setBusy(false)}
 }
 function newCampaign(){if(busy)return;localStorage.removeItem('hifi_bulk_job');setJob(null);setList([]);setFilename('');setFileSize(0);setHeaderImageUrl('');setExportPage(0);setError('')}
 function download(name:string,content:string){
   const u=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}))
   const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove()
   setTimeout(()=>URL.revokeObjectURL(u),5000)
 }
 async function logout(){
   await fetch('/api/upload/logout',{method:'POST'})
   setLogged(false);setJob(null);setList([]);setFilename('');setError('')
 }
 const hasFile=list.length>0
 const step=job?.status==='completed'?3:hasFile||job?2:1
 return <main className="min-h-screen bg-[#f5f2ec] text-[#241638]">
  <header className="border-b-[3px] border-[#241638] bg-white">
   <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
    <div className="flex items-center gap-3"><span className="inline-block -rotate-3 rounded-md bg-[#ed174c] px-3 py-1 text-2xl font-black italic tracking-tighter text-white shadow-[3px_3px_0_#241638]">HiFi!</span><span className="hidden border-l-2 border-[#241638] pl-3 text-sm font-black uppercase tracking-widest sm:inline">Survey Studio</span></div>
    <div className="flex items-center gap-3"><span className="text-xs font-bold uppercase tracking-widest text-[#6b6274]">Internal only</span>{logged&&<a href="/upload/bulk" className="rounded-lg border-2 border-[#241638] bg-[#ffce00] px-3 py-2 text-xs font-black uppercase">BULK 500K</a>}{logged&&<button onClick={()=>void logout()} className="flex items-center gap-2 rounded-lg border-2 border-[#241638] bg-white px-3 py-2 text-xs font-black uppercase shadow-[3px_3px_0_#241638] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"><LogOut size={15}/> Keluar</button>}</div>
   </div>
  </header>
  <div className="relative overflow-hidden bg-[#4924ac] text-white">
   <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rotate-12 rounded-[4rem] border-[24px] border-[#ffce00] opacity-90"/>
   <div aria-hidden="true" className="pointer-events-none absolute bottom-[-68px] left-[-55px] h-48 w-48 rotate-45 bg-[#e21b3c]"/>
   <div aria-hidden="true" className="pointer-events-none absolute right-[18%] bottom-[-85px] h-48 w-48 rounded-full bg-[#26890c]"/>
   <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
    <p className="mb-4 inline-block -rotate-2 bg-[#ffce00] px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-[#241638]">Link generator / HiFi</p>
    <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">Satu file.<br/><span className="text-[#ffce00]">Banyak link.</span><br/>Langsung kirim.</h1>
    <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-white/85">Upload daftar pelanggan, buat link survei unik, lalu ekspor file untuk KATA. Selesai dalam tiga langkah.</p>
   </div>
  </div>
  <div className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:px-8">
   {!logged?<section className="mx-auto max-w-md border-[3px] border-[#241638] bg-white p-7 shadow-[8px_8px_0_#241638] sm:p-10">
    <div className="mb-5 flex h-14 w-14 rotate-[-8deg] items-center justify-center bg-[#ffce00] text-[#241638]"><LockKeyhole size={28}/></div>
    <h2 className="text-3xl font-black">Halo, petugas!</h2>
    <p className="mt-2 text-sm font-medium text-[#6b6274]">Masukkan password untuk masuk ke generator link.</p>
    <form onSubmit={e=>{e.preventDefault();void login()}} className="mt-6 space-y-4">
     <div><label htmlFor="pwd" className="mb-2 block text-sm font-black">Password</label><input id="pwd" type="password" autoComplete="current-password" placeholder="Password petugas" value={pass} onChange={e=>setPass(e.target.value)} className="h-12 w-full rounded-md border-2 border-[#241638] px-3 text-base outline-none focus:ring-4 focus:ring-[#ffce00]"/></div>
     <button disabled={busy||!pass} type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-[#241638] bg-[#26890c] font-black text-white shadow-[4px_4px_0_#241638] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-40">{busy?<><Loader2 size={18} className="animate-spin"/> Memeriksa...</>:<>Masuk <ArrowRight size={18}/></>}</button>
    </form>
    {error&&<p role="alert" className="mt-5 border-l-4 border-[#e21b3c] bg-[#ffe7ec] p-3 text-sm font-bold">{error}</p>}
   </section>:<>
    <div className="mb-8 flex flex-wrap items-center gap-3">{[{n:1,label:'UPLOAD'},{n:2,label:'GENERATE'},{n:3,label:'DOWNLOAD'}].map(s=><div key={s.n} className={'flex items-center gap-2 rounded-md border-2 border-[#241638] px-4 py-3 text-xs font-black tracking-widest shadow-[3px_3px_0_#241638] sm:text-sm '+(step===s.n?'bg-[#ffce00]':'bg-white')}>{step>s.n?<CheckCircle2 size={18}/>:<span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#241638] text-white">{s.n}</span>}{s.label}</div>)}</div>
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_310px]">
     <div className="space-y-7">
      <section className="border-[3px] border-[#241638] bg-white shadow-[7px_7px_0_#241638]">
       <div className="flex items-center justify-between gap-3 border-b-[3px] border-[#241638] bg-[#ffce00] px-5 py-4 sm:px-7"><h2 className="text-xl font-black sm:text-2xl">01. Upload pelanggan</h2><FileSpreadsheet size={28}/></div>
       <div className="p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="max-w-sm text-sm font-medium text-[#6b6274]">Masukkan data pelanggan dengan kolom customer_id, customer_name, dan phone_number.</p><button onClick={()=>download('template_hifi_survey.csv','customer_id,customer_name,phone_number\r\nDEMO00001,Budi Santoso,6281200000101\r\nDEMO00002,Siti Aminah,6281300000102\r\n')} className="flex shrink-0 items-center gap-2 rounded-md border-2 border-[#241638] bg-white px-3 py-2 text-xs font-black shadow-[3px_3px_0_#241638] hover:bg-[#ffce00]"><Download size={15}/> UNDUH TEMPLATE</button></div>
        <input ref={fileInput} id="upload" type="file" accept=".csv,.xlsx" className="sr-only" onChange={e=>void fileChanged(e.target.files?.[0])}/>
        <div role="button" tabIndex={0} onClick={()=>fileInput.current?.click()} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.current?.click()}}} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void fileChanged(e.dataTransfer.files[0])}} className={'group cursor-pointer border-[3px] border-dashed p-8 text-center transition focus:outline-none focus:ring-4 focus:ring-[#ffce00] sm:p-11 '+(dragging?'border-[#4924ac] bg-[#ebe3ff]':hasFile?'border-[#26890c] bg-[#effce9]':'border-[#988ca7] bg-[#f8f5ff] hover:border-[#4924ac] hover:bg-[#eee6ff]')}>
         <div className="mx-auto mb-4 flex h-16 w-16 rotate-[-8deg] items-center justify-center rounded-md bg-[#4924ac] text-white shadow-[5px_5px_0_#241638]"><UploadCloud size={30}/></div>
         <p className="break-all text-xl font-black sm:text-2xl">{parsing?'Membaca file...':hasFile?filename:'Tarik file ke sini!'}</p>
         <p className="mt-2 text-sm font-medium text-[#6b6274]">{hasFile?list.length+' pelanggan terbaca. Klik untuk mengganti file.':'Atau klik untuk memilih file dari komputer'}</p>
         <span className="mt-5 inline-block rounded-md border-2 border-[#241638] bg-white px-3 py-2 text-xs font-black">CSV / XLSX · MAKS. 100 MB · 500.000 PELANGGAN</span>
        </div>
       </div>
      </section>
      {hasFile&&<section className="border-[3px] border-[#241638] bg-white shadow-[7px_7px_0_#241638]">
       <div className="flex items-center justify-between border-b-[3px] border-[#241638] bg-[#1368ce] px-5 py-4 text-white sm:px-7"><h2 className="text-xl font-black">Cek dulu datanya!</h2><span className="rounded-md bg-white px-3 py-1 text-xs font-black text-[#241638]">{list.length} PELANGGAN</span></div>
       <div className="p-5 sm:p-7"><div className="max-h-64 overflow-auto border-2 border-[#241638]"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-[#eae6f3]"><tr><th className="px-4 py-3 font-black">Customer ID</th><th className="px-4 py-3 font-black">Customer name</th><th className="px-4 py-3 font-black">Phone number</th></tr></thead><tbody>{list.slice(0,10).map((c,i)=><tr key={i} className="border-t border-[#eae6f3]"><td className="px-4 py-3 font-bold">{c.customer_id}</td><td className="px-4 py-3">{c.customer_name}</td><td className="px-4 py-3">{c.phone_number}</td></tr>)}</tbody></table></div>{list.length>10&&<p className="mt-3 text-xs font-medium text-[#6b6274]">Preview 10 dari {list.length} pelanggan.</p>}</div>
      </section>}
      <section className="border-[3px] border-[#241638] bg-white shadow-[7px_7px_0_#241638]">
       <div className="flex items-center justify-between border-b-[3px] border-[#241638] bg-[#e21b3c] px-5 py-4 text-white sm:px-7"><h2 className="text-xl font-black sm:text-2xl">02. Bikin link survei</h2><RefreshCw size={26}/></div>
       <div className="p-5 sm:p-7"><p className="mb-5 text-sm font-medium text-[#6b6274]">Satu pelanggan, satu link unik. Data tersimpan otomatis di Supabase.</p><label htmlFor="header-image-url" className="mb-2 block text-sm font-black">Link gambar header WhatsApp (HTTPS)</label><input id="header-image-url" type="url" inputMode="url" placeholder="https://example.com/hifi-banner.jpg" value={headerImageUrl} onChange={e=>{setHeaderImageUrl(e.target.value);setError('')}} className="mb-2 h-12 w-full rounded-md border-2 border-[#241638] px-3 text-sm outline-none focus:ring-4 focus:ring-[#ffce00]"/><p className="mb-5 text-xs font-medium text-[#6b6274]">Wajib diisi. Gunakan URL publik langsung ke gambar (bukan halaman web atau Google Drive yang memerlukan login). File KATA akan memakai header_type = image dan header_text/link = URL ini.</p><button disabled={busy||parsing||(!hasFile&&job?.status==='uploading')||(!job&&!hasFile)||(!job&&!headerImageUrl.trim())||job?.status==='completed'} onClick={()=>void generate()} className="flex w-full items-center justify-center gap-2 rounded-md border-[3px] border-[#241638] bg-[#4924ac] px-4 py-4 text-lg font-black text-white shadow-[5px_5px_0_#241638] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_#241638] disabled:cursor-not-allowed disabled:bg-[#b5aac8] disabled:shadow-none">{busy?<><Loader2 size={20} className="animate-spin"/> Memproses campaign...</>:job?'LANJUTKAN JOB':'GENERATE LINK'}</button>{!hasFile&&!job&&<p className="mt-4 text-center text-xs font-bold text-[#80768c]">Upload data dulu untuk melanjutkan.</p>}<p className="mt-3 text-xs text-[#6b6274]">Untuk file besar, gunakan CSV di komputer. Proses berjalan selama halaman ini terbuka; progress tersimpan di Supabase untuk dilanjutkan.</p>{job&&<button type="button" onClick={newCampaign} disabled={busy} className="mt-4 text-xs font-black underline">Buat campaign baru</button>}</div>
      </section>
      {job&&<section role="status" className="border-[3px] border-[#241638] bg-white shadow-[7px_7px_0_#241638]">
       <div className="border-b-[3px] border-[#241638] bg-[#26890c] px-5 py-4 text-white sm:px-7"><h2 className="text-xl font-black">Progress campaign</h2><p className="mt-1 text-xs">Job ID: {job.id}</p></div>
       <div className="space-y-4 p-5 sm:p-7">
        <p className="font-semibold">Status: {job.status==='completed'?'Selesai':job.status==='uploading'?'Upload pelanggan':job.status==='ready'?'Siap diproses':'Generate link'}</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-[#eae6f3]"><div className="h-full bg-[#26890c]" style={{width:Math.min(100,Math.round(100*(job.status==='uploading'?job.uploaded_rows:job.processed_rows)/job.total_rows))+'%'}}/></div>
        <p className="text-sm">{(job.status==='uploading'?job.uploaded_rows:job.processed_rows).toLocaleString('id-ID')} / {job.total_rows.toLocaleString('id-ID')} pelanggan</p>
        <div className="grid grid-cols-3 gap-2 text-center">{[{n:job.created_count,l:'LINK BARU'},{n:job.reused_count,l:'DIPAKAI LAGI'},{n:job.skipped_count,l:'DILEWATI'}].map(x=><div key={x.l} className="border-2 border-[#241638] bg-[#fff8e6] p-2"><p className="text-xl font-black">{x.n.toLocaleString('id-ID')}</p><p className="text-[10px] font-bold">{x.l}</p></div>)}</div>
        {job.status==='completed'&&<div className="space-y-3"><h3 className="font-black">Download CSV untuk KATA</h3><p className="text-sm text-[#6b6274]">Setiap file berisi maksimal 5.000 pelanggan. Download seluruh bagian untuk campaign lengkap.</p>
          <div className="flex items-center gap-3"><button type="button" disabled={exportPage===0} onClick={()=>setExportPage(p=>p-1)} className="rounded border px-3 py-2 text-sm disabled:opacity-30">Sebelumnya</button><span className="text-sm">Halaman {exportPage+1} / {Math.max(1,Math.ceil(job.export_files/20))}</span><button type="button" disabled={(exportPage+1)*20>=job.export_files} onClick={()=>setExportPage(p=>p+1)} className="rounded border px-3 py-2 text-sm disabled:opacity-30">Berikutnya</button></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({length:Math.max(0,Math.min(20,job.export_files-exportPage*20))},(_,i)=>exportPage*20+i).map(i=><a key={i} className="rounded-md border-2 border-[#241638] bg-[#e3f6df] p-3 text-center text-xs font-black hover:bg-[#c8ebc1]" href={'/api/upload/jobs/'+job.id+'?part='+i}>DOWNLOAD PART {String(i+1).padStart(3,'0')}</a>)}</div>
          {job.skipped_count>0&&<p className="text-sm text-[#9f263c]">{job.skipped_count.toLocaleString('id-ID')} pelanggan dilewati. Periksa data pelanggan dan histori undangan sebelum mengulang.</p>}
        </div>}
       </div>
      </section>}
      {error&&<p role="alert" className="border-[3px] border-[#e21b3c] bg-[#ffe8ec] p-4 text-sm font-bold text-[#8c1030]"><AlertCircle className="mr-2 inline" size={20}/>{error}</p>}
     </div>
     <aside className="space-y-6">
      <div className="border-[3px] border-[#241638] bg-[#ffce00] p-6 shadow-[6px_6px_0_#241638]"><p className="text-xs font-black tracking-[0.15em]">HOW TO PLAY</p><h3 className="mt-2 text-3xl font-black">3 langkah. Beres!</h3><div className="mt-6 space-y-5">{[{n:'1',t:'Upload',d:'Masukkan CSV atau XLSX.'},{n:'2',t:'Generate',d:'Buat URL unik otomatis.'},{n:'3',t:'Kirim',d:'Ekspor CSV untuk KATA.'}].map(x=><div key={x.n} className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#241638] bg-white text-lg font-black">{x.n}</span><div><p className="text-base font-black">{x.t}</p><p className="text-xs font-medium">{x.d}</p></div></div>)}</div></div>
      <div className="rotate-1 border-[3px] border-[#241638] bg-[#1368ce] p-6 text-white shadow-[6px_6px_0_#241638]"><p className="text-3xl">✦</p><h3 className="mt-2 text-xl font-black">Link pribadi</h3><p className="mt-2 text-sm font-medium leading-relaxed">Link survei dibuat unik untuk setiap pelanggan, tanpa menampilkan nomor telepon di URL.</p></div>
     </aside>
    </div>
   </>}
   <footer className="mt-14 border-t-2 border-[#241638] pt-5 text-xs font-bold uppercase tracking-wide text-[#80768c]">HiFi Survey Studio · Internal tool</footer>
  </div>
 </main>
}
