import { ReactNode } from 'react';

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: ReactNode;
  className?: string;
}

export default function Alert({ variant = 'info', title, children, className = '' }: AlertProps) {
  const variants = {
    info: 'bg-bg-secondary border-border text-text-primary',
    success: 'bg-success-bg border-success-border text-success-text',
    warning: 'bg-warning-bg border-warning-border text-warning-text',
    danger: 'bg-danger-bg border-danger-border text-danger-text',
  };

  const icons = {
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="square" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="square" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="square" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    danger: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="square" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  };

  return (
    <div className={`border p-lg ${variants[variant]} ${className}`}>
      <div className="flex gap-sm">
        <div className="flex-shrink-0">{icons[variant]}</div>
        <div className="flex-1">
          {title && <div className="font-semibold mb-tiny">{title}</div>}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
