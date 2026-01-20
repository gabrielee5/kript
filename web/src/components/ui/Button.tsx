import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles = 'font-mono transition-all duration-150 cursor-pointer disabled:cursor-not-allowed';

    const variants = {
      primary: 'bg-black text-white border-none hover:bg-gray-700 disabled:bg-gray-300',
      secondary: 'bg-white text-black border border-border hover:bg-bg-secondary hover:border-border-hover disabled:bg-gray-100 disabled:text-text-disabled',
      danger: 'bg-danger-solid text-white border-none hover:bg-red-600 disabled:bg-red-300',
    };

    const sizes = {
      sm: 'px-sm py-tiny text-xs',
      md: 'px-lg py-sm text-sm',
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
