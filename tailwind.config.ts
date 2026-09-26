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
        // Teal accent — the "P" from the logo
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
        // Navy — the "A" from the logo, used for surfaces
        navy: {
          50:  '#e8eef8',
          100: '#c5d3ed',
          200: '#9db4e2',
          300: '#6e93d4',
          400: '#4a79c8',
          500: '#2d61bb',
          600: '#234fa0',
          700: '#1b3d82',
          800: '#122c64',
          900: '#0b1e47',
          950: '#060e28',
        },
        // Navy-tinted grays for surfaces (not pure gray, not pure teal)
        gray: {
          50:  '#f0f4f8',
          100: '#dce4ee',
          200: '#b8c9dd',
          300: '#8faab8',
          400: '#637d96',
          500: '#45607a',
          600: '#324862',
          700: '#1f3249',
          800: '#122031',
          900: '#0b1624',
          950: '#060d19',
        },
      },
      backgroundImage: {
        'ap-gradient':      'linear-gradient(135deg, #0b1e47 0%, #0a3535 100%)',
        'ap-gradient-card': 'linear-gradient(135deg, #112840 0%, #0d3030 100%)',
        'teal-glow':        'radial-gradient(ellipse at top, #2aabab18 0%, transparent 70%)',
      },
      boxShadow: {
        'teal':        '0 0 20px rgba(42, 171, 171, 0.15)',
        'teal-sm':     '0 0 10px rgba(42, 171, 171, 0.12)',
        'teal-lg':     '0 0 40px rgba(42, 171, 171, 0.2)',
        'navy':        '0 4px 24px rgba(11, 30, 71, 0.4)',
      },
    },
  },
  plugins: [],
}
export default config
