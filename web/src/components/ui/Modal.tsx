import { ReactNode, useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-md md:p-lg"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white border border-border max-w-[56rem] w-full max-h-[85vh] md:max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="px-md md:px-lg py-md border-b border-border flex justify-between items-center">
          <h2 className="text-base md:text-lg font-semibold">{title}</h2>
          {/* Close button - larger touch target on mobile */}
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:p-tiny flex items-center justify-center text-text-secondary hover:text-text-primary active:bg-bg-secondary transition-all duration-150"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-md md:p-lg">{children}</div>

        {/* Footer - stack buttons vertically on mobile */}
        {footer && (
          <div className="px-md md:px-lg py-md border-t border-border flex flex-col-reverse md:flex-row justify-end gap-md md:gap-sm">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
