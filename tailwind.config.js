/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        bone: {
          50: '#FBF8F3',
          100: '#F6F1E7',
          200: '#EDE4D3',
        },
        ink: {
          900: '#0B1220',
          800: '#0F172A',
          700: '#141F38',
          600: '#1C2A4A',
        },
        profit: '#16A34A',
        loss: '#DC2626',
        accent: {
          DEFAULT: '#111318',
          light: '#2B2E37',
        },
      },
      boxShadow: {
        soft: '0 4px 20px rgba(0,0,0,0.04)',
        glow: '0 0 60px rgba(17,19,24,0.35)',
      },
    },
  },
  plugins: [],
};
