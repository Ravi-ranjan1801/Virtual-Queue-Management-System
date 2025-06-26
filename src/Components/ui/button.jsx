

const variantStyles = {
  default: "bg-zinc-900 text-white hover:bg-zinc-700",
  outline: "border border-gray-700 text-white hover:bg-zinc-800",
  ghost: "text-white hover:bg-zinc-800",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  normal: "bg-blue-600 text-white hover:bg-blue-700",
};

const sizeStyles = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3",
  icon: "h-10 w-10",
};

export const Button = ({ variant = "default", size = "default", className = "", children, ...props }) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors";
  const variantClass = variantStyles[variant] || variantStyles.default;
  const sizeClass = sizeStyles[size] || sizeStyles.default;

  return (
    <button className={`${baseStyles} ${variantClass} ${sizeClass} ${className}`} {...props}>
      {children}
    </button>
  );
};