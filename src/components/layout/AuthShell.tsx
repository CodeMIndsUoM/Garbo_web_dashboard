'use client';

import React from 'react';
import { GarboBrand } from '@/components/brand/GarboIcon';
import { AuthHeroRotator } from '@/components/layout/AuthHeroRotator';
import { typography } from '@/theme';
import { cn } from '@/components/ui/utils';

interface AuthShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <div className="garbo-auth-shell">
      {/* Left — brand + sign-in */}
      <div className="garbo-auth-form-column">
        <div className="garbo-auth-form-stack">
          <div className="garbo-auth-brand-header">
            <GarboBrand size="lg" />
            <p className={`${typography.caption} mt-5 max-w-sm leading-relaxed text-muted-foreground`}>
              Council operations dashboard for bins, routes, and field teams.
            </p>
          </div>

          <div className="garbo-auth-form-card">
            <div className="mb-6 border-b border-[var(--surface-border)] pb-6">
              <h1 className={typography.pageTitle}>{title}</h1>
              {subtitle ? <p className={`${typography.pageSubtitle} mt-2`}>{subtitle}</p> : null}
            </div>
            {children}
          </div>

          <p className={`${typography.micro} text-center text-muted-foreground`}>
            Secure access for authorized council staff only.
          </p>
        </div>
      </div>

      {/* Right — hero image + rotating copy */}
      <div className="garbo-auth-hero-column" role="img" aria-label="Community waste cleanup">
        <img
          src="/images/login-hero-community.png"
          alt=""
          className="garbo-auth-hero-photo"
          aria-hidden
        />
        <div className="garbo-auth-hero-overlay" aria-hidden />

        <div className="garbo-auth-hero-inner">
          <header className="garbo-auth-hero-header">
            <p className={cn(typography.caption, 'font-medium text-white/90')}>
              Waste Management System
            </p>
          </header>

          <div className="garbo-auth-hero-main">
            <AuthHeroRotator />
          </div>

          <footer className="garbo-auth-hero-footer">
            <p>© Waste Management System</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
