'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/components/ui/utils';

export interface AuthHeroMessage {
  title: string;
  body: string;
}

const HERO_MESSAGES: AuthHeroMessage[] = [
  {
    title: 'Smarter waste operations for councils',
    body: 'Monitor bins, routes, vehicles, and field teams from one professional dashboard.',
  },
  {
    title: 'Real-time bin status updates',
    body: 'See field staff reports and collection progress live — no manual refresh needed.',
  },
  {
    title: 'Plan routes with confidence',
    body: 'Manual and auto route tools help you assign vehicles, drivers, and collection stops.',
  },
  {
    title: 'One hub for council staff',
    body: 'Manage internal teams, external users, analytics, and gamification in one place.',
  },
];

const INTERVAL_MS = 5500;

interface AuthHeroRotatorProps {
  className?: string;
}

export function AuthHeroRotator({ className }: AuthHeroRotatorProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % HERO_MESSAGES.length);
        setVisible(true);
      }, 320);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const message = HERO_MESSAGES[index];

  return (
    <div className={cn('garbo-auth-hero-rotator', className)}>
      <div
        className={cn(
          'transition-all duration-500 ease-out',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        )}
      >
        <p className="garbo-auth-hero-title">{message.title}</p>
        <p className="garbo-auth-hero-body">{message.body}</p>
      </div>

      <div className="garbo-auth-hero-dots" role="tablist" aria-label="Hero message slides">
        {HERO_MESSAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Message ${i + 1} of ${HERO_MESSAGES.length}`}
            className={cn('garbo-auth-hero-dot', i === index && 'garbo-auth-hero-dot--active')}
            onClick={() => {
              setVisible(false);
              window.setTimeout(() => {
                setIndex(i);
                setVisible(true);
              }, 200);
            }}
          />
        ))}
      </div>
    </div>
  );
}
