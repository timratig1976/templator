"use client";

import React from "react";
import { Zap } from "lucide-react";

export interface GenerateButtonProps {
  onClick?: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  ariaLabel?: string;
}

/**
 * A reusable Generate button used across AI-related actions.
 * Defaults to a primary rounded style with a Zap icon and text.
 */
export const GenerateButton: React.FC<GenerateButtonProps> = ({
  onClick,
  loading = false,
  disabled = false,
  className = "",
  title,
  ariaLabel,
}) => {
  const isDisabled = disabled || loading;
  const label = loading ? "Generating…" : "Generate";

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={[
        "h-9 px-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70 flex items-center gap-2",
        className,
      ].join(" ")}
      title={title || label}
      aria-label={ariaLabel || label}
      type="button"
    >
      <span className="text-sm font-medium">{label}</span>
      <Zap className="w-4 h-4" />
    </button>
  );
};

export default GenerateButton;
