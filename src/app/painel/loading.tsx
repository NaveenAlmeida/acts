import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-8 w-40 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-3xl" />
      <Skeleton className="h-56 w-full rounded-3xl" />
    </div>
  );
}
