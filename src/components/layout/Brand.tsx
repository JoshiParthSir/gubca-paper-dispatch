import { FileLock2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const markSizes = {
  sm: 'h-8 w-8 rounded-lg [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-10 w-10 rounded-xl [&_svg]:h-5 [&_svg]:w-5',
  lg: 'h-16 w-16 rounded-2xl [&_svg]:h-8 [&_svg]:w-8',
};

/** Gold tile with a locked-paper icon. */
export function BrandMark({ className, size = 'md' }: BrandMarkProps) {
  return (
    <div className={cn('gold-tile flex shrink-0 items-center justify-center', markSizes[size], className)} aria-hidden="true">
      <FileLock2 strokeWidth={2.25} />
    </div>
  );
}

interface WordmarkProps {
  className?: string;
  /** On navy backgrounds the first word is white; on light ones it is navy. */
  onDark?: boolean;
}

export function Wordmark({ className, onDark = false }: WordmarkProps) {
  return (
    <span className={cn('font-extrabold tracking-tight', className)}>
      <span className={onDark ? 'text-white' : 'text-primary'}>Paper</span>
      <span className={onDark ? 'text-gold-500' : 'text-gold-600'}>Dispatch</span>
    </span>
  );
}

interface BrandProps {
  subtitle?: string;
  onDark?: boolean;
}

export function Brand({ subtitle = 'Exam Paper Management', onDark = false }: BrandProps) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div className="leading-tight">
        <Wordmark onDark={onDark} className="text-lg" />
        <p className={cn('text-xs', onDark ? 'text-white/60' : 'text-muted-foreground')}>{subtitle}</p>
      </div>
    </div>
  );
}
