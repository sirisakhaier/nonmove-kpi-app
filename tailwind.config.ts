import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        haier: {
          blue: '#0057A8',
          light: '#E8F1FA',
        },
      },
      fontFamily: {
        sans: ['Sarabun', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
