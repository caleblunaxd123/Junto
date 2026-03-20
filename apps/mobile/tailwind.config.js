/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366F1', // Indigo-500
          dark: '#4F46E5',   // Indigo-600
          light: '#818CF8',  // Indigo-400
          50: '#F5F3FF',
        },
        accent: {
          DEFAULT: '#8B5CF6', // Violet-500
          light: '#A78BFA',  // Violet-400
        },
        success: '#10B981',   // Emerald-500
        danger: '#EF4444',    // Red-500
        warning: '#F59E0B',   // Amber-500
        background: '#F9FAFB', // Slate-50
        surface: '#FFFFFF',
        text: {
          DEFAULT: '#111827', // Gray-900
          muted: '#6B7280',   // Gray-500
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
