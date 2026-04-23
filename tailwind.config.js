/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          50: '#eef7ff',
          100: '#d8edff',
          200: '#b9e0ff',
          300: '#89cfff',
          400: '#51b4ff',
          500: '#2896ff',
          600: '#0d6efd',
          700: '#0a58ca',
          800: '#0c4aa6',
          900: '#0e3f84',
          950: '#082857',
        },
        shield: {
          50: '#edfcf2',
          100: '#d3f8e0',
          200: '#aaf0c6',
          300: '#73e3a5',
          400: '#3ace7e',
          500: '#16b364',
          600: '#0a9150',
          700: '#087442',
          800: '#095c37',
          900: '#084c2f',
          950: '#032b19',
        },
        slate: {
          850: '#172033',
          925: '#0f172a',
        }
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'float-slow': 'float 8s ease-in-out 1s infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'pulse-glow-delayed': 'pulse-glow 2s ease-in-out 1s infinite',
        'slide-up': 'slide-up 0.6s ease-out',
        'slide-up-delayed': 'slide-up 0.6s ease-out 0.15s both',
        'slide-up-delayed-2': 'slide-up 0.6s ease-out 0.3s both',
        'slide-up-delayed-3': 'slide-up 0.6s ease-out 0.45s both',
        'fade-in': 'fade-in 0.5s ease-out',
        'fade-in-delayed': 'fade-in 0.5s ease-out 0.2s both',
        'scale-in': 'scale-in 0.4s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'scan-line': 'scan-line 3s linear infinite',
        'border-glow': 'border-glow 3s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'typewriter': 'typewriter 2s steps(20) forwards',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
        'shield-pulse': 'shield-pulse 2.5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 20px rgba(13, 110, 253, 0.3)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 40px rgba(13, 110, 253, 0.6)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'border-glow': {
          '0%, 100%': { borderColor: 'rgba(13, 110, 253, 0.3)' },
          '50%': { borderColor: 'rgba(13, 110, 253, 0.8)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        typewriter: {
          '0%': { width: '0' },
          '100%': { width: '100%' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'shield-pulse': {
          '0%, 100%': { transform: 'scale(1)', filter: 'drop-shadow(0 0 8px rgba(13, 110, 253, 0.4))' },
          '50%': { transform: 'scale(1.05)', filter: 'drop-shadow(0 0 20px rgba(13, 110, 253, 0.7))' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'cyber-mesh': 'linear-gradient(135deg, #0f172a 0%, #1e293b 25%, #0c4aa6 50%, #1e293b 75%, #0f172a 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
