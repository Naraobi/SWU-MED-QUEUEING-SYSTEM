import { useState } from 'react';
import { BarChart3, Bell, ClipboardPlus, LayoutDashboard, LogOut, Monitor, Settings, Users } from 'lucide-react';
import { useAuth } from '../../services/Authcontext';
import { canAccessAdminPage } from '../../services/accessControl';
import logo from '../../../assets/logo.png';
import LogoutModal from '../../components/modals/LogoutModal';
import { useLanguage } from './LanguageContext';

const NAV_ITEMS = [
  { key: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { key: 'staff', labelKey: 'nav.staff', icon: Users },
  { key: 'queues', labelKey: 'nav.queues', icon: ClipboardPlus },
  { key: 'terminal', labelKey: 'nav.terminal', icon: Monitor },
  { key: 'reports', labelKey: 'nav.reports', icon: BarChart3 },
  { key: 'settings', labelKey: 'nav.settings', icon: Settings },
];

export default function AdminSidebar({ activeItem = 'dashboard', onSelect = () => {} }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const visibleItems = NAV_ITEMS.filter(({ key }) => canAccessAdminPage(user, key));

  function handleSelect(key) {
    if (!canAccessAdminPage(user, key)) return onSelect('dashboard');
    onSelect(key);
  }

  return (
    <>
      <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="flex h-[74px] flex-col items-center justify-center border-b border-slate-200 px-5 text-center">
          <img src={logo} alt="SWUMed Logo" className="h-9 w-auto object-contain" />
          <div className="text-[10px] font-medium tracking-wide text-slate-400">{t('nav.queuingSystem')}</div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-6">
          {visibleItems.map(({ key, labelKey, icon: Icon }) => (
            <button key={key} type="button" onClick={() => handleSelect(key)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition ${activeItem === key ? 'bg-[#9D0A0E] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <Icon size={17} /><span>{t(labelKey)}</span>
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-100 px-3 py-3">
          <button type="button" onClick={() => setShowLogoutModal(true)} className="flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700">
            <LogOut size={17} />{t('nav.logout')}
          </button>
        </div>
      </aside>
      {showLogoutModal && <LogoutModal onClose={() => setShowLogoutModal(false)} />}
    </>
  );
}

export function AdminHeaderBar({ title }) {
  const { user } = useAuth();
  const profileName = user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : 'John Doe';
  const profileRole = user?.role?.role || 'Admin';
  const initials = user?.first_name && user?.last_name ? `${user.first_name[0]}${user.last_name[0]}` : 'JD';
  const departmentPrefix = user?.department_prefix || '--';
  const headerTitle = title || `Admin / ${user?.department || 'Department'}`;

  return (
    <header className="flex h-[74px] items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dce8f9] text-sm font-semibold text-slate-700">{departmentPrefix}</span><div className="text-xl font-medium text-slate-600">{headerTitle}</div></div>
      <div className="flex items-center gap-4"><button type="button" className="text-slate-500 hover:text-slate-700" aria-label="Notifications"><Bell size={20} /></button><button type="button" className="flex items-center gap-2 border-l border-slate-200 pl-4 text-right" aria-label="Profile"><span><span className="block text-xs font-semibold text-slate-800">{profileRole}</span><span className="block text-[10px] text-slate-500">{profileName}</span></span><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dce8f9] text-xs font-bold text-[#315a91]">{initials}</span></button></div>
    </header>
  );
}
