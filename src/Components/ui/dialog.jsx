import React from "react";

export const Dialog = ({ open, onOpenChange, children, ...props }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" {...props}>
      <div
        className="relative bg-gray-900 rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {React.Children.map(children, (child) =>
          React.cloneElement(child, { onClose: () => onOpenChange(false) })
        )}
      </div>
    </div>
  );
};

export const DialogContent = ({ className = "", children, onClose, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const DialogHeader = ({ className = "", children, ...props }) => (
  <div className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
);

export const DialogTitle = ({ className = "", children, ...props }) => (
  <h2 className={`text-lg font-semibold text-white ${className}`} {...props}>
    {children}
  </h2>
);

export const DialogDescription = ({ className = "", children, ...props }) => (
  <p className={`text-sm text-gray-400 ${className}`} {...props}>
    {children}
  </p>
);

export const DialogFooter = ({ className = "", children, ...props }) => (
  <div className={`flex justify-end space-x-2 mt-4 ${className}`} {...props}>
    {children}
  </div>
);