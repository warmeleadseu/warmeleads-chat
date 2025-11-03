/** @type {import('tailwindcss').Config} */
module.exports = {
  corePlugins: {
    preflight: true,
  },
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // WarmeLeads Brand Colors
        brand: {
          purple: "#3B2F75",
          pink: "#E74C8C", 
          orange: "#FF6B35",
          red: "#FF4757",
          navy: "#1A1A2E",
          gray: "#F8F9FA",
          success: "#2ECC71",
        },
        // Chat specific colors
        chat: {
          lisa: "#FFFFFF",
          user: "#E74C8C",
          background: "#F8F9FA",
          border: "#E5E7EB",
        }
      },
      backgroundImage: {
        'warmeleads-gradient': 'linear-gradient(135deg, #3B2F75 0%, #E74C8C 35%, #FF6B35 70%, #FF4757 100%)',
        'chat-gradient': 'linear-gradient(135deg, #E74C8C, #FF6B35)',
        'button-gradient': 'linear-gradient(135deg, #FF6B35, #FF4757)',
        'lisa-gradient': 'linear-gradient(135deg, #3B2F75, #E74C8C)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'bounce-gentle': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'typing': 'typing 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-10px)' },
        }
      },
      boxShadow: {
        'chat': '0 4px 20px rgba(59, 47, 117, 0.15)',
        'button': '0 4px 15px rgba(255, 107, 53, 0.3)',
        'lisa': '0 2px 10px rgba(231, 76, 140, 0.2)',
      },
      borderRadius: {
        'chat': '1.5rem',
        'button': '1rem',
      }
    },
  },
  plugins: [
    // Add custom utility classes
    function({ addUtilities }: any) {
      const newUtilities = {
        '.sr-only': {
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: '0',
        },
        '.focus-visible-ring': {
          '@apply focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2': {},
        },
      };
      addUtilities(newUtilities);
    },
  ],
};
