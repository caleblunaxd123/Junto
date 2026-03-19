/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#534AB7',
          50: '#EEEDFE',
        },
        verde: '#1D9E75',
        rojo: '#E24B4A',
        ambar: '#BA7517',
        fondo: '#F8F8F8',
        texto: {
          DEFAULT: '#1A1A1A',
          secundario: '#6B7280',
          hint: '#9CA3AF',
        },
      },
      borderRadius: {
        card: '12px',
        btn: '12px',
      },
    },
  },
  plugins: [],
};
