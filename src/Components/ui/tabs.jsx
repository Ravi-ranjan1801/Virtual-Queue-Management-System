import React, { useState } from "react";

export const Tabs = ({ defaultValue, onValueChange, className = "", children, ...props }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleChange = (value) => {
    setActiveTab(value);
    if (onValueChange) onValueChange(value);
  };

  return (
    <div className={className} {...props}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { activeTab, onChange: handleChange })
      )}
    </div>
  );
};

export const TabsList = ({ className = "", children, activeTab, onChange, ...props }) => (
  <div className={`flex space-x-1 ${className}`} {...props}>
    {React.Children.map(children, (child) =>
      React.cloneElement(child, { activeTab, onChange })
    )}
  </div>
);

export const TabsTrigger = ({ value, activeTab, onChange, className = "", children, ...props }) => {
  const isActive = activeTab === value;
  const baseStyles = "px-3 py-2 rounded-md text-sm font-medium";
  const activeStyles = isActive ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800";

  return (
    <button
      className={`${baseStyles} ${activeStyles} ${className}`}
      onClick={() => onChange(value)}
      {...props}
    >
      {children}
    </button>
  );
};