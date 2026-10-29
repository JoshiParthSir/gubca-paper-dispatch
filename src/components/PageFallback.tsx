import { Loader2 } from 'lucide-react';

/** Shown while a page's code or first data is loading. */
export function PageFallback({ fullScreen = false }: { fullScreen?: boolean }) {
  if (fullScreen) {
    return (
      <div className="surface-navy flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-gold-500" />
      </div>
    );
  }
  return <PageSkeleton />;
}

/** Page-shaped placeholder: title, toolbar and a grid of cards. */
export function PageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="h-10 w-full max-w-sm animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="card-elevated space-y-3 p-5" style={{ opacity: 1 - i * 0.1 }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
