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
  Upload,
  X,
  User as UserIcon,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/Authcontext';
import logo from '../../../assets/logo.png';
import { canAccessSuperadminPage } from '../../services/accessControl';
import NotificationsBell from './NotificationsBell';

// ⚠️ ProfileModal below calls `supabase.storage` and `supabase.from(...)`, but this file
// never imports supabase — avatar upload and "Save changes" will throw
// "supabase is not defined" at runtime. Uncomment the line below with your real path:
// import { supabase } from '../../services/supabaseClient';

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
        <aside className="sticky top-0 flex h-screen w-64 flex-shrink-0 flex-col border-r border-[#E5E7EB] bg-white">
          {/* Logo */}
          <div className="shrink-0 border-b border-[#E5E7EB] px-6 py-5">
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
          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
            {visibleNavItems.map(({ key, label, icon: Icon }) => {
              const isActive = activePage === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleNavigate(key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#9D0A0E] text-white'
                      : 'text-[#4B5563] hover:bg-[#F1F3F5] hover:text-[#1F2937]'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Logout Button at the bottom of the sidebar */}
          <div className="mt-auto shrink-0 border-t border-[#E5E7EB] p-3">
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#9D0A0E] transition hover:bg-[#FBF1F1]"
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
                className="flex items-center gap-3 rounded-lg px-1 py-1 transition hover:bg-[#F8F9FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9D0A0E]/30"
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-description"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[520px] rounded-2xl bg-white px-10 py-9 text-center shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
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

  useModalBehavior(onClose);

  const [fullName, setFullName] = useState(
    user?.full_name ?? ''
  );

  const [avatarUrl, setAvatarUrl] = useState(
    user?.avatar_url ?? ''
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function handleAvatarUpload(e) {
    try {
      setUploading(true);
      setError(null);
      setMessage(null);

      if (!e.target.files || e.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      if (!user?.user_id) {
        throw new Error('User ID could not be found.');
      }

      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();

      const fileName = `${user.user_id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicURLData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const newAvatarUrl = publicURLData.publicUrl;

      const { error: updateError } = await supabase
        .from('user')
        .update({
          avatar_url: newAvatarUrl,
        })
        .eq('user_id', user.user_id);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(newAvatarUrl);
      setMessage('Avatar updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);

    if (!user?.user_id) {
      setError('User ID could not be found.');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('user')
      .update({
        full_name: fullName,
      })
      .eq('user_id', user.user_id);

    setSaving(false);

    if (error) {
      setError(error.message);
    } else {
      setMessage('Profile updated successfully.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-[#4B5563] transition hover:bg-[#F1F3F5] hover:text-[#1F2937] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9D0A0E]/30"
          aria-label="Close profile"
        >
          <X size={20} />
        </button>

        <div className="mb-6">
          <h2 id="profile-title" className="text-lg font-semibold text-[#1F2937]">
            My Profile
          </h2>
        </div>

        {/* Avatar Section */}
        <div className="mb-6 flex flex-col items-center">
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[#E5E7EB] bg-[#F1F3F5]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserIcon
                size={32}
                className="text-[#4B5563]"
              />
            )}
          </div>

          <label className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5]">
            <Upload size={14} />

            {uploading
              ? 'Uploading...'
              : 'Change avatar'}

            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {/* Email */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-[#4B5563]">
            Email
          </label>

          <input
            type="text"
            value={user?.email ?? ''}
            disabled
            className="w-full rounded-lg border border-[#E5E7EB] bg-[#F1F3F5] px-3 py-2 text-sm text-[#4B5563]"
          />
        </div>

        {/* Role */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-[#4B5563]">
            Role
          </label>

          <input
            type="text"
            value={
              typeof user?.role === 'object'
                ? user?.role?.role ?? 'Super Admin'
                : user?.role ?? 'Super Admin'
            }
            disabled
            className="w-full rounded-lg border border-[#E5E7EB] bg-[#F1F3F5] px-3 py-2 text-sm text-[#4B5563]"
          />
        </div>

        {/* Full Name */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-[#4B5563]">
            Full name
          </label>

          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
          />
        </div>

        {/* Messages */}
        {message && (
          <p className="mb-3 text-xs text-emerald-600">
            {message}
          </p>
        )}

        {error && (
          <p className="mb-3 text-xs text-[#9D0A0E]">
            {error}
          </p>
        )}

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-11 w-full rounded-lg bg-[#9D0A0E] text-sm font-semibold text-white transition-colors hover:bg-[#7D080B] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
