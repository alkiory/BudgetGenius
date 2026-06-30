import type { Config } from "tailwindcss"
import animated from "tailwindcss-animated";

const config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  prefix: "",
  theme: {
    extend: {
      fontFamily: {
        display: ['"system-ui"', '"Avenir"', '"Helvetica"', '"Arial"', 'sans-serif'],
        serif: [
          '"Playfair Display"',
          'ui-serif',
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'Times',
          'serif',
        ],
      },
      colors: {
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        neutral: {
          50: "rgb(var(--neutral-50) / <alpha-value>)",
          DEFAULT: "rgb(var(--neutral) / <alpha-value>)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        loading: {
          '0%': { left: '-33%' },
          '100%': { left: '100%' },
        },
        gradient: {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        particle: {
          '0%': { 
            transform: 'translateY(0) translateX(0)',
            opacity: '1'
          },
          '100%': { 
            transform: 'translateY(-100vh) translateX(-50vw)',
            opacity: '0'
          },
        },
        reveal: {
          from: { 
            opacity: '0',
            clipPath: 'inset(45% 20% 45% 20%)'
          },
          to: { 
            opacity: '1',
            clipPath: 'inset(0% 0% 0% 0%)'
          },
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        loading: 'loading 1.5s ease-in-out infinite',
        gradient: 'gradient 10s ease infinite',
        particle: 'particle 5s linear infinite',
        reveal: 'linear reveal both',
      },
    },
  },
  plugins: [
    animated,
    function({ addUtilities }) {
      addUtilities({
        '.animate-gradient': {
          'background-size': '200% 200%',
          'animation': 'gradient 10s ease infinite',
        },
        '.animate-particle': {
          'animation': 'particle 5s linear infinite',
        },
        '.revealing-image': {
          'view-timeline-name': '--revealing-image',
          'view-timeline-axis': 'block',
          'animation': 'linear reveal both',
          'animation-timeline': '--revealing-image',
          'animation-range': 'entry 25% cover 50%',
        },
        '.selection-style': {
          '&::selection': {
            'color': 'rgb(var(--muted))',
            'background-color': 'rgb(var(--muted-foreground))',
          },
          '&::-moz-selection': {
            'color': 'rgb(var(--muted))',
            'background-color': 'rgb(var(--muted-foreground))',
          },
        },
        '.scrollbar-style': {
          '&::-webkit-scrollbar': {
            'width': '8px',
            'background-color': 'rgb(var(--secondary))',
          },
          '&::-webkit-scrollbar-thumb': {
            'background-color': 'rgb(var(--primary))',
            'border-radius': '4px',
          },
        },
        '.smooth-hover': {
          '&:hover': {
            'transition': '0.2s',
          },
        },
      })
    }
  ],
} satisfies Config

export default config