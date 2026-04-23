/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#141418',
        surface: '#1E1E24',
        border: '#2A2A35',
        'text-primary': '#F0F0F5',
        'text-secondary': '#8A8A9A',
        'text-disabled': '#4A4A5A',
        cyan: '#4FC3F7',
        blue: '#2979FF',
        deep: '#1A237E',
        success: '#00E676',
        warning: '#FFB300',
        error: '#FF5252',
      },
    },
  },
  plugins: [],
}
