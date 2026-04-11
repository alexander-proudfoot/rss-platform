import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        proudfoot: {
          navy: '#003A4D',
          cyan: '#02B4BF',
          slate: '#334155',
        },
      },
    },
  },
} satisfies Config
