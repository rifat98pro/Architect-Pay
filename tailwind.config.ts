import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff4ff',
          100: '#dbe8fe',
          500: '#6b9ee8',
          600: '#4f83d4',
          700: '#3a6bbf',
          800: '#2a52a0',
          900: '#1a3470',
        },
      },
    },
  },
  plugins: [],
}
export default config
