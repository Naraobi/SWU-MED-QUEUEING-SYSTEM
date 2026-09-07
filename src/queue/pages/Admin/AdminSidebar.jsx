import { useState } from 'react';
import {
  BarChart3,
  Bell,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Monitor,
  Settings,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/Authcontext';
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
      <aside className="flex h-screen w-56 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-[74px] flex-col items-center justify-center border-b border-slate-200 px-5 text-center">
          <img src={logo} alt="SWUMed Logo" className="h-9 w-auto object-contain" />
          <div className="text-[10px] font-medium tracking-wide text-slate-400">Queuing System</div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-6">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
            const isActive = activeItem === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs font-medium transition ${
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

export function AdminHeaderBar({ title }) {
  const { user } = useAuth();
  const profileName = user?.first_name && user?.last_name
    ? `${user.first_name} ${user.last_name}`
    : 'John Doe';
  const profileRole = user?.role?.name || 'Admin';
  const initials = user?.first_name && user?.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`
    : 'JD';
  const departmentPrefix = user?.department_prefix || '--';
  const headerTitle = title || `Admin / ${user?.department || 'Department'}`;

  return (
    <header className="flex h-[74px] items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dce8f9] text-sm font-semibold text-slate-700">
          {departmentPrefix}
        </span>
        <div className="text-xl font-medium text-slate-600">{headerTitle}</div>
      </div>

      <div className="flex items-center gap-4">
        <button type="button" className="text-slate-500 hover:text-slate-700" aria-label="Notifications">
          <Bell size={20} />
        </button>
        <button type="button" className="flex items-center gap-2 border-l border-slate-200 pl-4 text-right" aria-label="Profile">
          <span>
            <span className="block text-xs font-semibold text-slate-800">{profileRole}</span>
            <span className="block text-[10px] text-slate-500">{profileName}</span>
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dce8f9] text-xs font-bold text-[#315a91]">
            {initials}
          </span>
        </button>
      </div>
    </header>
  );
}
