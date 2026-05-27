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
          50:  '#ecfdf9',
          100: '#ccfbef',
          500: '#00e5a0',
          600: '#00c98f',
          700: '#00a374',
          800: '#007a57',
          900: '#004d36',
        },
      },
    },
  },
  plugins: [],
}
export default config
