/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0b0f19",
        card: "#161f30",
        border: "#1e293b",
        accent: "#8b5cf6", // Violeta Elétrico
        success: "#10b981", // Verde Esmeralda (BACK)
        danger: "#f43f5e", // Vermelho Carmim (LAY)
        muted: "#94a3b8",
      },
    },
  },
  plugins: [],
}
