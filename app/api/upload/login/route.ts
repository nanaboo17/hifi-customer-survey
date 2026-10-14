import {NextRequest,NextResponse} from 'next/server'
import {COOKIE,originOK,passwordOK,session} from '@/lib/upload-security'
export const runtime='nodejs'
export async function POST(req:NextRequest){
 if(!originOK(req))return NextResponse.json({error:'Invalid origin'},{status:403})
 try{const v=await req.json();if(typeof v.password!=='string'||v.password.length>200||!passwordOK(v.password))return NextResponse.json({error:'Password salah.'},{status:401})
 const res=NextResponse.json({ok:true});res.cookies.set(COOKIE,session(),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:28800});return res
 }catch{return NextResponse.json({error:'Login gagal atau konfigurasi belum lengkap.'},{status:500})}
}