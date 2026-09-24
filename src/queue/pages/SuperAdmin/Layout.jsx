import { useEffect, useState } from 'react';

import {
  LayoutGrid,
  Users,
  Building2,
  Monitor,
  ClipboardList,
  BarChart3,
  Settings as SettingsIcon,
  ShieldCheck,
  BriefcaseBusiness,
  LogOut,
  User as UserIcon,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/Authcontext';
import logo from '../../../assets/logo.png';
import { canAccessSuperadminPage } from '../../services/accessControl';
import NotificationsBell from './NotificationsBell';


const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { key: 'users', label: 'User Management', icon: Users },
  { key: 'departments', label: 'Department Management', icon: Building2 },
  { key: 'kiosks', label: 'Kiosk Management', icon: Monitor },
  { key: 'roles', label: 'Role Management', icon: ShieldCheck },
  { key: 'positions', label: 'Position Management', icon: BriefcaseBusiness },
  { key: 'queues', label: 'Queue Management', icon: ClipboardList },
  { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

function toInitials(value, fallback = '?') {
  const initials = (value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || fallback;
}

export default function Layout({ activePage, onNavigate, children }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Only show pages this user is allowed to access
  const visibleNavItems = NAV_ITEMS.filter(({ key }) =>
    canAccessSuperadminPage(user, key)
  );

  // Header identity, read from the signed-in user
  const displayName = user?.full_name || user?.email || '';

  const roleLabel =
    typeof user?.role === 'object'
      ? user?.role?.role ?? ''
      : user?.role ?? '';

  const initials = toInitials(displayName);

  // Figma header: circular scope avatar + "Role / Current page"
  const scopeRole = roleLabel || 'Super Admin';
  const pageLabel =
    NAV_ITEMS.find((item) => item.key === activePage)?.label ?? 'Dashboard';
  const scopeInitials = toInitials(scopeRole, 'SA');

  // Prevent navigation to unauthorized pages
  function handleNavigate(key) {
    if (!canAccessSuperadminPage(user, key)) {
      onNavigate('dashboard');
      return;
    }

    onNavigate(key);
  }

  // Logout logic
  function handleLogout() {
    navigate('/superadmin/login', { replace: true });

    signOut().catch((error) => {
      console.error('Logout error:', error);
    });
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-[#F8F9FA]"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="flex w-64 flex-col border-r border-[#E5E7EB] bg-white">
          {/* Logo */}
          <div className="border-b border-[#E5E7EB] px-6 py-5">
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className="block cursor-pointer select-none text-left focus:outline-none"
              aria-label="Go to Dashboard"
              title="Go to Dashboard"
            >
              <img
                src={logo}
                alt="SWUMed Logo"
                className="h-8 w-auto object-contain object-left"
              />
            </button>

            <p className="mt-1 text-xs text-[#4B5563]">
              Queuing System
            </p>
          </div>

          {/* Navigation */}
          <nav className="swu-stagger flex-1 space-y-0.5 px-3 py-4">
            {visibleNavItems.map(({ key, label, icon: Icon }) => {
              const isActive = activePage === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleNavigate(key)}
                  className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[#9D0A0E] text-white shadow-sm shadow-[#9D0A0E]/30'
                      : 'text-[#4B5563] hover:translate-x-1 hover:bg-[#FBF1F1] hover:text-[#9D0A0E]'
                  }`}
                >
                  <Icon
                    size={18}
                    className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                  />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Logout Button at the bottom of the sidebar */}
          <div className="border-t border-[#E5E7EB] p-3">
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="swu-press group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#9D0A0E] transition-all duration-200 hover:translate-x-1 hover:bg-[#FBF1F1]"
            >
              <LogOut size={18} />
              Log out
            </button>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col">
          {/* Header — Figma: avatar + "Role / Page" on the left, bell + identity on the right */}
          <header className="flex items-center justify-between gap-4 border-b border-[#E5E7EB] bg-white px-8 py-3.5">
            <div className="flex min-w-0 items-center gap-4">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E4EAF4] text-[15px] font-semibold tracking-wide text-[#3E4A61]"
              >
                {scopeInitials}
              </span>

              <h1 className="truncate text-[22px] font-medium text-[#1F2937]">
                {scopeRole} <span className="text-[#9CA3AF]">/</span> {pageLabel}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-5">
              {/* Notifications */}
              <NotificationsBell />

              <span
                aria-hidden="true"
                className="h-8 w-px bg-[#E5E7EB]"
              />

              {/* Identity block triggers the profile modal */}
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="swu-press group flex items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-[#FBF1F1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9D0A0E]/30"
                aria-label="Profile"
                title="Profile"
              >
                <span className="hidden text-right sm:block">
                  <span className="block text-[13px] font-semibold leading-tight text-[#1F2937]">
                    {roleLabel || 'Super Admin'}
                  </span>

                  <span className="block text-[11px] leading-tight text-[#6B7280]">
                    {displayName}
                  </span>
                </span>

                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E4EAF4] text-sm font-semibold text-[#3E4A61]">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </span>
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 px-8 py-6">
            {children}
          </main>
        </div>
      </div>

      {/* Profile Modal Popup */}
      {showProfileModal && (
        <ProfileModal
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <LogoutModal
          onCancel={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
        />
      )}
    </div>
  );
}

// Closes a modal on Escape and locks background scrolling while it is open.
function useModalBehavior(onClose) {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);
}

// Internal Logout Confirmation Modal Component — proportions follow the Figma frame
function LogoutModal({ onCancel, onConfirm }) {
  useModalBehavior(onCancel);

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-description"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop w-full max-w-[520px] rounded-2xl bg-white px-10 py-9 text-center shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
      >
        <h2
          id="logout-title"
          className="text-[28px] font-bold leading-tight text-[#1F2937]"
        >
          Log Out?
        </h2>

        <p
          id="logout-description"
          className="mx-auto mt-4 max-w-[400px] text-[15px] leading-relaxed text-[#6B7280]"
        >
          Are you sure you want to log out? You will need to sign in again to
          access your assigned terminal.
        </p>

        <div className="mt-8 flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 flex-1 rounded-lg border-2 border-[#9EC5FE] bg-white text-[17px] font-semibold text-[#1F2937] transition-colors hover:bg-[#F4F8FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9EC5FE]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="h-12 flex-1 rounded-lg bg-[#8B0000] text-[17px] font-semibold text-white transition-colors hover:bg-[#6F0000] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B0000]/50"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

// Internal Profile Modal Component
function ProfileModal({ onClose }) {
  const { user } = useAuth();

  const fullName = user?.full_name || user?.name || '\u2014';

  const roleLabel =
    typeof user?.role === 'object'
      ? user?.role?.role ?? '\u2014'
      : user?.role ?? '\u2014';

  const initials =
    String(fullName)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?';

  const isActive =
    String(user?.status ?? 'active').toLowerCase() === 'active';

  const details = [
    { key: 'name', label: 'Full Name', value: fullName, icon: UserIcon },
    { key: 'email', label: 'Email Address', value: user?.email || '\u2014', icon: Mail },
    { key: 'role', label: 'System Role', value: roleLabel, icon: ShieldCheck },
    {
      key: 'position',
      label: 'Position Title',
      value: user?.position || user?.position_name || '\u2014',
      icon: BriefcaseBusiness,
    },
    {
      key: 'department',
      label: 'Department',
      value: user?.department || user?.department_name || '\u2014',
      icon: Building2,
    },
    {
      key: 'kiosk',
      label: 'Assigned Kiosk',
      value: user?.kiosk || user?.kiosk_name || '\u2014',
      icon: Monitor,
    },
  ];

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
      >

        {/* BANNER */}

        <div className="h-24 bg-[#9D0A0E]" />

        {/* AVATAR + STATUS */}

        <div className="-mt-12 flex flex-col items-center px-6">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#E4E7F5] text-xl font-bold text-[#1F2937] ring-4 ring-white">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          <span
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                : 'bg-[#F1F3F5] text-[#4B5563] ring-1 ring-[#E5E7EB]'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                isActive ? 'bg-emerald-500' : 'bg-[#9CA3AF]'
              }`}
            />
            Status: {isActive ? 'Active' : 'Inactive'}
          </span>

          <h2 id="profile-title" className="sr-only">
            My Profile
          </h2>
        </div>

        {/* DETAILS */}

        <div className="grid gap-3 px-6 py-5 sm:grid-cols-2">
          {details.map(({ key, label, value, icon: Icon }) => (
            <div
              key={key}
              className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5"
            >
              <p className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
                <Icon size={12} />
                {label}
              </p>

              <p className="mt-0.5 truncate text-sm font-bold text-[#1F2937]" title={value}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* FOOTER */}

        <div className="flex justify-end border-t border-[#E5E7EB] bg-[#F8F9FA] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-lg border border-[#E5E7EB] bg-white px-5 py-2 text-sm font-medium text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5]"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}