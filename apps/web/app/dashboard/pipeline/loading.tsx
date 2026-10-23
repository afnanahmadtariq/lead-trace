import { Bone, Loading, PageHeaderSkeleton } from '../../../components/crm/skeleton'

export default function PipelineLoading() {
  return <Loading label="Loading pipeline">
    <PageHeaderSkeleton action/>
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-lt-200 bg-lt-200 max-[620px]:grid-cols-1">{Array.from({ length: 3 }, (_, index) => <div key={index} className="grid gap-2 bg-white p-5"><Bone className="h-7 w-20"/><Bone className="h-3.5 w-24"/></div>)}</div>
    <div className="flex items-center justify-between"><Bone className="h-10 w-52 rounded-control"/><Bone className="h-12 w-44 rounded-xl"/></div>
    <div className="flex items-start gap-3 overflow-hidden max-[640px]:grid">{Array.from({ length: 4 }, (_, column) => <div key={column} className="grid w-64 shrink-0 gap-2 rounded-2xl border border-lt-100 bg-lt-100/50 p-2.5 max-[640px]:w-full"><Bone className="mx-1.5 my-2 h-4 w-28 bg-white!"/>{Array.from({ length: column % 2 ? 1 : 2 }, (_, card) => <Bone key={card} className="h-28 rounded-xl bg-white!"/>)}</div>)}</div>
  </Loading>
}
