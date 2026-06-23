import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

/** Loading placeholder. Decorative → aria-hidden; pulse stops under reduced motion. */
export const Skeleton = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    aria-hidden="true"
    className={cn(
      'animate-pulse rounded-[var(--radius)] bg-surface-2 motion-reduce:animate-none',
      className,
    )}
    {...props}
  />
)
