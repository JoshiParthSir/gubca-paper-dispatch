import { Badge } from '@/components/ui/badge';
import type { PoolTier } from '@/lib/duty/pools';

export function RankBadge({ senior }: { senior: boolean }) {
  return senior
    ? <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent hover:bg-amber-500/15">Senior</Badge>
    : <Badge variant="secondary">Junior</Badge>;
}

const TIER_TEXT: Record<PoolTier, string> = { subject: 'Teaches it', practical: 'Other practical', backup: 'Backup' };

export function TierBadge({ tier }: { tier: PoolTier }) {
  return (
    <Badge variant="outline" className={tier === 'backup' ? 'border-amber-500/60 text-amber-700 dark:text-amber-300' : ''}>
      {TIER_TEXT[tier]}
    </Badge>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'warn' | 'ok' }) {
  return (
    <div className="rounded-lg border p-3">
      <div className={`text-2xl font-semibold ${tone === 'warn' ? 'text-destructive' : tone === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
