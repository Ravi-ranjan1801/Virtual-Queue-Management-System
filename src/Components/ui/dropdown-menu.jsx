import React, { useState } from "react";

export const DropdownMenu = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { isOpen, setIsOpen })
      )}
    </div>
  );
};

export const DropdownMenuTrigger = ({ asChild, children, isOpen, setIsOpen, ...props }) => {
  const handleClick = () => setIsOpen(!isOpen);
  return asChild ? (
    React.cloneElement(children, { onClick: handleClick, ...props })
  ) : (
    <button onClick={handleClick} {...props}>
      {children}
    </button>
  );
};

export const DropdownMenuContent = ({ align = "start", className = "", children, isOpen, setIsOpen, ...props }) => {
  if (!isOpen) return null;
  const alignStyles = align === "end" ? "right-0" : "left-0";

  return (
    <div
      className={`absolute mt-2 w-56 rounded-md shadow-lg bg-zinc-900 border border-zinc-800 ${alignStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const DropdownMenuLabel = ({ className = "", children, ...props }) => (
  <div className={`px-2 py-1.5 text-sm font-semibold text-white ${className}`} {...props}>
    {children}
  </div>
);

export const DropdownMenuItem = ({ className = "", children, ...props }) => (
  <div
    className={`px-2 py-1.5 text-sm text-white hover:bg-zinc-800 cursor-pointer ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const DropdownMenuSeparator = ({ className = "", ...props }) => (
  <hr className={`border-t border-zinc-800 ${className}`} {...props} />
);