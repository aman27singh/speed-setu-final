/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        setu: {
          50: '#f0f5fe',
          100: '#e0ebfe',
          200: '#bae0fd',
          300: '#7cc7fd',
          400: '#36a9fa',
          500: '#0c8df1',
          600: '#0052cc', // Primary Speed Setu Navy/Blue
          700: '#0043aa',
          800: '#043789',
          900: '#0a306c',
          950: '#071e47',
        },
        orange: {
          50: '#fff8f5',
          100: '#feece5',
          500: '#ff6b35', // Accent Speed Setu Orange
          600: '#ea541e',
          700: '#c43e12',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
