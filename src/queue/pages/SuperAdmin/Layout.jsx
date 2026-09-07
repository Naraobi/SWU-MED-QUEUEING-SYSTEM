import { useState } from 'react';
import {
  LayoutGrid,
  Users,
  Building2,
  ClipboardList,
  BarChart3,
  Settings as SettingsIcon,
  UserCircle,
  LogOut,
  Upload,
  X,
  User as UserIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/Authcontext';
import { supabase } from '../../../supabase'; // Adjust path if needed
import logo from '../../../assets/logo.png';
import NotificationsBell from './NotificationsBell';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { key: 'users', label: 'User Management', icon: Users },
  { key: 'departments', label: 'Department Management', icon: Building2 },
  { key: 'queues', label: 'Queue Management', icon: ClipboardList },
  { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function Layout({ activePage, onNavigate, children }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Moved the logout logic here so the sidebar button can use it
  function handleLogout() {
    navigate('/superadmin/login', { replace: true });
    signOut().catch((error) => {
      console.error('Logout error:', error);
    });
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
          {/* Logo */}
          <div className="border-b border-slate-100 px-6 py-5">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="block select-none text-left cursor-pointer focus:outline-none"
              aria-label="Go to Dashboard"
              title="Go to Dashboard"
            >
              <img src={logo} alt="SWUMed Logo" className="h-8 w-auto object-contain object-left" />
            </button>
            <p className="text-xs text-slate-400">Queuing System</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5 px-3 py-4">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
              const isActive = activePage === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigate(key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#00529B] text-white'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Logout Button at the bottom of the sidebar */}
          <div className="border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700"
            >
              <LogOut size={18} />
              Log out
            </button>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
            <p className="text-[30px] font-medium text-[#5F6368]">Super Admin</p>

            <div className="flex items-center gap-5">
              {/* Notifications */}
              <NotificationsBell />

              {/* Profile Icon triggers modal */}
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="text-slate-500 hover:text-slate-700"
                aria-label="Profile"
                title="Profile"
              >
                <UserCircle size={20} />
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 px-8 py-6">{children}</main>
        </div>
      </div>

      {/* Profile Modal Popup */}
      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
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

// Internal Logout Confirmation Modal Component
function LogoutModal({ onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <h2 className="text-lg font-bold text-slate-800">Log Out?</h2>
        <p className="mt-2 text-sm text-slate-500">
          Are you sure you want to log out? You will need to sign in again to
          access your assigned terminal.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[#00529B] py-2.5 text-sm font-semibold text-[#00529B] transition hover:bg-blue-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-[#7A1F2B] py-2.5 text-sm font-semibold text-white transition hover:bg-[#611825]"
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
  const { user } = useAuth(); // Removed signOut since it's no longer needed here

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
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

      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicURLData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const newAvatarUrl = publicURLData.publicUrl;

      const { error: updateError } = await supabase
        .from('user')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

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

    const { error } = await supabase
      .from('user')
      .update({ full_name: fullName })
      .eq('id', user.id);

    setSaving(false);
    if (error) setError(error.message);
    else setMessage('Profile updated successfully.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        >
          <X size={20} />
        </button>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800">My Profile</h1>
          {/* Log out button was removed from here */}
        </div>

        {/* Avatar Section */}
        <div className="mb-6 flex flex-col items-center">
          <div className="relative h-20 w-20 flex items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <UserIcon size={32} className="text-slate-400" />
            )}
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <Upload size={14} />
            {uploading ? 'Uploading...' : 'Change avatar'}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
          <input
            type="text"
            value={user?.email ?? ''}
            disabled
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-500">Role</label>
          <input
            type="text"
            value={user?.role ?? 'Super Admin'}
            disabled
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-500">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#123C73] focus:outline-none"
          />
        </div>

        {message && <p className="mb-3 text-xs text-emerald-600">{message}</p>}
        {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-[#00529B] py-2.5 text-sm font-semibold text-white hover:bg-[#003F75] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}