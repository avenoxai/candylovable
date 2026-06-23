import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../lib/cn'

/**
 * Button — UI motion vocabulary: snappy press (active:scale 0.97), 150ms standard
 * ease, full-pill radius (a "physical" control). Honors prefers-reduced-motion.
 */
export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[transform,background-color,border-color,opacity] duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-ink hover:opacity-90',
        secondary: 'border border-border bg-surface-2 text-ink hover:bg-surface',
        ghost: 'bg-transparent text-ink hover:bg-surface-2',
        gradient: 'text-accent-ink [background-image:var(--accent-gradient)] hover:opacity-90',
      },
      size: {
        sm: 'h-8 rounded-full px-3 text-sm',
        md: 'h-10 rounded-full px-5 text-sm',
        lg: 'h-12 rounded-full px-6 text-base',
        icon: 'h-10 w-10 rounded-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the single child element (Radix Slot) instead of a <button>. */
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        type={asChild ? undefined : (type ?? 'button')}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
