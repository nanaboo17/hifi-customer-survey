import 'server-only'
import { createHmac, timingSafeEqual, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
export const COOKIE='hifi_staff_session'
function setting(k:string){let x:unknown;try{x=(getCloudflareContext().env as unknown as Record<string,unknown>)[k]}catch{};if(typeof x!=='string'||!x)x=process.env[k];if(typeof x!=='string'||!x)throw Error(k+' missing');return x}
function same(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length && timingSafeEqual(x,y)}
function sign(v:string){return createHmac('sha256',setting('UPLOAD_SESSION_SECRET')).update(v).digest('base64url')}
export function passwordOK(s:string){const p=setting('UPLOAD_ADMIN_PASSWORD');return p.length>=16&&same(s,p)}
export function session(){const v=String(Math.floor(Date.now()/1000)+28800)+'.'+randomBytes(12).toString('base64url');return v+'.'+sign(v)}
export function staff(req:NextRequest){const t=req.cookies.get(COOKIE)?.value||'';const a=t.split('.');return a.length===3&&Number(a[0])>Date.now()/1000&&same(a[2],sign(a[0]+'.'+a[1]))}
export function originOK(req:NextRequest){return req.headers.get('origin')===req.nextUrl.origin}
function key(){const x=Buffer.from(setting('SURVEY_LINK_ENCRYPTION_KEY'),'base64');if(x.length!==32)throw Error('Invalid encryption key');return x}
export function encrypt(t:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);const out=Buffer.concat([c.update(t),c.final()]);return [iv.toString('base64url'),c.getAuthTag().toString('base64url'),out.toString('base64url')].join('.')}
export function decrypt(t:string){const [i,a,v]=t.split('.');const c=createDecipheriv('aes-256-gcm',key(),Buffer.from(i,'base64url'));c.setAuthTag(Buffer.from(a,'base64url'));return Buffer.concat([c.update(Buffer.from(v,'base64url')),c.final()]).toString()}
