import { ClipboardList, ExternalLink, History, MonitorPlay } from 'lucide-react';
import { Link } from 'react-router-dom';

const LINKS = [
  {
    title: 'Staff Queue Terminal',
    description: 'Open the SWUMed staff terminal to call, serve, complete, or skip patients.',
    href: '/staff',
    icon: ClipboardList,
  },
  {
    title: 'Queue History',
    description: 'Review completed and skipped transactions handled by the staff terminal.',
    href: '/staff/history',
    icon: History,
  },
  {
    title: 'TV Queue Display',
    description: 'Open the public display used to show the current queue number.',
    href: '/display',
    icon: MonitorPlay,
  },
];

export default function AdminQueueManagement() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Queue Management</h1>
      <p className="mt-1 text-sm text-slate-400">
        Access the staff terminal, queue history, and public queue display.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {LINKS.map(({ title, description, href, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Icon size={20} />
            </div>
            <div className="mt-4 flex items-start justify-between gap-3">
              <h2 className="font-semibold text-slate-800">{title}</h2>
              <ExternalLink size={16} className="mt-0.5 text-slate-400 group-hover:text-blue-700" />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800">
        <p className="font-semibold">Staff workflow</p>
        <p className="mt-1 text-blue-700">
          Patients receive queue numbers from the kiosk, staff manage them from the terminal, and the display is available separately for the waiting area.
        </p>
      </div>
    </div>
  );
}
