/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: { DEFAULT: '#0fa185', light: '#14bc9c', dark: '#097561' },
        surface: '#11100f',
        card: '#191817',
        border: '#2a2725',
        muted: '#9a958f',
      },
      animation: {
        'fade-up': 'fade-up 0.3s ease both',
        'spin-slow': 'spin 2s linear infinite',
      },
    },
  },
  plugins: [],
};
