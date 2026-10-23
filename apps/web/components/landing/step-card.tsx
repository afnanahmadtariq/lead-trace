import type { ReactNode } from 'react'

export function StepCard({ number, icon, title, body, delay = '' }: { number: string; icon: ReactNode; title: string; body: string; delay?: string }) {
  return <article className={`relative min-h-0 rounded-panel border border-lt-200 bg-white p-7 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-lt-300 hover:shadow-card-hover motion-reduce:transition-none lg:min-h-[220px] ${delay}`} data-reveal>
    <span className="absolute top-6 right-6 text-xs font-semibold text-lt-500">{number}</span>
    <div className="mb-9 grid size-11 place-items-center rounded-xl bg-lt-100 text-brand">{icon}</div>
    <h3 className="mt-0 mb-2 text-lg text-lt-900">{title}</h3>
    <p className="m-0 text-[.94rem] leading-relaxed text-lt-600">{body}</p>
  </article>
}
