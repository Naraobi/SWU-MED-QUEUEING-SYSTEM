import { useEffect, useRef, useState } from 'react';
import { Bell, Trophy, Users, Info, AlertTriangle } from 'lucide-react';

const ICONS = {
  recognition: { icon: Trophy, wrap: 'bg-[#F1F3F5] text-[#4B5563]' },
  queue: { icon: Users, wrap: 'bg-[#F1F3F5] text-[#4B5563]' },
  system: { icon: Info, wrap: 'bg-[#F1F3F5] text-[#4B5563]' },
  urgent: { icon: AlertTriangle, wrap: 'bg-[#FBF1F1] text-[#9D0A0E]' },
};

const INITIAL_NOTIFICATIONS = [
  {
    id: '1',
    type: 'recognition',
    title: 'Performance Recognition',
    body: 'Great job! You completed 18 transactions today with an average time of 4.2 minutes.',
    time: 'Just now',
    read: false,
  },
  {
    id: '2',
    type: 'queue',
    title: 'Queue Update',
    body: 'Your department currently has 8 patients waiting.',
    time: '2h ago',
    read: true,
  },
  {
    id: '3',
    type: 'system',
    title: 'System Notice',
    body: 'A system update is scheduled for later today. Please save your work.',
    time: '4h ago',
    read: false,
  },
  {
    id: '4',
    type: 'urgent',
    title: 'Urgent Patient Alert',
    body: 'Dr. Smith requested immediate review of lab results for Room 204.',
    time: 'Yesterday',
    read: true,
    action: 'View Results',
  },
];

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markAsRead(id) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative text-[#4B5563] transition hover:text-[#1F2937]"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#9D0A0E] ring-2 ring-white" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-40 mt-2 w-96 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
            <h2 className="text-base font-bold text-[#1F2937]">Notifications</h2>
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="text-xs font-semibold text-[#9D0A0E] transition hover:text-[#7D080B] disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
            >
              Mark all as read
            </button>
          </div>

          {/* List */}
          <div className="max-h-96 divide-y divide-[#F1F3F5] overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-[#4B5563]">
                You have no notifications.
              </p>
            )}

            {notifications.map((item) => {
              const { icon: Icon, wrap } = ICONS[item.type] ?? ICONS.system;

              return (
                <div
                  key={item.id}
                  onClick={() => markAsRead(item.id)}
                  className={`flex cursor-pointer gap-3 px-4 py-3 transition ${
                    item.read ? 'bg-white hover:bg-[#F8F9FA]' : 'bg-[#FBF1F1] hover:bg-[#F6E7E7]'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${wrap}`}
                  >
                    <Icon size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[#1F2937]">{item.title}</p>

                      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                        <span
                          className={`text-xs ${
                            item.read ? 'text-[#9CA3AF]' : 'font-semibold text-[#9D0A0E]'
                          }`}
                        >
                          {item.time}
                        </span>
                        {!item.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#9D0A0E]" />
                        )}
                      </div>
                    </div>

                    <p className="mt-1 text-xs leading-5 text-[#4B5563]">{item.body}</p>

                    {item.action && (
                      <button
                        type="button"
                        className="mt-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F2937] transition hover:bg-[#F1F3F5]"
                      >
                        {item.action}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-[#E5E7EB] px-4 py-3 text-center">
            <button
              type="button"
              className="text-xs font-semibold text-[#4B5563] transition hover:text-[#9D0A0E]"
            >
              View All Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}