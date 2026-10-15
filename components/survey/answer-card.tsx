'use client'

import { Check, Home, MessageCircle, Power, Router, Wallet, Wifi } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AnswerArtwork } from './answer-artwork'
import { cn } from '@/lib/utils'
import type { Reason, ReasonIcon, ReasonOption } from '@/lib/survey'

const ICONS: Record<ReasonIcon, LucideIcon> = {wifi:Wifi,home:Home,router:Router,wallet:Wallet,power:Power,message:MessageCircle}
const COLORS=['bg-[#e21b3c]','bg-[#1368ce]','bg-[#d89e00]','bg-[#26890c]','bg-[#864cbf]','bg-[#e16c12]']
const ICON_COLORS=['bg-[#ffd5df] text-[#c00835]','bg-[#d6eaff] text-[#0653ae]','bg-[#fff1be] text-[#a36900]','bg-[#d9facb] text-[#246f0b]','bg-[#edddff] text-[#6f2fab]','bg-[#ffe5cb] text-[#ad4900]']

type Props={item:ReasonOption;index:number;active:boolean;disabled:boolean;onSelect:(id:Reason)=>void}
export function AnswerCard({item,index,active,disabled,onSelect}:Props){
 const Icon=ICONS[item.icon]
 return <label className={cn('group relative flex min-h-[202px] cursor-pointer flex-col overflow-hidden rounded-[6px] border-[3px] border-[#22152f] text-white shadow-[5px_5px_0_#22152f] transition-[transform,box-shadow,filter] duration-150 sm:min-h-[238px]',COLORS[index%COLORS.length],active?'translate-x-[3px] translate-y-[3px] ring-4 ring-[#ffce00] ring-offset-2 shadow-[2px_2px_0_#22152f]':'hover:-translate-y-1 hover:shadow-[5px_9px_0_#22152f]',disabled&&'pointer-events-none opacity-70')}>
  <input type="radio" name="survey-reason" value={item.id} checked={active} disabled={disabled} onChange={()=>onSelect(item.id)} className="peer sr-only"/>
  <div className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-md border-2 border-white bg-black/15 text-sm font-black">{active?<Check size={22} strokeWidth={4}/>:String.fromCharCode(65+index)}</div>
  <div className="relative mx-auto mt-4 w-[80%] max-w-[180px] rounded-xl bg-white/95 p-2 shadow-[0_3px_0_rgba(0,0,0,.18)]"><AnswerArtwork src={`/images/${item.file}`} alt="" Icon={Icon} active={active}/><span aria-hidden className={cn("absolute -bottom-2 -left-2 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white shadow-sm",ICON_COLORS[index%ICON_COLORS.length])}><Icon size={21} strokeWidth={2.6}/></span></div>
  <div className="flex min-h-[70px] flex-1 items-center justify-center px-3 py-4 text-center text-[14px] font-black leading-snug sm:text-[16px]">{item.title}</div>
 </label>
}
