import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type LandingFeature = {
  icon: LucideIcon
  title: string
  body: string
}

export function FeatureCard({ feature, className = '', featured = false, delay = '', children }: { feature: LandingFeature; className?: string; featured?: boolean; delay?: string; children?: ReactNode }) {
  const Icon = feature.icon
  return <article className={`flex flex-col rounded-xl border border-lt-200 bg-white transition-colors duration-200 hover:border-lt-300 motion-reduce:transition-none ${featured ? 'p-7 lg:p-9' : 'p-6'} ${className} ${delay}`} data-reveal>
    <Icon size={featured ? 24 : 20} className="text-brand" aria-hidden="true"/>
    <h3 className={`mb-2 font-medium tracking-[-.02em] text-lt-900 ${featured ? 'mt-6 text-2xl' : 'mt-5 text-lg'}`}>{feature.title}</h3>
    <p className={`m-0 leading-relaxed text-lt-600 ${featured ? 'max-w-[460px] text-base' : 'text-[.94rem]'}`}>{feature.body}</p>
    {children}
  </article>
}
