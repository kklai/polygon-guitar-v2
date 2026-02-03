/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
      colors: {
        spotify: {
          black: '#000000',
          dark: '#121212',
          gray: '#B3B3B3',
          yellow: '#FFD700',
          white: '#FFFFFF',
        }
      }
    },
  },
  plugins: [],
}
