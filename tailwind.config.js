/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        brand: 'var(--brand)',
        'brand-soft': 'var(--brand-soft)',
        'brand-ink': 'var(--brand-ink)',
        lines: 'var(--lines)',
        good: 'var(--good)',
        'good-soft': 'var(--good-soft)',
        warn: 'var(--warn)',
        'warn-soft': 'var(--warn-soft)',
        bad: 'var(--bad)',
        'bad-soft': 'var(--bad-soft)',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: ['"Public Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        card: '0 1px 2px var(--shadow-1), 0 8px 24px -12px var(--shadow-2)',
      },
      maxWidth: {
        content: '940px',
      },
    },
  },
  plugins: [],
}
