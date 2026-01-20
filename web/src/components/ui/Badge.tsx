import { HTMLAttributes, forwardRef } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'danger' | 'warning';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'neutral', children, ...props }, ref) => {
    const variants = {
      neutral: 'bg-bg-secondary text-text-secondary border-border',
      success: 'bg-success-bg text-success-text border-success-border',
      danger: 'bg-danger-bg text-danger-text border-danger-border',
      warning: 'bg-warning-bg text-warning-text border-warning-border',
    };

    return (
      <span
        ref={ref}
        className={`
          inline-block px-sm py-tiny
          text-xs font-medium
          border
          ${variants[variant]}
          ${className}
        `}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
