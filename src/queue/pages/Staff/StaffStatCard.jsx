// Shared stat card used by both Today's Queue and Queue History so the two
// pages render identical sizing/typography instead of drifting apart.
export default function StaffStatCard({ label, value, icon: Icon }) {
  return (
    <div className="flex h-24 items-center justify-between rounded-2xl border border-slate-200/90 bg-white px-5 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="mt-1.5 text-3xl font-extrabold text-slate-900">
          {value}
        </p>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#9D0A0E]/10 text-[#9D0A0E]">
        <Icon size={18} />
      </span>
    </div>
  )
}
