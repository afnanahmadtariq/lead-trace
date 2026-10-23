import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'xs' | 'sm' | 'md' | 'icon-sm' | 'icon'

const variants: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-[linear-gradient(135deg,#1c9eec,#16429b)] text-white! hover:brightness-95',
  secondary: 'border-lt-200 bg-white text-lt-900! hover:border-lt-300 hover:bg-lt-50',
  ghost: 'border-transparent bg-transparent text-lt-700 hover:bg-lt-100 hover:text-lt-900',
  danger: 'border-transparent bg-transparent text-danger hover:bg-[#fff0f2] hover:text-danger',
}

const sizes: Record<ButtonSize, string> = {
  xs: 'min-h-9 px-[15px] text-[.82rem]',
  sm: 'min-h-[45px] px-4 text-[.84rem]',
  md: 'min-h-12 px-[19px] text-[.95rem]',
  'icon-sm': 'size-9 p-0',
  icon: 'size-10 p-0',
}

function buttonClassName(variant: ButtonVariant, size: ButtonSize, className: string) {
  return `inline-flex shrink-0 items-center justify-center gap-2 rounded-control border font-[650] transition-[color,background-color,border-color,filter,box-shadow] duration-300 ease-fluid focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand/20 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${sizes[size]} ${className}`
}

type CommonButtonProps = {
  children: ReactNode
  className?: string
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & CommonButtonProps) {
  return <button className={buttonClassName(variant, size, className)} {...props}/>
}

export function ButtonLink({ href, variant = 'primary', size = 'sm', className = '', children }: CommonButtonProps & { href: string }) {
  return <Link href={href} className={buttonClassName(variant, size, className)}>{children}</Link>
}
