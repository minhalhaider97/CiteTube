/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          red: '#FF3B3B',
          darkBg: '#0D0D0E',
          cardBg: '#141416',
          sidebarBg: '#101012',
          border: '#232326',
        }
      }
    },
  },
  plugins: [],
}
