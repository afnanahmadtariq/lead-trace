import { Bone, Loading, PageHeaderSkeleton } from '../../../components/crm/skeleton'

export default function ContactsLoading() {
  return <Loading label="Loading contacts">
    <PageHeaderSkeleton/>
    <div className="flex flex-wrap items-center gap-3"><Bone className="h-10 min-w-0 flex-1 basis-72 rounded-control"/><Bone className="h-10 w-28 rounded-control"/><Bone className="h-10 w-28 rounded-control"/><Bone className="h-10 w-36 rounded-control"/></div>
    <div className="overflow-hidden rounded-2xl border border-lt-200 bg-white"><Bone className="h-11 rounded-none"/>{Array.from({ length: 6 }, (_, index) => <div key={index} className="flex items-center gap-4 border-t border-lt-100 px-5 py-4"><Bone className="size-8 shrink-0"/><div className="grid flex-1 gap-2"><Bone className="h-3.5 w-40 max-w-full"/><Bone className="h-3 w-56 max-w-full"/></div><Bone className="hidden h-3.5 w-28 sm:block"/><Bone className="hidden h-5 w-16 md:block"/></div>)}</div>
  </Loading>
}
