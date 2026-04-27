/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0E1422",
        card: "#1e293b",
        primary: "#3B82F6",
      }
    },
  },
  plugins: [],
}
