import { Bone, Loading, PageHeaderSkeleton } from '../../../../components/crm/skeleton'

export default function ContactLoading() {
  return <Loading label="Loading contact">
    <Bone className="h-4 w-24"/>
    <PageHeaderSkeleton action/>
    <div className="grid gap-5 rounded-2xl border border-lt-200 bg-white p-5"><div className="grid grid-cols-4 gap-6 max-[900px]:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="grid gap-2"><Bone className="h-3 w-12"/><Bone className="h-4 w-28 max-w-full"/></div>)}</div><div className="flex gap-2 border-t border-lt-100 pt-4"><Bone className="h-9 w-32"/><Bone className="h-9 w-24"/><Bone className="h-9 w-24"/></div></div>
    <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,.8fr)] items-start gap-6 max-[900px]:grid-cols-1"><div className="grid gap-6"><Bone className="h-36 rounded-2xl"/><Bone className="h-40 rounded-2xl"/><Bone className="h-32 rounded-2xl"/></div><div className="grid gap-6"><Bone className="h-48 rounded-2xl"/><Bone className="h-32 rounded-2xl"/></div></div>
  </Loading>
}
