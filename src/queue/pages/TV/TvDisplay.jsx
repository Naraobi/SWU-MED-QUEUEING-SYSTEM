import { useEffect, useState } from 'react';
import { Bell, Clock, ListOrdered, Play, Info } from 'lucide-react';

// Mock "now serving" data for now — later this should read from the same
// queue table that the Doctor/Staff view writes to when they click "Call Next".
const NOW_SERVING = {
  department: 'LABORATORY',
  queueNumber: 'LB-021',
  terminal: 'TERMINAL 2',
  estMin: 25,
};

const NEXT_IN_LINE = ['LB-022', 'LB-023', 'LB-024', 'LB-025'];

function useClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(timer);
  }, []);

  return now;
}

export default function TvDisplay() {
  const now = useClock();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-10 py-6">
        <div>
          <span className="text-3xl font-bold text-red-600">SWU</span>
          <span className="text-3xl font-bold text-slate-400">Med</span>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-slate-900">{time}</p>
          <p className="text-base text-slate-400">{date}</p>
        </div>
      </div>

      {/* Body fills remaining height */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[420px_1fr]">
        {/* Left panel */}
        <div className="overflow-y-auto border-r border-slate-100 bg-gradient-to-b from-blue-50/60 to-white p-8">
          <div className="mb-4 flex items-center gap-2">
            <Bell size={20} className="text-red-500" />
            <p className="text-base font-bold uppercase tracking-wide text-slate-700">Now Serving</p>
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">
              {NOW_SERVING.department}
            </p>
            <p className="mb-4 text-6xl font-extrabold text-slate-900">{NOW_SERVING.queueNumber}</p>
            <span className="mb-4 inline-block rounded-full bg-red-100 px-4 py-1.5 text-sm font-bold text-red-600">
              {NOW_SERVING.terminal}
            </span>
            <p className="text-base text-slate-500">Please proceed to {NOW_SERVING.terminal.toLowerCase()}</p>
          </div>

          <div className="mb-8 flex items-center justify-center gap-2 rounded-full bg-blue-50 px-5 py-3 text-base font-medium text-[#123C73]">
            <Clock size={18} /> Estimated Wait: ~{NOW_SERVING.estMin} min
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="mb-4 flex items-center gap-2">
              <ListOrdered size={20} className="text-[#123C73]" />
              <p className="text-base font-bold uppercase tracking-wide text-slate-700">Next in Line</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {NEXT_IN_LINE.map((num) => (
                <div
                  key={num}
                  className="rounded-xl bg-blue-50 py-5 text-center text-xl font-bold text-[#123C73]"
                >
                  {num}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — info video / hospital image */}
        <div className="relative overflow-hidden bg-slate-200">
          {/* Replace this placeholder with an actual <img> of your hospital, or an
              embedded <video>/<iframe> for a real info video. */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400">
            <p className="px-10 text-center text-lg font-medium text-slate-500">
              Hospital exterior photo or info video goes here.
            </p>
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <button
              type="button"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 shadow-lg transition hover:bg-white"
              aria-label="Play information video"
            >
              <Play size={32} className="ml-1 text-[#123C73]" />
            </button>
            <span className="flex items-center gap-2 rounded-full bg-white/90 px-5 py-2 text-sm font-medium text-slate-700 shadow-sm">
              <Info size={14} /> SWUMed Information Video
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
