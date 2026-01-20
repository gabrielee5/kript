interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-[1.875rem] h-[1.875rem]',
    lg: 'w-12 h-12',
  };

  return (
    <div
      className={`
        ${sizes[size]}
        border border-border border-t-black
        rounded-full
        animate-spin
        ${className}
      `}
      role="status"
      aria-label="Loading"
    />
  );
}
