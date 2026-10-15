import { PageHeader } from "./kit";
import type { IconName } from "./icons";
import { Skeleton, ToolbarSkeleton, type SkeletonVariant } from "./Skeletons";

/**
 * What a page shows while its first data (classes, sessions…) is loading: the real title, a toolbar placeholder and
 * the body skeleton — the same layout the page has a moment later, so nothing jumps or swaps for a different skeleton.
 */
export function PageLoading({ icon, title, sub, toolbar = true, variant = "list", rows = 4 }: { icon: IconName; title: string; sub?: string; toolbar?: boolean; variant?: SkeletonVariant; rows?: number }) {
  return (
    <>
      <PageHeader icon={icon} title={title} sub={sub} />
      {toolbar && <ToolbarSkeleton />}
      <Skeleton variant={variant} rows={rows} />
    </>
  );
}
