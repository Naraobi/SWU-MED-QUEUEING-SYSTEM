// Shared stat card used by both Today's Queue and Queue History so the two
// pages render identical sizing/typography instead of drifting apart.
export default function StaffStatCard({ label, value, icon: Icon }) {
  return (
    <div className="flex h-28 items-center justify-between rounded-2xl border border-slate-200/90 bg-white px-6 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="mt-2 text-4xl font-extrabold text-slate-900">
          {value}
        </p>
      </div>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#9D0A0E]/10 text-[#9D0A0E]">
        <Icon size={20} />
      </span>
    </div>
  )
}
