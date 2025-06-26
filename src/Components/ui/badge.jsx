import React from "react";

export const Badge = ({ variant = "default", className = "", children, ...props }) => {
  const baseStyles = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
  const variantStyles = variant === "outline" ? "border border-gray-700" : "bg-gray-700 text-white";

  return (
    <span className={`${baseStyles} ${variantStyles} ${className}`} {...props}>
      {children}
    </span>
  );
};