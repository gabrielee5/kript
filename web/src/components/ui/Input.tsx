import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-tiny">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs text-text-secondary uppercase tracking-wide"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            bg-white border border-border px-lg py-sm
            font-mono text-base md:text-sm text-text-primary
            min-h-[44px] md:min-h-0
            transition-all duration-150
            hover:border-border-hover
            focus:border-black focus:outline-none
            placeholder:text-text-tertiary
            disabled:bg-bg-secondary disabled:text-text-disabled disabled:cursor-not-allowed
            ${error ? 'border-danger-solid' : ''}
            ${className}
          `}
          {...props}
        />
        {hint && !error && (
          <span className="text-xs text-text-tertiary">{hint}</span>
        )}
        {error && (
          <span className="text-xs text-danger-text">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
