import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      colors: {
        pg: {
          'bg-primary':   '#1a1c2e',
          'bg-secondary': '#252742',
          'bg-tertiary':  '#2f3259',
          'accent-yellow':'#ffd700',
          'accent-red':   '#e63946',
          'accent-blue':  '#4fc3f7',
          'accent-purple':'#9c6ade',
          'text-primary': '#f0f0f0',
          'text-secondary':'#a0aec0',
          'text-muted':   '#6b7a99',
          'rarity-common':   '#a8b5c2',
          'rarity-rare':     '#4fc3f7',
          'rarity-epic':     '#c678dd',
          'rarity-legendary':'#ffd700',
          'rarity-mythic':   '#ff6b9d',
          'rarity-shiny':    '#ffe066',
        },
      },
      fontFamily: {
        display: ['Bangers', 'cursive'],
        sans:    ['Nunito', 'sans-serif'],
      },
      borderRadius: {
        pg: '12px',
        'pg-lg': '16px',
        'pg-xl': '24px',
      },
      boxShadow: {
        'glow-yellow': '0 0 16px rgba(255,215,0,0.4)',
        'glow-purple': '0 0 16px rgba(156,106,222,0.4)',
        'glow-blue':   '0 0 16px rgba(79,195,247,0.4)',
        'glow-pink':   '0 0 20px rgba(255,107,157,0.5)',
      },
      animation: {
        'float':        'float 3s ease-in-out infinite',
        'float-slow':   'float-slow 5s ease-in-out infinite',
        'shimmer':      'shimmer 1.5s infinite',
        'pulse-gold':   'pulse-gold 2s ease-in-out infinite',
        'spin-slow':    'spin-slow 8s linear infinite',
        'scale-in':     'scale-in 0.3s ease',
        'slide-down':   'slide-down 0.3s ease',
        'slide-right':  'slide-right 0.3s ease',
        'twinkle':      'twinkle 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
