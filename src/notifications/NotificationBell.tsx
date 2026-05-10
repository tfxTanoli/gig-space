import { useRef, useState, useEffect } from 'react';
import {
  Bell,
  MessageSquare,
  Tag,
  Truck,
  RotateCcw,
  Star,
  CheckCircle,
  X,
  Loader2,
} from 'lucide-react';
import { useNotifications, type AppNotification } from './useNotifications';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface TypeConfig {
  Icon: React.ElementType;
  iconClass: string;
  bgClass: string;
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
  message:        { Icon: MessageSquare, iconClass: 'text-blue-400',    bgClass: 'bg-blue-500/10'    },
  offer:          { Icon: Tag,           iconClass: 'text-green-400',   bgClass: 'bg-green-500/10'   },
  offer_accepted: { Icon: CheckCircle,   iconClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10' },
  delivery:       { Icon: Truck,         iconClass: 'text-purple-400',  bgClass: 'bg-purple-500/10'  },
  revision:       { Icon: RotateCcw,     iconClass: 'text-yellow-400',  bgClass: 'bg-yellow-500/10'  },
  review:         { Icon: Star,          iconClass: 'text-amber-400',   bgClass: 'bg-amber-500/10'   },
};

const DEFAULT_TYPE: TypeConfig = {
  Icon: Bell,
  iconClass: 'text-slate-400',
  bgClass: 'bg-slate-700/40',
};

function navTabForType(type: string): string {
  switch (type) {
    case 'message':
    case 'offer':
      return 'Messages';
    default:
      return 'Orders';
  }
}

/* ── Notification item ───────────────────────────────────────────────────── */

function NotifItem({
  notif,
  onClick,
  onDelete,
  disabled,
}: {
  notif: AppNotification;
  onClick: (n: AppNotification) => void;
  onDelete: (n: AppNotification) => void;
  disabled?: boolean;
}) {
  const cfg = TYPE_CONFIG[notif.type] ?? DEFAULT_TYPE;
  const { Icon } = cfg;

  return (
    <div
      className={`group relative isolate flex items-start gap-3 rounded-xl px-3 py-3 transition-colors border ${
        !notif.isRead
          ? 'bg-blue-600/5 border-blue-500/15 hover:bg-blue-600/10'
          : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/70'
      }`}
    >
      {/* Clickable area */}
      <button
        onClick={() => onClick(notif)}
        disabled={disabled}
        className="flex items-start gap-3 flex-1 min-w-0 text-left disabled:opacity-60 disabled:cursor-default"
      >
        {/* Type icon */}
        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${cfg.bgClass}`}>
          <Icon className={`w-4 h-4 ${cfg.iconClass}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-4">
          <p className={`text-sm leading-snug ${!notif.isRead ? 'text-white font-semibold' : 'text-slate-300 font-medium'}`}>
            {notif.title}
          </p>
          {notif.body && notif.type !== 'message' && (
            <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">
              {notif.body}
            </p>
          )}
          <p className="text-[10px] text-slate-600 mt-1">{relativeTime(notif.createdAt)}</p>
        </div>
      </button>

      {/* Unread dot */}
      {!notif.isRead && (
        <span className="absolute right-3 top-3.5 w-2 h-2 rounded-full bg-blue-500 group-hover:hidden" />
      )}

      {/* Delete button — visible on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(notif); }}
        disabled={disabled}
        className="absolute right-2.5 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700/60 disabled:cursor-not-allowed"
        aria-label="Remove notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

interface NotificationBellProps {
  /** Switches the active tab in the parent dashboard */
  onNavigate: (tab: string) => void;
}

export default function NotificationBell({ onNavigate }: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleNotifClick = async (notif: AppNotification) => {
    if (marking) return;
    await markAsRead(notif.id);
    setOpen(false);
    onNavigate(navTabForType(notif.type));
  };

  const handleDelete = async (notif: AppNotification) => {
    if (marking) return;
    await deleteNotification(notif.id).catch(console.error);
  };

  const handleMarkAllRead = async () => {
    if (marking) return;
    setMarking(true);
    try {
      await markAllAsRead();
    } catch (err) {
      console.error('Mark all read error:', err);
    } finally {
      setMarking(false);
    }
  };

  const displayCount = Math.min(Math.max(0, unreadCount), 99);

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        aria-label={`Notifications${displayCount > 0 ? ` (${displayCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {displayCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none pointer-events-none">
            {displayCount > 9 ? '9+' : displayCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              {displayCount > 0 && (
                <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                  {displayCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Mark all read */}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={marking}
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {marking ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Marking…
                    </>
                  ) : (
                    'Mark all read'
                  )}
                </button>
              )}

              {/* Close */}
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable list — flex-col ensures items stack vertically, never overlap */}
          <div
            className="overflow-y-auto max-h-[400px]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
          >
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 px-4">
                <Bell className="w-8 h-8 text-slate-700" />
                <p className="text-slate-500 text-sm text-center">No notifications yet</p>
                <p className="text-slate-600 text-xs text-center">
                  You'll be notified about messages, orders, and reviews.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-3">
                {notifications.map((n) => (
                  <NotifItem
                    key={n.id}
                    notif={n}
                    onClick={handleNotifClick}
                    onDelete={handleDelete}
                    disabled={marking}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
