/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Only the React port. The live page in /public is hand-written CSS and must
    // never be processed by Tailwind.
    './src/**/*.{ts,tsx}',
    './react/index.html'
  ],
  theme: {
    extend: {}
  },
  plugins: []
};