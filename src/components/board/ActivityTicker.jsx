import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, MessageSquare, Clock } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import styles from './ActivityTicker.module.css';

const formatIdle = (sinceMs) => {
  const totalMinutes = Math.floor((Date.now() - sinceMs) / 60000);
  const days    = Math.floor(totalMinutes / 1440);
  const hours   = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0)  return `${days}d${hours   > 0 ? ' ' + hours   + 'h' : ''}`;
  if (hours > 0) return `${hours}h${minutes > 0 ? ' ' + minutes + 'm' : ''}`;
  return `${minutes}m`;
};

const stripHtml = (html) => {
  if (!html) return null;
  return html.replace(/<[^>]*>/g, '').trim() || null;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const ActivityTicker = ({ staleTasks, onTaskClick }) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close panel if tasks clear
  useEffect(() => {
    if (!staleTasks || staleTasks.length === 0) setOpen(false);
  }, [staleTasks]);

  if (!staleTasks || staleTasks.length === 0) return null;

  const msgs = staleTasks
    .map(t => `⚠  ${t.title}`)
    .join('          ');
  const content = `${msgs}          ${msgs}`;
  const duration = Math.max(18, Math.round(content.length * 0.22));

  return (
    <div ref={panelRef}>
      {/* ── Ticker bar ── */}
      <div
        className={`${styles.ticker} ${open ? styles.tickerActive : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Click for details"
      >
        <div className={styles.label}>
          <AlertTriangle size={13} />
          <span>Need Follow Up</span>
          <span className={styles.count}>{staleTasks.length}</span>
        </div>
        <div className={styles.track}>
          <span className={styles.content} style={{ animationDuration: `${duration}s` }}>
            {content}
          </span>
        </div>
        <div className={styles.chevronHint}>{open ? '▲' : '▼'}</div>
      </div>

      {/* ── Detail panel ── */}
      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              <AlertTriangle size={14} /> Need Follow Up — {staleTasks.length} task
            </span>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>

          <ul className={styles.taskList}>
            {staleTasks.map(t => {
              const lastMsg = stripHtml(t.latestCommentMessage);
              return (
                <li
                  key={t.id}
                  className={`${styles.taskItem} ${onTaskClick ? styles.taskItemClickable : ''}`}
                  onClick={() => { if (onTaskClick) { setOpen(false); onTaskClick(t.id); } }}
                >
                  {t.assignee && (
                    <UserAvatar user={t.assignee} size={28} title={t.assignee.name} style={{ flexShrink: 0, marginTop: 2 }} />
                  )}
                  <div className={styles.taskBody}>
                    <div className={styles.taskName}>{t.title}</div>

                    <div className={styles.idleRow}>
                      <Clock size={11} />
                      {t.latestCommentAt
                        ? <span>Last activity <strong>{formatIdle(new Date(t.latestCommentAt).getTime())} ago</strong></span>
                        : <span>No comments yet</span>
                      }
                    </div>

                    <div className={styles.commentRow}>
                      <MessageSquare size={11} />
                      {lastMsg ? (
                        <span>
                          <span className={styles.commentBy}>{t.latestCommentBy}:</span>
                          {' '}&ldquo;{lastMsg}&rdquo;
                          <span className={styles.commentTime}> · {formatDate(t.latestCommentAt)}</span>
                        </span>
                      ) : (
                        <span className={styles.noComment}>No comments yet</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ActivityTicker;
