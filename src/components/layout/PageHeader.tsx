'use client';

import React from 'react';
import { typography } from '@/theme';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  extra?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, extra, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between md:mb-8">
      <div className="min-w-0">
        <h1 className={typography.pageTitle}>{title}</h1>
        {subtitle ? <p className={`${typography.pageSubtitle} mt-1`}>{subtitle}</p> : null}
        {extra ? <p className={`${typography.pageSubtitle} mt-1 text-muted-foreground`}>{extra}</p> : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto [&_button]:flex-1 sm:[&_button]:flex-none">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
