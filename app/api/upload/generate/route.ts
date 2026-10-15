import {NextRequest,NextResponse} from 'next/server'
import {createHash,randomBytes} from 'node:crypto'
import {getSupabaseAdmin,missingSupabaseSettings} from '@/lib/supabase-admin'
import {staff,originOK,encrypt,decrypt} from '@/lib/upload-security'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const h={'Cache-Control':'no-store'}
const quote=(x:string)=>'"'+x.replace(/"/g,'""')+'"'
function phone(v:string){const d=v.replace(/\D/g,'');const p=d.startsWith('0')?'62'+d.slice(1):d.startsWith('8')?'62'+d:d;return /^628\d{8,11}$/.test(p)?p:null}
export async function POST(req:NextRequest){
 if(!originOK(req)||!staff(req))return NextResponse.json({error:'Tidak diizinkan.'},{status:403,headers:h})
 try{
 const b=await req.json() as {customers?:Array<{customer_id:string;phone_number:string}>}
 if(!Array.isArray(b.customers)||!b.customers.length||b.customers.length>500)return NextResponse.json({error:'Maksimal 500 pelanggan per batch.'},{status:400,headers:h})
 const set=new Map<string,string>()
 for(const r of b.customers){const id=typeof r.customer_id==='string'?r.customer_id.trim():'';const p=typeof r.phone_number==='string'?phone(r.phone_number):null;if(!id||id.length>100||!p)return NextResponse.json({error:'Customer ID atau nomor telepon tidak valid.'},{status:400,headers:h});if(set.has(id)&&set.get(id)!==p)return NextResponse.json({error:'Duplicate ID dengan nomor berbeda: '+id},{status:400,headers:h});set.set(id,p)}
 const db=getSupabaseAdmin();if(!db)return NextResponse.json({error:'Variabel Cloudflare Worker belum tersedia: '+missingSupabaseSettings().join(', ')+'. Periksa Runtime Variables and Secrets, bukan Build Variables.'},{status:503,headers:h})
 const {data,error}=await db.from('survey_invitations').select('customer_id,phone_number,token_ciphertext,expires_at,revoked_at').in('customer_id',[...set.keys()]).order('created_at',{ascending:false})
 if(error)throw Error('Lookup '+error.code)
 const previous=new Map<string,NonNullable<typeof data>[number]>()
 for(const r of data||[])if(!previous.has(r.customer_id))previous.set(r.customer_id,r)
 const rows:string[]=[],skipped:string[]=[];let created=0,reused=0
 for(const [id,p] of set){const old=previous.get(id);if(old){if(old.phone_number!==p||old.revoked_at||Date.parse(old.expires_at)<=Date.now()||!old.token_ciphertext){skipped.push(id+': existing link cannot be re-exported');continue}try{rows.push([id,p,req.nextUrl.origin+'/s/'+decrypt(old.token_ciphertext)].map(quote).join(','));reused++}catch{skipped.push(id+': cannot decrypt link')}continue}
 const token=randomBytes(32).toString('base64url')
 const {error:err}=await db.from('survey_invitations').insert({customer_id:id,phone_number:p,token_hash:createHash('sha256').update(token).digest('hex'),token_ciphertext:encrypt(token),expires_at:new Date(Date.now()+14*86400000).toISOString()})
 if(err){skipped.push(id+': insert failed '+err.code);continue}rows.push([id,p,req.nextUrl.origin+'/s/'+token].map(quote).join(','));created++
 }
 return NextResponse.json({csv:'\uFEFFcustomer_id,phone_number,survey_link\r\n'+rows.join('\r\n')+'\r\n',created,reused,skipped},{headers:h})
 }catch(e){const message=e instanceof Error?e.message:'unknown';console.error('Link generation error',message);const hint=message.includes('SURVEY_LINK_ENCRYPTION_KEY')||message==='Invalid encryption key'?'Kunci enkripsi belum valid di Cloudflare Worker.':message.startsWith('Lookup')?'Supabase menolak pembacaan undangan ('+message.replace('Lookup ','')+').':message.includes('Invalid URL')?'URL Supabase tidak valid.':'Kesalahan server. Periksa Cloudflare Observability Logs.';return NextResponse.json({error:hint},{status:500,headers:h})}
}