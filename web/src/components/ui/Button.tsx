import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    // Base styles with mobile touch target (min-h-[44px] on mobile, normal on desktop)
    const baseStyles = 'font-mono transition-all duration-150 cursor-pointer disabled:cursor-not-allowed min-h-[44px] md:min-h-0 active:scale-[0.98] active:opacity-90';

    const variants = {
      primary: 'bg-black text-white border-none hover:bg-gray-700 disabled:bg-gray-300',
      secondary: 'bg-white text-black border border-border hover:bg-bg-secondary hover:border-border-hover disabled:bg-gray-100 disabled:text-text-disabled',
      danger: 'bg-danger-solid text-white border-none hover:bg-red-600 disabled:bg-red-300',
    };

    // Sizes with mobile-friendly padding (larger touch targets on mobile)
    const sizes = {
      sm: 'px-md py-xs text-sm md:px-sm md:py-tiny md:text-xs',
      md: 'px-lg py-sm text-base md:text-sm',
      lg: 'px-xl py-md text-base',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-sm">
            <span className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
            Loading...
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
