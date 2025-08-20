import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#191919",
        card: {
          DEFAULT: "#060717",
          foreground: "#C0CAE1"
        },
        accent: {
          purple: "#FF3EFF",
          blue: "#41BEEE"
        },
        text: {
          primary: "#C0CAE1",
          secondary: "#E1E1E1"
        }
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(to bottom left, #FF3EFF, #41BEEE)',
        'gradient-background': 'linear-gradient(to bottom right, #FF3EFF, #191919 30%, #191919 70%, #41BEEE)',
      },
      boxShadow: {
        'neon': 'inset 0px 0px 4px 3px rgba(255,62,255,0.21), inset 0px -2px 4px 1px rgba(71,186,239,0.40)',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;