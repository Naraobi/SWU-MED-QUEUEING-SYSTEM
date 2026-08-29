import { useState } from 'react';
import {
  BarChart3,
  Bell,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Monitor,
  Settings,
  UserCircle,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '../../../assets/logo.png';
import LogoutModal from '../../components/modals/LogoutModal';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { key: 'staff', label: 'Staff Management', icon: Users },
  { key: 'terminal', label: 'Terminal Management', icon: Monitor },
  { key: 'queues', label: 'Queue Management', icon: ClipboardList },
  { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function AdminSidebar({ activeItem = 'dashboard', onSelect = () => {} }) {
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  return (
    <>
      <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <img src={logo} alt="SWUMed Logo" className="h-9 w-auto object-contain" />
          <div>
            <div className="text-[15px] font-bold text-[#0B4E8A]">SWUMed</div>
            <div className="text-[10px] font-medium tracking-wide text-slate-400">Queuing System</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
            const isActive = activeItem === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
                  isActive
                    ? 'bg-[#00549A] text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon size={17} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 px-3 py-3">
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      {showLogoutModal && <LogoutModal onClose={() => setShowLogoutModal(false)} />}
    </>
  );
}

export function AdminHeaderBar({ title = 'Admin / Billing Department' }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div className="text-2xl font-medium text-slate-600">{title}</div>

      <div className="flex items-center gap-4">
        <button type="button" className="text-slate-500 hover:text-slate-700" aria-label="Notifications">
          <Bell size={20} />
        </button>
        <button type="button" className="text-slate-500 hover:text-slate-700" aria-label="Profile">
          <UserCircle size={22} />
        </button>
      </div>
    </header>
  );
}
