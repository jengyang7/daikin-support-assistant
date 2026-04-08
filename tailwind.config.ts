import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0097E0",
          dark: "#0079b3",
          light: "#e6f5fc",
        },
        sidebar: {
          DEFAULT: "#ffffff",
          hover: "#f0f5ff",
          active: "#f0f5ff",
          border: "#e2e8f0",
        },
        chatbg: "#f5f7fa",
        bubble: {
          assistant: "#ffffff",
          user: "#54C3F1",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "pulse-dot": "pulse-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
