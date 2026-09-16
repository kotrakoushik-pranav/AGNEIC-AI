/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: '#FFFFFF',
        panel: '#FFFFFF',
        'panel-hover': '#FEFCE8',
        border: '#EAB308',
        'border-bright': '#D97706',
        accent: '#EAB308',
        'accent-dim': '#D97706',
        critical: '#DC2626',
        'critical-dim': '#B91C1C',
        warning: '#D97706',
        'warning-dim': '#B45309',
        success: '#16A34A',
        muted: '#6B7280',
        'text-primary': '#1F2937',
        'text-secondary': '#4B5563',
        gold: '#FACC15',
        'gold-deep': '#EAB308',
        'gold-dark': '#D97706',
        'gold-glow': 'rgba(234,179,8,0.35)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-ring': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'gold-glow': 'goldGlow 2s ease-in-out infinite',
        'string-pluck': 'stringPluck 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'nav-shimmer': 'navShimmer 0.5s ease-out forwards',
      },
      keyframes: {
        goldGlow: {
          '0%, 100%': { boxShadow: '0 0 4px 1px rgba(234,179,8,0.3)' },
          '50%': { boxShadow: '0 0 12px 4px rgba(234,179,8,0.6)' },
        },
        stringPluck: {
          '0%':   { transform: 'translateX(0) scaleX(1)' },
          '20%':  { transform: 'translateX(4px) scaleX(0.97)' },
          '40%':  { transform: 'translateX(-3px) scaleX(1.02)' },
          '60%':  { transform: 'translateX(2px) scaleX(0.99)' },
          '80%':  { transform: 'translateX(-1px) scaleX(1.005)' },
          '100%': { transform: 'translateX(0) scaleX(1)' },
        },
        navShimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'gold-sm':  '0 1px 4px 0 rgba(234,179,8,0.18)',
        'gold-md':  '0 4px 16px 0 rgba(234,179,8,0.22)',
        'gold-lg':  '0 8px 32px 0 rgba(234,179,8,0.28)',
        'gold-glow':'0 0 16px 4px rgba(250,204,21,0.45)',
        'card':     '0 2px 8px 0 rgba(30,30,30,0.07)',
        'card-hover':'0 6px 24px 0 rgba(234,179,8,0.18)',
      },
    },
  },
  plugins: [],
}
