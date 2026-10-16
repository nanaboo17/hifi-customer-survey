import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pengecekan Penggunaan Internet Pelanggan | HiFi',
  description: 'Survei singkat untuk membantu meningkatkan pengalaman internet pelanggan HiFi.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
