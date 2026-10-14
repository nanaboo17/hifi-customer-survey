import {NextRequest,NextResponse} from 'next/server'
import {COOKIE,originOK} from '@/lib/upload-security'
export async function POST(req:NextRequest){if(!originOK(req))return NextResponse.json({error:'Forbidden'},{status:403});const res=NextResponse.json({ok:true});res.cookies.set(COOKIE,'',{path:'/',maxAge:0,httpOnly:true,secure:process.env.NODE_ENV==='production'});return res}