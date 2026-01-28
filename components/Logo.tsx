
import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'light' | 'dark'; // light text for dark background, dark text for light background
  customLogo?: string | null;
}

const Logo: React.FC<LogoProps> = ({ className = "", variant = 'light', customLogo }) => {
  const textColor = variant === 'light' ? 'text-white' : 'text-gray-900';
  const subTextColor = variant === 'light' ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Icon or Custom Logo */}
      {customLogo ? (
        <div className="h-10 w-10 flex items-center justify-center overflow-hidden rounded-lg">
          <img src={customLogo} alt="Empresa" className="max-h-full max-w-full object-contain" />
        </div>
      ) : (
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10 flex-shrink-0"
        >
          <defs>
            <linearGradient id="sunGradient" x1="32" y1="10" x2="32" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FDBA74" />
              <stop offset="1" stopColor="#FB923C" />
            </linearGradient>
            <linearGradient id="panelGradient" x1="32" y1="40" x2="32" y2="60" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366F1" />
              <stop offset="1" stopColor="#4338CA" />
            </linearGradient>
          </defs>
          
          {/* Sun Rays */}
          <path d="M32 6V10M32 38V42M50 24H46M18 24H14M44.7 11.3L41.9 14.1M22.1 33.9L19.3 36.7M44.7 36.7L41.9 33.9M22.1 14.1L19.3 11.3" stroke="#FDBA74" strokeWidth="2" strokeLinecap="round" />
          
          {/* Sun Body */}
          <circle cx="32" cy="24" r="10" fill="url(#sunGradient)" />

          {/* Solar Panel */}
          <path d="M12 44H52L48 58H16L12 44Z" fill="url(#panelGradient)" />
          <path d="M32 44V58M22 44L24 58M42 44L40 58" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
        </svg>
      )}

      {/* Text - Updated to Sentence Case */}
      <div className="flex flex-col justify-center">
        <span className={`text-xl font-extrabold tracking-tight leading-none ${textColor}`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          Orner
        </span>
        <span className={`text-[0.6rem] font-bold tracking-tight text-gray-400 mt-0.5`}>
          Energia solar
        </span>
      </div>
    </div>
  );
};

export default Logo;
