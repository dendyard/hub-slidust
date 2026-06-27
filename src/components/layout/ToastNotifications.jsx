import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useData } from '../../context/DataContext';
import styles from './ToastNotifications.module.css';

const MAX_VISIBLE = 5;
const DISMISS_KEY = 'pm_dismissed_toasts';

const loadDismissed = () => {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY)) || []); }
  catch { return new Set(); }
};
const saveDismissed = (set) => {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...set])); } catch {}
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return 'Baru saja';
  if (m < 60) return `${m} menit lalu`;
  if (h < 24) return `${h} jam lalu`;
  return `${d} hari lalu`;
};

const renderMessage = (n) => {
  if (n.type === 'mention') {
    return n.assigned_by_name
      ? <><strong>{n.assigned_by_name}</strong> menyebut kamu di komentar</>
      : <>Kamu disebut di komentar</>;
  }
  if (n.type === 'reply') {
    return n.assigned_by_name
      ? <><strong>{n.assigned_by_name}</strong> membalas komentar kamu</>
      : <>Seseorang membalas komentar kamu</>;
  }
  return n.assigned_by_name
    ? <><strong>{n.assigned_by_name}</strong> menugaskan task ke kamu</>
    : <>Kamu ditugaskan ke task</>;
};

/**
 * Floating stack of popup notification toasts (top-right, below the header).
 * Shows every UNREAD notification that hasn't been dismissed. Dismissals are
 * persisted to localStorage, so a closed toast stays closed across reloads
 * while genuinely new notifications still pop up. Each toast can be opened
 * (jumps to the task) or dismissed individually.
 */
const ToastNotifications = ({ onTaskClick }) => {
  const { notifications, markNotificationRead } = useData();
  const [dismissed, setDismissed] = useState(loadDismissed);

  // Unread, not-dismissed notifications, newest first
  const toasts = notifications
    .filter(n => !n.is_read && !dismissed.has(n.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const dismiss = (id) => {
    setDismissed(prev => {
      const next = new Set(prev).add(id);
      saveDismissed(next);
      return next;
    });
  };

  const open = (n) => {
    markNotificationRead(n.id);
    dismiss(n.id);
    onTaskClick?.(n.task_id);
  };

  if (!toasts.length) return null;

  const visible = toasts.slice(0, MAX_VISIBLE);
  const overflow = toasts.length - visible.length;

  return (
    <div className={styles.stack} role="region" aria-label="Notifikasi baru">
      {visible.map(n => (
        <div key={n.id} className={styles.toast}>
          <button
            className={styles.body}
            onClick={() => open(n)}
            type="button"
          >
            <span className={styles.icon}><Bell size={15} /></span>
            <span className={styles.content}>
              <span className={styles.text}>{renderMessage(n)}</span>
              {n.task_title && <span className={styles.taskTitle}>{n.task_title}</span>}
              {(n.type === 'mention' || n.type === 'reply') && n.excerpt && (
                <span className={styles.excerpt}>&ldquo;{n.excerpt}&rdquo;</span>
              )}
              <span className={styles.time}>{formatTime(n.created_at)}</span>
            </span>
          </button>
          <button
            className={styles.close}
            onClick={() => dismiss(n.id)}
            title="Tutup"
            aria-label="Tutup notifikasi"
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {overflow > 0 && (
        <div className={styles.overflow}>+{overflow} notifikasi lainnya</div>
      )}
    </div>
  );
};

export default ToastNotifications;
