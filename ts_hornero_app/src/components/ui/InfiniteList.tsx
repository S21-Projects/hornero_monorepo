'use client';
import { useEffect, useRef } from 'react';

interface InfiniteListProps {
  children: React.ReactNode;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function InfiniteList({
  children,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: InfiniteListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div>
      {children}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {isFetchingNextPage && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px',
            color: 'var(--ink-3)',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Cargando más...
        </div>
      )}
    </div>
  );
}
