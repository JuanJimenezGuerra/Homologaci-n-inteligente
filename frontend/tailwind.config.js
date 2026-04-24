/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#10b981',
        'primary-dark': '#065f46',
        'primary-light': '#d1fae5',
        accent: '#34d399',
        forest: '#064e3b',
      },
    },
  },
  plugins: [],
}
