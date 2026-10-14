'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type AnswerArtworkProps = {
  src: string
  alt: string
  Icon: LucideIcon
  active: boolean
}

export function AnswerArtwork({ src, alt, Icon, active }: AnswerArtworkProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      className={cn(
        'relative flex h-[80px] w-full items-center justify-center overflow-hidden rounded-lg transition-colors duration-200 sm:h-[100px]',
        active ? 'bg-brand-soft' : 'bg-slate-50 group-hover:bg-slate-100'
      )}
    >
      {/* Fallback icon: always rendered so a missing image never shows a broken-image glyph */}
      <span
        className={cn(
          'transition-all duration-200',
          active ? 'text-brand' : 'text-slate-400 group-hover:text-slate-500',
          loaded ? 'scale-90 opacity-0' : 'scale-100 opacity-100'
        )}
        aria-hidden={loaded}
      >
        <Icon className="h-9 w-9" strokeWidth={1.5} aria-hidden />
      </span>

      {/* Real image is revealed only after a successful load */}
      <Image
        src={src}
        alt={alt}
        width={220}
        height={180}
        sizes="(max-width: 640px) 40vw, 200px"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
        className={cn(
          'absolute h-full w-full object-contain p-2.5 transition-opacity duration-200',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  )
}
