/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        military: {
          50: '#F4F7F5',
          100: '#E6EDE8',
          200: '#CBDCD0',
          300: '#A7C4B0',
          400: '#7FA68C',
          500: '#5A886B',
          600: '#436C52',
          700: '#345541',
          800: '#2B4435',
          900: '#24382C',
          950: '#131E17',
        },
        brandRed: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
