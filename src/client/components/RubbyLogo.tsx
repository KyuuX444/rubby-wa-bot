import React from 'react';

export const RubbyLogo: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg
    viewBox="0 0 128 128"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Rubby WA Bot Logo"
  >
    <rect width="128" height="128" rx="28" fill="#171717" />
    <path
      d="M64 22L100 43V85L64 106L28 85V43L64 22Z"
      stroke="#FFFFFF"
      strokeWidth="6"
      strokeLinejoin="round"
    />
    <path d="M64 22L82 54H46L64 22Z" fill="#FFFFFF" fillOpacity="0.18" />
    <path
      d="M28 43L64 64L100 43"
      stroke="#FFFFFF"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M64 64V106" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
    <circle cx="64" cy="64" r="7" fill="#FFFFFF" />
  </svg>
);
