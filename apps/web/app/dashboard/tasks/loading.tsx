import { Bone, Loading, PageHeaderSkeleton } from '../../../components/crm/skeleton'

export default function TasksLoading() {
  return <Loading label="Loading follow-ups">
    <PageHeaderSkeleton action/>
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-lt-200 bg-lt-200 max-[620px]:grid-cols-1">{Array.from({ length: 3 }, (_, index) => <div key={index} className="grid gap-2 bg-white p-5"><Bone className="h-7 w-12"/><Bone className="h-3.5 w-24"/></div>)}</div>
    <div className="flex flex-wrap gap-2">{Array.from({ length: 4 }, (_, index) => <Bone key={index} className="h-10 w-28"/>)}</div>
    <div className="grid gap-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="flex items-start gap-3 rounded-xl border border-lt-200 bg-white px-4 py-3.5"><Bone className="size-5 shrink-0"/><div className="grid flex-1 gap-2"><Bone className="h-4 w-64 max-w-full"/><Bone className="h-3 w-44 max-w-full"/></div></div>)}</div>
  </Loading>
}
