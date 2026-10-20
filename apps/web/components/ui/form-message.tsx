import type { HTMLAttributes } from 'react'

export function FormMessage({ tone = 'notice', className = '', ...props }: HTMLAttributes<HTMLParagraphElement> & { tone?: 'notice' | 'error' | 'success' }) {
  const toneClass = tone === 'error'
    ? 'border border-danger/20 bg-[#fff0f2] text-danger'
    : tone === 'success'
      ? 'bg-[#eef9f3] text-success'
      : 'bg-lt-100 text-lt-700'
  return <p className={`m-0 rounded-[10px] px-[13px] py-[11px] text-[.87rem] leading-normal ${toneClass} ${className}`} {...props}/>
}
