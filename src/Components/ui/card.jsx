import React from "react";

export const Card = ({ className = "", children, ...props }) => (
  <div className={`rounded-lg border border-gray-800 bg-gray-900 ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ className = "", children, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className = "", children, ...props }) => (
  <h3 className={`text-lg font-semibold text-white ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ className = "", children, ...props }) => (
  <p className={`text-sm text-gray-400 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ className = "", children, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ className = "", children, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);