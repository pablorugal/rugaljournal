/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      colors: {
        bone: {
          50: 'rgb(var(--c-bone-50) / <alpha-value>)',
          100: 'rgb(var(--c-bone-100) / <alpha-value>)',
          200: 'rgb(var(--c-bone-200) / <alpha-value>)',
        },
        ink: {
          900: 'rgb(var(--c-ink-900) / <alpha-value>)',
          800: 'rgb(var(--c-ink-800) / <alpha-value>)',
          700: 'rgb(var(--c-ink-700) / <alpha-value>)',
          600: 'rgb(var(--c-ink-600) / <alpha-value>)',
        },
        brand: {
          DEFAULT: '#D4AF6A',
          soft: '#EBD9A8',
          deep: '#B38A3C',
        },
        profit: 'rgb(var(--c-profit) / <alpha-value>)',
        loss: 'rgb(var(--c-loss) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          light: 'rgb(var(--c-accent-light) / <alpha-value>)',
        },
      },
      boxShadow: {
        soft: '0 4px 20px rgba(0,0,0,0.04)',
        glow: '0 0 60px rgba(212,175,106,0.18)',
      },
    },
  },
  plugins: [],
};
