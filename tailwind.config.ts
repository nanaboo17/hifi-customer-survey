import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Arial', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#17243B',
        muted: '#64748B',
        line: '#E2E8F0',
        canvas: '#F8FAFC',
        brand: {
          DEFAULT: '#ED174C',
          hover: '#CE0F40',
          soft: '#FFF0F4',
        },
        success: '#16A34A',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        pop: {
          from: { opacity: '0', transform: 'translate(-50%,-49%) scale(.985)' },
          to: { opacity: '1', transform: 'translate(-50%,-50%) scale(1)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out both',
        pop: 'pop .2s ease-out both',
        'fade-up': 'fade-up .35s ease-out backwards',
      },
    },
  },
  plugins: [],
}

export default config
