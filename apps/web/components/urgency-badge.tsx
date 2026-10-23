export function UrgencyBadge({ label }: { label?: 'High urgency' | 'Moderate' | 'Low' | string | null }) {
  if (!label) return null
  const tone = label === 'High urgency' ? 'high' : label === 'Moderate' ? 'moderate' : 'low'
  return <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-[9px] py-1.5 text-[.68rem] font-[650] capitalize data-[tone=high]:bg-[#fff0f2] data-[tone=high]:text-danger data-[tone=moderate]:bg-[#fff7e7] data-[tone=moderate]:text-[#a4640b] data-[tone=low]:bg-lt-100 data-[tone=low]:text-lt-600" data-tone={tone}><i className="size-1.5 rounded-full bg-current"/>{label}</span>
}
