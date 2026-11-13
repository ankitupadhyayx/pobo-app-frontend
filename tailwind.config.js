/**
 * Design tokens ported from the AI Studio prototype (Tailwind defaults: teal/slate palette,
 * rose = overdue/breach, amber = float/warning, blue = visits, emerald = success).
 * Semantic aliases below are what components should prefer.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0d9488', // teal-600
          dark: '#0f766e', // teal-700
          deep: '#134e4a', // teal-900
          ink: '#042f2e', // teal-950
          soft: '#f0fdfa', // teal-50
          tint: '#ccfbf1', // teal-100
        },
        surface: '#f1f5f9', // slate-100 app background
        ink: '#0f172a', // slate-900 primary text
        muted: '#64748b', // slate-500 secondary text
        line: '#e2e8f0', // slate-200 borders
        danger: '#e11d48', // rose-600
        warn: '#d97706', // amber-600
        ok: '#059669', // emerald-600
        info: '#1d4ed8', // blue-700
      },
      borderRadius: {
        card: '16px',
        hero: '24px',
      },
    },
  },
  plugins: [],
};
