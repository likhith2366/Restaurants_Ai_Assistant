/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0E0B08", // page background
          800: "#16110C", // sunken
          700: "#1E1812", // surface
          600: "#2A2218", // raised surface
          500: "#3A2F23", // border
        },
        cream: {
          50: "#FBF6EE",
          100: "#F4EBDD",
          200: "#E7D8BF",
          300: "#C9B79A",
          400: "#A39788",
          500: "#7B7060",
        },
        gold: {
          400: "#E5B16A",
          500: "#C6913C", // primary accent
          600: "#A57523",
        },
        ember: {
          500: "#D14A2A", // spicy accent
        },
        leaf: {
          500: "#7C9A4B", // veg/healthy accent
        },
      },
      fontFamily: {
        display: ["Fraunces_700Bold"],
        displayItalic: ["Fraunces_500Medium_Italic"],
        serif: ["Fraunces_400Regular"],
        sans: ["Inter_400Regular"],
        sansMed: ["Inter_500Medium"],
        sansSemi: ["Inter_600SemiBold"],
        sansBold: ["Inter_700Bold"],
      },
    },
  },
  plugins: [],
};
