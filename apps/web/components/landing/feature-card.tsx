import type { LucideIcon } from 'lucide-react'

export type LandingFeature = {
  number: string
  icon: LucideIcon
  title: string
  body: string
}

export function FeatureCard({ feature, delay = '' }: { feature: LandingFeature; delay?: string }) {
  const Icon = feature.icon
  return <article className={`relative rounded-panel border border-lt-200 bg-white p-7 transition duration-200 hover:-translate-y-0.5 hover:border-lt-300 hover:shadow-card-hover motion-reduce:transition-none ${delay}`} data-reveal>
    <span className="absolute top-6 right-6 text-xs font-semibold text-lt-500">{feature.number}</span>
    <div className="grid size-11 place-items-center rounded-xl bg-lt-100 text-brand"><Icon size={20}/></div>
    <h3 className="mt-6 mb-2 text-lg text-lt-900">{feature.title}</h3>
    <p className="m-0 max-w-[470px] text-[.94rem] leading-relaxed text-lt-600">{feature.body}</p>
  </article>
}
