'use client';

import React from 'react';

/**
 * GarboLoader — A branded loading animation for the Garbo Management System.
 *
 * Usage:
 *   <GarboLoader />                           — fullscreen overlay (default)
 *   <GarboLoader variant="inline" />           — inline spinner for cards/sections
 *   <GarboLoader variant="overlay" />          — absolute overlay for map/panels
 *   <GarboLoader message="Loading bins..." />  — custom message
 *   <GarboLoader size="sm" />                  — small size
 */

type LoaderVariant = 'fullscreen' | 'inline' | 'overlay';
type LoaderSize = 'sm' | 'md' | 'lg';

interface GarboLoaderProps {
  variant?: LoaderVariant;
  message?: string;
  size?: LoaderSize;
  className?: string;
}

const sizeConfig = {
  sm: { icon: 32, ring: 48, text: 'text-[11px]' },
  md: { icon: 44, ring: 64, text: 'text-xs' },
  lg: { icon: 56, ring: 80, text: 'text-sm' },
};

export function GarboLoader({
  variant = 'fullscreen',
  message = 'Loading...',
  size = 'md',
  className = '',
}: GarboLoaderProps) {
  const { icon: iconSize, ring: ringSize, text: textClass } = sizeConfig[size];

  const wrapperClass = {
    fullscreen: 'fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 backdrop-blur-sm',
    inline: 'flex flex-col items-center justify-center gap-3 py-8',
    overlay: 'absolute inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-[2px] rounded-2xl',
  }[variant];

  return (
    <div className={`${wrapperClass} ${className}`}>
      {/* CSS Animations — scoped via unique class prefix */}
      <style>{`
        @keyframes garbo-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes garbo-pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.15); opacity: 0.15; }
        }
        @keyframes garbo-pulse-ring-2 {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.25); opacity: 0.05; }
        }
        @keyframes garbo-bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes garbo-fade-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        .garbo-loader-enter {
          animation: garbo-fade-in 0.3s ease-out both;
        }
      `}</style>

      <div className="garbo-loader-enter flex flex-col items-center gap-3">
        {/* Animated rings + icon */}
        <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
          {/* Outer pulse ring */}
          <div
            className="absolute rounded-full border-2 border-green-400/30"
            style={{
              width: ringSize,
              height: ringSize,
              animation: 'garbo-pulse-ring-2 2.4s ease-in-out infinite',
            }}
          />

          {/* Inner pulse ring */}
          <div
            className="absolute rounded-full border-2 border-green-500/40"
            style={{
              width: ringSize * 0.8,
              height: ringSize * 0.8,
              animation: 'garbo-pulse-ring 2s ease-in-out infinite 0.3s',
            }}
          />

          {/* Spinning arc */}
          <svg
            className="absolute"
            width={ringSize}
            height={ringSize}
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            style={{ animation: 'garbo-spin 1.8s linear infinite' }}
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringSize / 2 - 4}
              fill="none"
              stroke="url(#garbo-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(ringSize - 8) * Math.PI * 0.3} ${(ringSize - 8) * Math.PI * 0.7}`}
            />
            <defs>
              <linearGradient id="garbo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#16a34a" />
                <stop offset="50%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#16a34a" stopOpacity="0.2" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center — Garbo "G" bin icon */}
          <div
            className="relative z-10 flex items-center justify-center"
            style={{ animation: 'garbo-bounce-subtle 2.4s ease-in-out infinite' }}
          >
            <div
              className="bg-gradient-to-br from-green-600 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20"
              style={{ width: iconSize * 0.7, height: iconSize * 0.7 }}
            >
              {/* Bin SVG icon */}
              <svg
                width={iconSize * 0.38}
                height={iconSize * 0.38}
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <p className={`${textClass} font-semibold text-slate-500 tracking-wide animate-pulse`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default GarboLoader;
