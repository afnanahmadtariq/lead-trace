import type { InputHTMLAttributes, ReactNode } from 'react'

export function Field({ label, labelAction, icon, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; labelAction?: ReactNode; icon?: ReactNode }) {
  return <label className="grid gap-[7px]" htmlFor={id}>
    <span className="flex items-baseline justify-between gap-3 text-sm font-semibold text-lt-700"><span>{label}</span>{labelAction && <span className="text-brand">{labelAction}</span>}</span>
    <span className="relative">{icon && <span className="pointer-events-none absolute top-1/2 left-[13px] -translate-y-1/2 text-lt-500">{icon}</span>}<input id={id} className={`min-h-[47px] w-full rounded-control border border-lt-300 bg-white px-3.5 text-[.95rem] text-lt-950 transition-[border-color,box-shadow] duration-300 ease-fluid placeholder:text-[#97aac3] focus:border-brand-bright focus:outline-0 focus:ring-3 focus:ring-brand-bright/10 motion-reduce:transition-none ${icon ? 'pl-[41px]' : ''}`} {...props}/></span>
  </label>
}
