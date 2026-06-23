import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '../lib/cn'

/** Card — depth via a warm hairline border, not shadow (per design-direction.md). */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-[var(--radius)] border border-border bg-surface p-4', className)}
      {...props}
    />
  ),
)
Card.displayName = 'Card'
