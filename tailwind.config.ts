import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Daikin Support Assistant palette (matches mockups)
        sidebar: {
          DEFAULT: "#0f1f3d",
          hover: "#19294a",
          active: "#22325a",
          border: "#1a2a4a",
        },
        brand: {
          DEFAULT: "#19b8d6", // cyan accent (logo, send button)
          dark: "#0e8fa8",
        },
        chatbg: "#eef3f9",
        bubble: {
          assistant: "#ffffff",
          user: "#1f7ae0",
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
