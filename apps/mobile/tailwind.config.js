/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#16A36A',
          dark: '#147A51',
          light: '#45C98C',
          50: '#E9F8F0',
        },
        accent: {
          DEFAULT: '#8B5CF6', // Violet-500
          light: '#A78BFA',  // Violet-400
        },
        success: '#10B981',   // Emerald-500
        danger: '#EF4444',    // Red-500
        warning: '#F59E0B',   // Amber-500
        background: '#F7F8F5',
        surface: '#FFFFFF',
        text: {
          DEFAULT: '#10243E',
          muted: '#607087',
          hint: '#9CA3AF',    // Gray-400
        },
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
        card: '20px',
        btn: '16px',
      },
      boxShadow: {
        premium: '0 4px 20px -2px rgba(99, 102, 241, 0.15)',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
    },
  },
  plugins: [],
};
