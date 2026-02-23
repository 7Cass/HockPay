'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { getRemainingSeconds, formatTimeRemaining } from '@/lib/formatters';

interface TimerProps {
  expiresAt: string;
  onExpire?: () => void;
}

export function Timer({ expiresAt, onExpire }: TimerProps) {
  const [mounted, setMounted] = useState(false);
  const [remaining, setRemaining] = useState(() => getRemainingSeconds(expiresAt));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = getRemainingSeconds(expiresAt);
      setRemaining(seconds);

      if (seconds === 0 && onExpire) {
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2 text-gray-700 h-[28px]">
        {/* Placeholder para evitar layout shift */}
      </div>
    );
  }

  if (remaining === 0) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <Clock className="w-5 h-5" />
        <span className="font-medium">Expirado</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-gray-700">
      <Clock className="w-5 h-5" />
      <span className="font-mono text-xl font-bold">{formatTimeRemaining(remaining)}</span>
    </div>
  );
}
