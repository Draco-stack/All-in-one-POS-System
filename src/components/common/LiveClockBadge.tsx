import React, { useState, useEffect } from 'react';

interface LiveClockBadgeProps {
  showDate?: boolean;
  className?: string;
}

export const LiveClockBadge: React.FC<LiveClockBadgeProps> = React.memo(({ showDate = true, className = '' }) => {
  const [time, setTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = time.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <span className={`font-mono text-slate-500 dark:text-stone-400 ${className}`}>
      {showDate ? `${formattedDate} • ${formattedTime}` : formattedTime}
    </span>
  );
});
