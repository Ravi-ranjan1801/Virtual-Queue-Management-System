import React from "react";

export const Input = ({ className = "", ...props }) => {
  const baseStyles = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return <input className={`${baseStyles} ${className}`} {...props} />;
};