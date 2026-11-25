import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { staff, originOK, encrypt, decrypt } from '@/lib/upload-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }
const KATA_HEADER = 'country_code,whatsapp_number,contact_name,header_type,header_text/link,body1_type,body1_text,body2_type,body2_text,cta_website_variable'
type Customer = { customer_id: string; customer_name: string; phone_number: string }
const quoted = (s: string) => '"' + (/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'
const rowCsv = (c: Customer, phone: string, token: string, image: string) =>
  ['62',phone.slice(2),c.customer_name,'image',image,'text',c.customer_name,'text',c.customer_id,token].map(quoted).join(',')
const normalizePhone = (v: string) => {
 const d = v.replace(/\D/g, '')
 const p = d.startsWith('0') ? '62'+d.slice(1) : d.startsWith('8') ? '62'+d : d
 return /^628\d{8,11}$/.test(p) ? p : null
}
const fail = (error: string, status = 400) => NextResponse.json({error},{status,headers})
function dbOrFail() {
 const db = getSupabaseAdmin()
 if (!db) throw Error('Supabase belum dikonfigurasi')
 return db
}
const validImage = (value: unknown): value is string => {
 if (typeof value !== 'string' || !value || value.length > 2000) return false
 try { const u = new URL(value); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password }
 catch { return false }
}
const validJob = (x: unknown): x is string => typeof x === 'string' && /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(x)

export async function GET(req: NextRequest) {
 if (!staff(req)) return fail('Tidak diizinkan',403)
 try {
  const db = dbOrFail(), job = req.nextUrl.searchParams.get('job')
  if (!validJob(job)) return fail('ID campaign tidak valid')
  const {data: head,error: headErr} = await db.from('hifi_bulk_jobs').select('*').eq('id',job).maybeSingle()
  if (headErr) throw Error(headErr.message)
  if (!head) return fail('Campaign tidak ditemukan',404)
  const mode = req.nextUrl.searchParams.get('mode') || 'status'
  if (mode === 'export') {
   const part = Number(req.nextUrl.searchParams.get('part'))
   if (!Number.isInteger(part) || part < 0 || part >= Math.ceil(head.total_batches / 50)) return fail('Bagian ekspor tidak valid')
   if (head.status !== 'complete') return fail('Campaign belum selesai diproses',409)
   const {data: batches,error} = await db.from('hifi_bulk_batches').select('batch_index,csv,status')
    .eq('job_id',job).gte('batch_index',part*50).lt('batch_index',(part+1)*50).order('batch_index')
   if (error) throw Error(error.message)
   if (!batches || batches.length !== Math.min(50,head.total_batches-part*50) || batches.some(x=>x.status!=='done')) return fail('Hasil ekspor belum lengkap',409)
   const content = '\uFEFF'+KATA_HEADER+'\r\n'+batches.map(b=>b.csv||'').filter(Boolean).join('\r\n')+'\r\n'
   return new NextResponse(content,{headers:{'Content-Type':'text/csv; charset=utf-8','Cache-Control':'no-store','Content-Disposition':`attachment; filename="kata_hifi_${job.slice(0,8)}_part_${String(part+1).padStart(2,'0')}.csv"`}})
  }
  const {data: batches,error} = await db.from('hifi_bulk_batches')
   .select('batch_index,status,created,reused,skipped').eq('job_id',job).order('batch_index').limit(1000)
  if (error) throw Error(error.message)
  const done=(batches||[]).filter(x=>x.status==='done')
  const stats = {total:head.total_customers,batches:head.total_batches,uploaded:batches?.length||0,processed:done.length,
   created:done.reduce((sum,x)=>sum+x.created,0),reused:done.reduce((sum,x)=>sum+x.reused,0),skipped:done.reduce((sum,x)=>sum+x.skipped,0)}
  if (head.status==='processing' && done.length===head.total_batches) {
   await db.from('hifi_bulk_jobs').update({status:'complete',updated_at:new Date().toISOString()}).eq('id',job)
   head.status='complete'
  }
  return NextResponse.json({job:head,stats,export_parts:Math.ceil(head.total_batches/50)},{headers})
 } catch(e) {console.error('bulk status',e);return fail('Gagal memuat campaign',500)}
}

export async function POST(req: NextRequest) {
 if (!originOK(req)||!staff(req)) return fail('Tidak diizinkan',403)
 try {
  if (Number(req.headers.get('content-length')||0)>2_000_000) return fail('Batch terlalu besar',413)
  const body: unknown = await req.json()
  if (!body||typeof body!=='object'||Array.isArray(body)) return fail('Request tidak valid')
  const b=body as Record<string,unknown>,db=dbOrFail()
  if (b.action==='create') {
   const total=Number(b.total),filename=String(b.filename||''),image=String(b.header_image_url||'')
   if (!Number.isInteger(total)||total<1||total>500000||filename.length>255||!filename||!validImage(image))return fail('Jumlah pelanggan, nama file, atau URL gambar tidak valid')
   const batches=Math.ceil(total/500)
   const {data,error}=await db.from('hifi_bulk_jobs')
    .insert({file_name:filename,header_image_url:image,total_customers:total,total_batches:batches})
    .select('id').single()
   if (error)throw Error(error.message)
   return NextResponse.json({job_id:data.id},{headers})
  }
  if (!validJob(b.job_id))return fail('ID campaign tidak valid')
  const jobId=b.job_id
  const {data:job,error:jobErr}=await db.from('hifi_bulk_jobs').select('*').eq('id',jobId).maybeSingle()
  if (jobErr)throw Error(jobErr.message)
  if (!job)return fail('Campaign tidak ditemukan',404)
  if (b.action==='append') {
   if (job.status!=='uploading')return fail('Upload campaign sudah ditutup',409)
   const index=Number(b.index),customers=b.customers
   if (!Number.isInteger(index)||index<0||index>=job.total_batches||!Array.isArray(customers)||
      customers.length!==Math.min(500,job.total_customers-index*500))return fail('Nomor atau ukuran batch tidak sesuai')
   for(const raw of customers) {
    if (!raw||typeof raw!=='object')return fail('Data pelanggan tidak valid')
    const c=raw as Record<string,unknown>
    if(typeof c.customer_id!=='string'||!c.customer_id.trim()||c.customer_id.length>100||
      typeof c.customer_name!=='string'||!c.customer_name.trim()||c.customer_name.length>150||
      typeof c.phone_number!=='string'||!normalizePhone(c.phone_number))return fail('Customer ID, nama, atau telepon tidak valid pada batch '+(index+1))
   }
   const {error}=await db.from('hifi_bulk_batches').insert({job_id:jobId,batch_index:index,customers})
   if(error?.code==='23505')return NextResponse.json({ok:true,already_uploaded:true},{headers})
   if(error)throw Error(error.message)
   return NextResponse.json({ok:true},{headers})
  }
  if (b.action==='finish') {
   const {count,error}=await db.from('hifi_bulk_batches').select('batch_index',{count:'exact',head:true}).eq('job_id',jobId)
   if(error)throw Error(error.message)
   if(count!==job.total_batches)return fail(`Masih ada batch yang belum diupload: ${count}/${job.total_batches}`,409)
   if(job.status==='uploading'){
    const {error:updateError}=await db.from('hifi_bulk_jobs').update({status:'ready',updated_at:new Date().toISOString()}).eq('id',jobId).eq('status','uploading')
    if(updateError)throw Error(updateError.message)
   }
   return NextResponse.json({ok:true},{headers})
  }
  if (b.action!=='process')return fail('Action tidak dikenal')
  if(job.status==='uploading')return fail('Selesaikan upload sebelum memproses',409)
  if(job.status==='complete')return NextResponse.json({complete:true},{headers})
  const {data:claims,error:claimError}=await db.rpc('hifi_claim_bulk_batch',{p_job:jobId})
  if(claimError)throw Error(claimError.message)
  const claimed=claims?.[0] as {out_index:number;out_customers:Customer[]}|undefined
  if(!claimed) {
   const {count,error}=await db.from('hifi_bulk_batches').select('batch_index',{count:'exact',head:true}).eq('job_id',jobId).eq('status','done')
   if(error)throw Error(error.message)
   if(count===job.total_batches) {
    await db.from('hifi_bulk_jobs').update({status:'complete',updated_at:new Date().toISOString()}).eq('id',jobId)
    return NextResponse.json({complete:true},{headers})
   }
   return NextResponse.json({busy:true},{headers})
  }
  const idx=claimed.out_index
  try {
   const customerMap=new Map<string,Customer>()
   for(const c of claimed.out_customers) customerMap.set(c.customer_id.trim(),{customer_id:c.customer_id.trim(),customer_name:c.customer_name.trim(),phone_number:normalizePhone(c.phone_number)!})
   const ids=[...customerMap.keys()]
   const {data:past,error:lookupError}=await db.from('survey_invitations')
    .select('customer_id,phone_number,token_ciphertext,expires_at,revoked_at').in('customer_id',ids)
    .order('created_at',{ascending:false}).limit(10000)
   if(lookupError)throw Error(lookupError.message)
   const latest=new Map<string,NonNullable<typeof past>[number]>()
   for(const item of past||[])if(!latest.has(item.customer_id))latest.set(item.customer_id,item)
   let created=0,reused=0,skipped=0
   const errors:string[]=[],rows:string[]=[]
   const fresh:{customer_id:string;phone_number:string;token_hash:string;token_ciphertext:string;expires_at:string}[]=[]
   const freshTokens=new Map<string,string>()
   for(const [id,c] of customerMap) {
    const old=latest.get(id)
    if(old) {
     if(old.phone_number!==c.phone_number||old.revoked_at||Date.parse(old.expires_at)<=Date.now()||!old.token_ciphertext) {
      errors.push(id+': existing invitation cannot be re-exported');skipped++;continue
     }
     try {rows.push(rowCsv(c,c.phone_number,decrypt(old.token_ciphertext),job.header_image_url));reused++}
     catch {errors.push(id+': token cannot be decrypted');skipped++}
     continue
    }
    const token=randomBytes(32).toString('base64url')
    fresh.push({customer_id:id,phone_number:c.phone_number,token_hash:createHash('sha256').update(token).digest('hex'),token_ciphertext:encrypt(token),expires_at:new Date(Date.now()+14*86400000).toISOString()})
    freshTokens.set(id,token)
   }
   for(let i=0;i<fresh.length;i+=100){
    const segment=fresh.slice(i,i+100)
    const {error}=await db.from('survey_invitations').insert(segment)
    if(error)throw Error('Supabase batch insert: '+error.code)
    for(const item of segment) {
     const c=customerMap.get(item.customer_id)!
     rows.push(rowCsv(c,c.phone_number,freshTokens.get(item.customer_id)!,job.header_image_url));created++
    }
   }
   const {error:saveError}=await db.from('hifi_bulk_batches')
    .update({status:'done',csv:rows.join('\r\n'),created,reused,skipped,errors,completed_at:new Date().toISOString()})
    .eq('job_id',jobId).eq('batch_index',idx)
   if(saveError)throw Error(saveError.message)
   await db.from('hifi_bulk_jobs').update({status:'processing',updated_at:new Date().toISOString()}).eq('id',jobId).neq('status','complete')
   return NextResponse.json({processed:true,index:idx,created,reused,skipped},{headers})
  } catch(e) {
   console.error('Bulk batch process failure',idx,e)
   await db.from('hifi_bulk_batches').update({status:'queued',processing_started_at:null}).eq('job_id',jobId).eq('batch_index',idx).eq('status','processing')
   return fail('Batch '+(idx+1)+' gagal. Bisa dicoba lagi. Periksa Cloudflare logs.',500)
  }
 } catch(e){console.error('Bulk campaign request',e);return fail('Gagal memproses campaign. Pastikan migrasi SQL sudah dijalankan.',500)}
}
