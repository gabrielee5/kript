import { TextareaHTMLAttributes, forwardRef } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className = '', label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-tiny">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm text-text-secondary uppercase tracking-wide"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`
            bg-white border border-border px-lg py-sm
            font-mono text-base md:text-sm text-text-primary
            transition-all duration-150
            hover:border-border-hover
            focus:border-black focus:outline-none
            placeholder:text-text-tertiary
            disabled:bg-bg-secondary disabled:text-text-disabled disabled:cursor-not-allowed
            min-h-[120px]
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

TextArea.displayName = 'TextArea';

export default TextArea;
