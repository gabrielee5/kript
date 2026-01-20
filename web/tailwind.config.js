/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
      fontSize: {
        tiny: '0.625rem',
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
      },
      colors: {
        border: '#e5e7eb',
        'border-hover': '#9ca3af',
        'border-focus': '#d1d5db',
        'text-primary': '#000',
        'text-secondary': '#6b7280',
        'text-tertiary': '#9ca3af',
        'text-disabled': '#d1d5db',
        'bg-primary': '#fff',
        'bg-secondary': '#f9fafb',
        'bg-tertiary': '#fafafa',
        success: {
          bg: '#f0fdf4',
          border: '#bbf7d0',
          text: '#166534',
          solid: '#22c55e',
        },
        danger: {
          bg: '#fef2f2',
          border: '#fecaca',
          text: '#991b1b',
          solid: '#ef4444',
        },
        warning: {
          bg: '#fefce8',
          border: '#fef08a',
          text: '#854d0e',
          solid: '#eab308',
        },
      },
      borderWidth: {
        DEFAULT: '0.85px',
      },
      borderRadius: {
        none: '0',
      },
      spacing: {
        tiny: '0.125rem',
        xs: '0.375rem',
        sm: '0.625rem',
        md: '0.9375rem',
        lg: '1.25rem',
        xl: '1.875rem',
        '2xl': '2.5rem',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      animation: {
        spin: 'spin 1s linear infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
