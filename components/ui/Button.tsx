import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent-primary text-white hover:bg-accent-primary/90 focus:ring-accent-primary shadow-md hover:shadow-lg',
        secondary: 'bg-accent-primary-soft text-accent-primary hover:bg-accent-primary-soft/80 focus:ring-accent-primary',
        success: 'bg-accent-success text-white hover:bg-accent-success/90 focus:ring-accent-success shadow-md hover:shadow-lg',
        warning: 'bg-accent-warning text-text-primary hover:bg-accent-warning/90 focus:ring-accent-warning shadow-md hover:shadow-lg',
        outline: 'border-2 border-accent-primary text-accent-primary hover:bg-accent-primary-soft focus:ring-accent-primary',
        ghost: 'text-accent-primary hover:bg-accent-primary-soft focus:ring-accent-primary',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }

