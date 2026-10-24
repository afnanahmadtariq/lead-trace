export function StepCard({ title, body, delay = '' }: { title: string; body: string; delay?: string }) {
  return <li className={`relative m-0 border-l border-lt-300 pb-10 pl-6 last:pb-0 lg:border-t lg:border-l-0 lg:pb-0 lg:pl-0 lg:pt-8 lg:pr-10 lg:last:pr-0 ${delay}`} data-reveal>
    <span className="absolute top-2 -left-[5px] size-2.5 rounded-full bg-brand ring-4 ring-lt-50 lg:top-[-5.5px] lg:left-0" aria-hidden="true"/>
    <h3 className="mt-0 mb-2 text-xl font-medium tracking-[-.02em] text-lt-900">{title}</h3>
    <p className="m-0 max-w-[340px] text-[.94rem] leading-relaxed text-lt-600">{body}</p>
  </li>
}
