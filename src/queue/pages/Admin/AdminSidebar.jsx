import { useEffect, useState } from 'react';
import { BarChart3, Bell, ClipboardPlus, LayoutDashboard, LogOut, Monitor, Settings, Users, Pencil } from 'lucide-react';
import { useAuth } from '../../services/Authcontext';
import { canAccessAdminPage } from '../../services/accessControl';
import logo from '../../../assets/logo.png';
import LogoutModal from '../../components/modals/LogoutModal';
import ProfileModal, { getStoredProfileAvatar } from '../../components/modals/ProfileModal';
import { useLanguage } from './LanguageContext';
import { useAppearance } from './AppearanceContext';

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
  const { logoUrl } = useAppearance();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const visibleItems = NAV_ITEMS.filter(({ key }) =>
    canAccessAdminPage(user, key)
  );

  function handleSelect(key) {
    if (!canAccessAdminPage(user, key)) return onSelect('dashboard');
    onSelect(key);
  }

  return (
    <>
      <aside
        className="sticky top-0 flex h-screen w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        <div className="flex h-[74px] shrink-0 flex-col items-center justify-center border-b border-slate-200 px-5 text-center">
          <img
            src={logoUrl || logo}
            alt="SWUMed Logo"
            className="h-9 w-auto object-contain"
          />

          <div className="text-[10px] font-medium tracking-wide text-slate-400">
            {t('nav.queuingSystem')}
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-6">
          {visibleItems.map(({ key, labelKey, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition ${
                activeItem === key
                  ? 'bg-[#9D0A0E] text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon size={18} />
              <span>{t(labelKey)}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto flex h-[var(--bottom-bar-height)] shrink-0 items-center border-t border-slate-100 px-3 py-0">
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#9D0A0E] transition hover:bg-[#9D0A0E]/5"
          >
            <LogOut size={17} />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {showLogoutModal && (
        <LogoutModal
          onClose={() => setShowLogoutModal(false)}
        />
      )}
    </>
  );
}

export function AdminHeaderBar({ title }) {
  const { user } = useAuth();
  const { t } = useLanguage();

  /*
   * KEEP AppearanceContext for the SYSTEM appearance.
   * logoUrl is still used by AdminSidebar.
   *
   * It is NOT used for the user's profile picture anymore.
   */
  const {
    accent,
    logoUrl,
    setAccent,
    setLogo,
  } = useAppearance();

  const [showProfile, setShowProfile] = useState(false);

  /*
   * Individual Admin profile picture.
   */
  const [profileAvatar, setProfileAvatar] = useState(() =>
    getStoredProfileAvatar(user)
  );

  useEffect(() => {
    setProfileAvatar(getStoredProfileAvatar(user));
  }, [user]);

  /*
   * Update the top-right avatar after ProfileModal saves.
   */
  useEffect(() => {
    function handleAvatarChanged(event) {
      if (!event.detail) return;

      setProfileAvatar(event.detail.avatar || '');
    }

    window.addEventListener(
      'swumed-profile-avatar-changed',
      handleAvatarChanged
    );

    return () => {
      window.removeEventListener(
        'swumed-profile-avatar-changed',
        handleAvatarChanged
      );
    };
  }, []);

  const profileName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : 'John Doe';

const profileRole =
  user?.position_name ||
  user?.role_name ||
  user?.role?.role ||
  'Admin';

  const initials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : 'JD';

  const departmentPrefix =
    user?.department_prefix || '--';

  const headerTitle =
    title ||
    `Admin / ${user?.department || 'Department'}`;

  return (
    <>
      <header className="flex h-[74px] items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dce8f9] text-sm font-semibold text-slate-700">
            {departmentPrefix}
          </span>

          <div className="text-xl font-medium text-slate-600">
            {headerTitle}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            aria-label="Notifications"
          >
            <Bell size={20} />
          </button>

          <button
            type="button"
            onClick={() => setShowProfile(true)}
            className="group flex items-center gap-2 rounded-md border-l border-slate-200 py-1 pl-4 pr-2 text-right transition hover:bg-slate-50 cursor-pointer"
            aria-label="Profile"
          >
            <span>
              <span className="block text-xs font-semibold text-slate-800">
                {profileRole}
              </span>

              <span className="block text-[10px] text-slate-500">
                {profileName}
              </span>
            </span>

            <span className="group relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#dce8f9] text-xs font-bold text-[#315a91]">
              {profileAvatar ? (
                <img
                  src={profileAvatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}

              {/* Pencil appears only when hovering profile picture */}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Pencil
                  size={13}
                  className="text-white"
                />
              </span>
            </span>
          </button>
        </div>
      </header>

      {showProfile && (
        <ProfileModal
          accent={accent}
          logoUrl={logoUrl}
          onLogoChange={setLogo}
          onAccentChange={setAccent}
          onAvatarChange={setProfileAvatar}
          t={t}
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  );
}