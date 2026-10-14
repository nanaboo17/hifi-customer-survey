import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Pengecekan Penggunaan Internet Pelanggan | HiFi',
  description: 'Survei singkat untuk membantu meningkatkan pengalaman internet pelanggan HiFi.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={sans.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
