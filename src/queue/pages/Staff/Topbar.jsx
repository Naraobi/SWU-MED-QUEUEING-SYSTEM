import React, { useState, useEffect, useRef } from 'react';
import { useQueue } from '../../context/QueueContext.jsx';
import { useAuth } from '../../services/Authcontext.jsx';
import { X, CheckCheck, Bell, Activity, RefreshCw, Megaphone, CheckCircle2, Wrench } from 'lucide-react';

const STAFF_TERMINAL_KEY = 'swumed_staff_terminal';
const LAST_MILESTONE_KEY = 'swumed_last_celebrated_milestone';

export default function Topbar({ title, subtitle, currentTerminal, onOpenTerminalModal }) {
  const [online, setOnline] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState(currentTerminal || null);
  const panelRef = useRef(null);

  const { unreadCount, stats, notifications = [], markAllAsRead, markAsRead } = useQueue();
  const { user } = useAuth();

  const [toastMessage, setToastMessage] = useState(null);
  const [isFading, setIsFading] = useState(false);

  // Restored mock data combined with dynamic updates
  const [dynamicNotifications, setDynamicNotifications] = useState([
    {
      id: 1,
      type: 'system',
      category: 'notice',
      title: 'System Notice',
      message: 'A system update is scheduled for later today. Please save your work.',
      time: '4h ago',
      read: false,
    },
    {
      id: 2,
      type: 'system',
      category: 'maintenance',
      title: 'Terminal 2 Maintenance',
      message: 'Scheduled peripheral hardware and printer diagnostics completed successfully.',
      time: '2 days ago',
      read: true,
    },
  ]);

  const completedCount = stats?.completed || 0;

  // Persisted milestone check using localStorage to survive tab switching & remounts
  useEffect(() => {
    if (completedCount > 0 && completedCount % 5 === 0) {
      const lastCelebrated = Number(window.localStorage.getItem(LAST_MILESTONE_KEY) || 0);

      if (completedCount > lastCelebrated) {
        window.localStorage.setItem(LAST_MILESTONE_KEY, completedCount);

        const titleText = completedCount % 10 === 0 ? 'Shift Target Milestone' : 'Performance Recognition';
        const bodyText = `Great job! You have successfully completed ${completedCount} transactions today.`;

        const newNotification = {
          id: Date.now(),
          type: 'system',
          category: completedCount % 10 === 0 ? 'target' : 'performance',
          title: titleText,
          message: bodyText,
          time: 'Just now',
          read: false,
        };

        setDynamicNotifications(prev => [newNotification, ...prev]);

        setToastMessage({ title: titleText, message: bodyText });
        setIsFading(false);

        const fadeTimer = setTimeout(() => {
          setIsFading(true);
        }, 3500);

        const removeTimer = setTimeout(() => {
          setToastMessage(null);
          setIsFading(false);
        }, 4000);

        return () => {
          clearTimeout(fadeTimer);
          clearTimeout(removeTimer);
        };
      }
    }
  }, [completedCount]);

  const [activeTab, setActiveTab] = useState('All');
  
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const safeDynamic = Array.isArray(dynamicNotifications) ? dynamicNotifications : [];
  const allNotifications = safeNotifications.length > 0 ? safeNotifications : safeDynamic;

  const filteredNotifications = allNotifications.filter((n) => {
    if (!n) return false;
    if (activeTab === 'Queue') return n.type === 'queue';
    if (activeTab === 'System') return n.type === 'system';
    return true;
  });

  const currentUnreadCount = allNotifications.filter(n => !n.read).length;

  const handleMarkAllRead = () => {
    if (markAllAsRead) {
      markAllAsRead();
    } else {
      setDynamicNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleItemClick = (id) => {
    if (markAsRead) {
      markAsRead(id);
    } else {
      setDynamicNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowPanel(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (currentTerminal) {
      setSelectedTerminal(currentTerminal);
      return;
    }
    try {
      const raw = window.localStorage.getItem(STAFF_TERMINAL_KEY);
      if (!raw) {
        setSelectedTerminal(null);
        return;
      }
      const parsed = JSON.parse(raw);
      setSelectedTerminal(parsed ?? null);
    } catch {
      setSelectedTerminal(null);
    }
  }, [currentTerminal]);

  const staffName = `${user?.first_name || 'Ruth'} ${user?.last_name || 'Abella'}`;
  const initials = `${user?.first_name?.[0] || 'R'}${user?.last_name?.[0] || 'A'}`;
  const department = subtitle?.match(/department: (.*?) \(/)?.[1] || user?.department || 'Billing Department';

  const renderIcon = (category) => {
    switch (category) {
      case 'performance':
        return <Activity size={16} className="text-slate-700" />;
      case 'queue':
        return <RefreshCw size={16} className="text-slate-700" />;
      case 'notice':
        return <Megaphone size={16} className="text-slate-700" />;
      case 'target':
        return <CheckCircle2 size={16} className="text-slate-700" />;
      case 'maintenance':
        return <Wrench size={16} className="text-slate-700" />;
      default:
        return <BellIcon size={16} className="text-slate-700" />;
    }
  };

  return (
    <div className="flex h-[72px] min-h-[72px] w-full items-center justify-between border-b border-slate-200 bg-white">
      <div className="min-w-0 pl-[48px]">
        <h1 className="truncate text-xl font-bold text-slate-800">
          Staff · {department}
        </h1>
      </div>

      <div className="flex flex-shrink-0 items-center gap-4 pr-6">
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setShowPanel((v) => !v)}
            className="relative flex h-10 w-10 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 cursor-pointer"
          >
            <BellIcon />
            {(unreadCount > 0 || currentUnreadCount > 0) && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm">
                {unreadCount > 0 ? unreadCount : currentUnreadCount}
              </span>
            )}
          </button>

          {toastMessage && (
            <div className={`absolute right-14 top-0 z-50 w-80 rounded-xl border border-red-200 bg-white p-3.5 shadow-xl transition-all duration-500 ${isFading ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-[#9D0A0E]">
                  <Activity size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900">{toastMessage.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600 leading-tight">{toastMessage.message}</p>
                </div>
              </div>
            </div>
          )}

          {showPanel && (
            <div className="fixed right-0 top-0 bottom-0 z-50 w-[420px] border-l border-slate-200 bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 text-left">
              <div className="flex items-start justify-between border-b border-slate-100 px-6 pt-6 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Notifications</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Stay updated with your queue activity and system notices.</p>
                </div>
                <button
                  onClick={() => setShowPanel(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3 bg-slate-50/40">
                <div className="flex gap-2">
                  {['All', 'Queue', 'System'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        activeTab === tab
                          ? 'bg-[#9D0A0E] text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-bold text-[#9D0A0E] hover:underline cursor-pointer"
                >
                  Mark all as read
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {filteredNotifications.length > 0 ? (
                  filteredNotifications.map((item) => (
                    <div
                      key={item.id || item._id}
                      onClick={() => handleItemClick(item.id || item._id)}
                      className={`flex items-start gap-4 px-6 py-4 transition cursor-pointer ${
                        item.read ? 'bg-white opacity-80' : 'bg-slate-50/60 hover:bg-slate-100/60'
                      }`}
                    >
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-200 shadow-sm">
                        {renderIcon(item.category)}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900">{item.title}</p>
                            {!item.read && (
                              <span className="h-2 w-2 rounded-full bg-rose-600 shrink-0" />
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">{item.time}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">{item.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-24 text-center">
                    <BellIcon size={32} className="mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                    <p className="text-xs font-semibold text-slate-600">No notifications yet</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">We'll notify you when new queue updates arrive.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpenTerminalModal?.()}
          className="hidden items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition sm:flex cursor-pointer"
          title="Click to switch terminal"
        >
          <span>{selectedTerminal?.name || 'Select terminal'}</span>
          <span className="text-slate-300">|</span>
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span>Online</span>
        </button>

        <div className="hidden items-center gap-3 border-l border-slate-200 pl-4 sm:flex">
          <div className="text-right leading-tight">
            <p className="text-[10px] font-bold uppercase text-slate-500">Staff</p>
            <p className="text-xs text-slate-500">{staffName}</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dce8f9] text-sm font-bold text-[#315a91]">
            {initials}
          </span>
        </div>
      </div>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}