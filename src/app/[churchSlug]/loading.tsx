import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6 pt-2"
    >
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-8 w-56 rounded-xl" />
      <Skeleton className="h-28 w-full rounded-3xl" />
      <Skeleton className="h-40 w-full rounded-3xl" />
      <Skeleton className="h-24 w-full rounded-3xl" />
    </div>
  );
}
