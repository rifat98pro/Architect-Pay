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
        // Primary action color — teal (the "P" from the logo)
        brand: {
          50:  '#e6f8f7',
          100: '#b3ece9',
          200: '#80e0db',
          300: '#4dd4ce',
          400: '#26c2bc',
          500: '#2aabab',
          600: '#228e8e',
          700: '#1a7070',
          800: '#125252',
          900: '#0a3535',
        },
        // Navy-tinted gray scale — matches the "A" from the logo
        gray: {
          50:  '#e8eef5',
          100: '#d0dcea',
          200: '#adc0d4',
          300: '#88a3bc',
          400: '#6485a0',
          500: '#496880',
          600: '#334d62',
          700: '#1e3448',
          800: '#112338',
          900: '#0d1926',
          950: '#07111a',
        },
      },
    },
  },
  plugins: [],
}
export default config
