import Image from 'next/image'

export function LandingBrand({ compact = false }: { compact?: boolean }) {
  return <div className={`flex items-center gap-2 font-bold tracking-[-.035em] text-lt-900 ${compact ? 'text-sm' : 'text-base'}`}>
    <Image className={`${compact ? 'size-7' : 'size-9'} rounded-[10px] object-cover`} src="/lead-trace-logo-padded.svg" alt="" width={42} height={42}/>
    <span>Lead Trace</span>
  </div>
}
