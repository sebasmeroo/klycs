/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mantener los colores personalizados de la aplicación
        primary: '#6366f1',
        'primary-dark': '#4f46e5',
        'primary-light': '#818cf8',
      },
    },
  },
  plugins: [],
} 