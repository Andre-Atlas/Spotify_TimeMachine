/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Papel frio de ficha de arquivo — não o creme quente de sempre.
        paper: { DEFAULT: '#E9EAE5', raised: '#F5F6F2', sunk: '#DCDED7' },
        ink: { DEFAULT: '#16181A', 2: '#4E5457', 3: '#7C8285', 4: '#A3A8A6' },
        rule: { DEFAULT: '#C6C9C1', soft: '#D6D8D1' },
        // O painel do relógio é o único objeto escuro da página.
        night: { DEFAULT: '#0C0D10', 2: '#16171C' },
        nixie: { DEFAULT: '#FF9C1A', glow: '#FFD79B', deep: '#C25A00' },
      },
      fontFamily: {
        display: ['"Bodoni Moda"', 'Didot', '"Times New Roman"', 'serif'],
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        data: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: { mega: '.42em' },
      keyframes: {
        tubeFlicker: {
          '0%,100%': { opacity: '1' },
          '38%': { opacity: '.88' },
          '41%': { opacity: '1' },
          '77%': { opacity: '.93' },
        },
        spinDisc: { to: { transform: 'rotate(360deg)' } },
        rise: { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        sweep: { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(220%)' } },
      },
      animation: {
        tubeFlicker: 'tubeFlicker 5s ease-in-out infinite',
        spinDisc: 'spinDisc 1.8s linear infinite',
        rise: 'rise .5s cubic-bezier(.16,1,.3,1) both',
        sweep: 'sweep 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
