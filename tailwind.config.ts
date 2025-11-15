import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'page-bg': '#E3F06F',
        'card-bg': '#FFFFFF',
        'accent-primary': '#7C4DFF',
        'accent-primary-soft': '#EEE7FF',
        'accent-success': '#36C170',
        'accent-success-soft': '#E3F8ED',
        'accent-warning': '#FFC857',
        'text-primary': '#1A1A1E',
        'text-secondary': '#6F7280',
        'text-muted': '#A3A7B5',
        'subtle-bg': '#F7F8FB',
        'border-subtle': '#E5E7F0',
      },
      fontFamily: {
        'display': ['var(--font-display)', 'sans-serif'],
        'body': ['var(--font-body)', 'sans-serif'],
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
export default config
