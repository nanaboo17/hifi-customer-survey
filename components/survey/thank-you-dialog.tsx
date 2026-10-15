'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Check, PartyPopper } from 'lucide-react'

type Props={open:boolean;onOpenChange:(open:boolean)=>void}
export function ThankYouDialog({open,onOpenChange}:Props){
 return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
  <Dialog.Overlay className="fixed inset-0 z-50 bg-[#22152f]/75"/>
  <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 border-[4px] border-[#22152f] bg-white p-7 text-center shadow-[9px_9px_0_#ffce00] outline-none sm:p-10">
   <div className="mx-auto flex h-20 w-20 -rotate-6 items-center justify-center rounded-lg border-4 border-[#22152f] bg-[#26890c] text-white shadow-[5px_5px_0_#22152f]"><Check size={42} strokeWidth={4}/></div>
   <Dialog.Title className="mt-7 text-3xl font-black leading-tight text-[#22152f]">Jawaban terkirim!</Dialog.Title>
   <Dialog.Description className="mt-3 text-sm font-medium leading-7 text-[#62586b]">Terima kasih sudah meluangkan waktu. Masukan Anda membantu HiFi meningkatkan kualitas layanan internet.</Dialog.Description>
   <button type="button" onClick={()=>onOpenChange(false)} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-md border-[3px] border-[#22152f] bg-[#4924ac] px-6 font-black text-white shadow-[4px_4px_0_#22152f] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"><PartyPopper size={19}/> Selesai</button>
  </Dialog.Content>
 </Dialog.Portal></Dialog.Root>
}
