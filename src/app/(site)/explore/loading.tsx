import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-page grid gap-6 py-8" aria-busy="true" aria-label="Loading cars">
      <Skeleton className="h-10 w-72 rounded-xl" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-80 rounded-3xl" />)}</div>
    </div>
  );
}
