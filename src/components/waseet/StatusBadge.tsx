'use client';

import type { WaseetSyncState } from '@/modules/waseet/types';

const syncLabels: Record<WaseetSyncState, { label: string; className: string }> = {
  not_ready: { label: 'غير جاهز', className: 'bg-zinc-800 text-zinc-300 border-zinc-700' },
  pending: { label: 'جاهز للإرسال', className: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  syncing: { label: 'جاري الإرسال', className: 'bg-blue-500/10 text-blue-300 border-blue-500/30' },
  synced: { label: 'متزامن', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  failed: { label: 'فشل', className: 'bg-red-500/10 text-red-300 border-red-500/30' },
  needs_verification: { label: 'يحتاج تحقق', className: 'bg-orange-500/10 text-orange-300 border-orange-500/30' },
  manual_review: { label: 'مراجعة بيانات', className: 'bg-purple-500/10 text-purple-300 border-purple-500/30' },
};

export function SyncStateBadge({ state }: { state: WaseetSyncState }) {
  const config = syncLabels[state] || syncLabels.not_ready;
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${config.className}`}>{config.label}</span>;
}

export function WaseetStatusBadge({ status }: { status?: string | null }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${
      status ? 'bg-swiss-lavender/10 text-swiss-lavender border-swiss-lavender/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
    }`}>
      {status || 'غير مرسل'}
    </span>
  );
}
