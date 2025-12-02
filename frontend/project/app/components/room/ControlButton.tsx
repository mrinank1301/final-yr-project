import React from "react";

interface ControlButtonProps {
  onClick: () => void;
  isActive: boolean;
  activeClass: string;
  inactiveClass: string;
  className?: string;
  children: React.ReactNode;
}

export function ControlButton({
  onClick,
  isActive,
  activeClass,
  inactiveClass,
  className = "",
  children,
}: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-xl transition-colors ${
        isActive ? activeClass : inactiveClass
      } ${className}`}
    >
      {children}
    </button>
  );
}
