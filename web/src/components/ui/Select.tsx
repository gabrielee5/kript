import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, options, id, ...props }, ref) => {
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
        <select
          ref={ref}
          id={inputId}
          className={`
            bg-white border border-border px-lg py-sm
            font-mono text-base md:text-sm text-text-primary
            min-h-[44px] md:min-h-0
            transition-all duration-150
            hover:border-border-hover
            focus:border-black focus:outline-none
            disabled:bg-bg-secondary disabled:text-text-disabled disabled:cursor-not-allowed
            appearance-none
            bg-no-repeat bg-right
            pr-10
            ${error ? 'border-danger-solid' : ''}
            ${className}
          `}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='square' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
            backgroundSize: '1.25rem',
            backgroundPosition: 'right 0.5rem center',
          }}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="text-xs text-danger-text">{error}</span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
