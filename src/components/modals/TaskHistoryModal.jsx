import { useEffect, useState } from 'react';
import { X, Plus, ArrowRightLeft, UserCheck, CheckSquare, MessageSquare, Clock } from 'lucide-react';
import { API_BASE, authFetch } from '../../context/DataContext';
import UserAvatar from '../ui/UserAvatar';
import styles from './TaskHistoryModal.module.css';

/* ── Event type config ───────────────────────────────────── */
const TYPE = {
  created:          { label: 'Task Created',      icon: Plus,           color: '#22c55e', bg: '#dcfce7' },
  status:           { label: 'Status Changed',    icon: ArrowRightLeft, color: '#3b82f6', bg: '#dbeafe' },
  assigned:         { label: 'Assignee Changed',  icon: UserCheck,      color: '#a855f7', bg: '#f3e8ff' },
  subtask_status:   { label: 'Subtask Updated',   icon: CheckSquare,    color: '#f59e0b', bg: '#fef3c7' },
  subtask_assigned: { label: 'Subtask Assigned',  icon: UserCheck,      color: '#ec4899', bg: '#fce7f3' },
  comment:          { label: 'Comment',           icon: MessageSquare,  color: '#06b6d4', bg: '#cffafe' },
};
const fallback = { label: 'Update', icon: Clock, color: '#64748b', bg: '#f1f5f9' };
const cfg = t => TYPE[t] || fallback;

/* ── Helpers ─────────────────────────────────────────────── */
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateLabel(ts) {
  const d   = new Date(ts);
  const now = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const day       = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (day === today)     return 'Today';
  if (day === yesterday) return 'Yesterday';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function Pill({ children, color, bg }) {
  return (
    <span className={styles.pill} style={{ background: bg, color }}>
      {children}
    </span>
  );
}

function EventBody({ item }) {
  const { change_type: t, old_value: ov, new_value: nv, subtask_title: st, changed_by_name: name } = item;

  if (t === 'created')
    return <span>Task dibuat oleh <strong>{name || 'System'}</strong></span>;

  if (t === 'status')
    return (
      <span>
        Status berubah dari <Pill color="#92400e" bg="#fef3c7">{ov || '—'}</Pill>
        {' → '}
        <Pill color="#1e40af" bg="#dbeafe">{nv || '—'}</Pill>
      </span>
    );

  if (t === 'assigned')
    return (
      <span>
        Assignee: <strong>{ov || 'Unassigned'}</strong>
        {' → '}
        <strong>{nv || 'Unassigned'}</strong>
      </span>
    );

  if (t === 'subtask_status')
    return (
      <span>
        <span className={styles.subtaskName}>"{st}"</span>
        {' '}
        <Pill color="#92400e" bg="#fef3c7">{ov || '—'}</Pill>
        {' → '}
        <Pill color="#166534" bg="#dcfce7">{nv || '—'}</Pill>
      </span>
    );

  if (t === 'subtask_assigned')
    return (
      <span>
        <span className={styles.subtaskName}>"{st}"</span> di-assign ke <strong>{nv || 'Unassigned'}</strong>
      </span>
    );

  if (t === 'comment')
    return (
      <span>
        <strong>{name}</strong> berkomentar
        {nv && <span className={styles.commentSnippet}>"{nv}"</span>}
      </span>
    );

  return <span>{ov}{ov && nv ? ' → ' : ''}{nv}</span>;
}

/* ── Main component ──────────────────────────────────────── */
export default function TaskHistoryModal({ taskId, taskTitle, onClose }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);

    Promise.all([
      authFetch(`${API_BASE}/task_history?task_id=${taskId}`).then(r => r.json()).catch(() => []),
      authFetch(`${API_BASE}/comments?task_id=${taskId}`).then(r => r.json()).catch(() => []),
    ]).then(([history, comments]) => {
      const hist = (Array.isArray(history) ? history : []).map(h => ({
        ...h,
        _type: 'history',
        sort_ts: new Date(h.created_at).getTime(),
        author_name:   h.changed_by_name,
        author_avatar: h.changed_by_avatar,
      }));

      // Only top-level comments (no replies)
      const comms = (Array.isArray(comments) ? comments : [])
        .filter(c => !c.parent_id)
        .map(c => ({
          id:            c.id,
          change_type:   'comment',
          new_value:     c.message?.replace(/<[^>]*>/g, '').slice(0, 80),
          created_at:    c.created_at,
          changed_by_name:   c.user_name,
          changed_by_avatar: c.user_avatar,
          _type: 'comment',
          sort_ts: new Date(c.created_at).getTime(),
          author_name:   c.user_name,
          author_avatar: c.user_avatar,
        }));

      const merged = [...hist, ...comms].sort((a, b) => a.sort_ts - b.sort_ts);
      setItems(merged);
    }).finally(() => setLoading(false));
  }, [taskId]);

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}><Clock size={15} /></div>
            <div>
              <div className={styles.headerTitle}>Task History</div>
              <div className={styles.headerSub} title={taskTitle}>{taskTitle}</div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={17} /></button>
        </div>

        {/* Stats */}
        {!loading && items.length > 0 && (
          <div className={styles.statsBar}>
            {Object.entries(TYPE).map(([type, c]) => {
              const count = items.filter(i => i.change_type === type).length;
              if (!count) return null;
              const Icon = c.icon;
              return (
                <div key={type} className={styles.statChip} style={{ background: c.bg, color: c.color }}>
                  <Icon size={11} strokeWidth={2.5} />
                  <span>{count}</span>
                </div>
              );
            })}
            <div className={styles.statTotal}>{items.length} events</div>
          </div>
        )}

        {/* Body */}
        <div className={styles.body}>
          {loading ? (
            <Skeleton />
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <Clock size={38} strokeWidth={1.2} />
              <p>Belum ada history untuk task ini</p>
            </div>
          ) : (
            <Timeline items={items} />
          )}
        </div>

      </div>
    </div>
  );
}

/* ── Timeline ────────────────────────────────────────────── */
function Timeline({ items }) {
  // Group by date label but keep flat array for continuous line
  let lastDate = null;

  return (
    <div className={styles.timeline}>
      {/* Single continuous vertical line behind all events */}
      <div className={styles.verticalLine} />

      {items.map((item, idx) => {
        const dateLabel = fmtDateLabel(item.created_at);
        const showDate  = dateLabel !== lastDate;
        lastDate = dateLabel;
        const c    = cfg(item.change_type);
        const Icon = c.icon;
        const isLast = idx === items.length - 1;

        return (
          <div key={item.id + '_' + idx}>
            {showDate && (
              <div className={styles.dateDivider}>
                <span className={styles.datePill}>{dateLabel}</span>
              </div>
            )}
            <div className={`${styles.event} ${isLast ? styles.eventLast : ''}`}>
              {/* Dot on the line */}
              <div className={styles.dotWrap}>
                <div className={styles.dot} style={{ background: c.color, boxShadow: `0 0 0 3px ${c.bg}` }}>
                  <Icon size={9} color="#fff" strokeWidth={2.8} />
                </div>
              </div>

              {/* Card */}
              <div className={styles.card}>
                <div className={styles.cardRow}>
                  <UserAvatar
                    name={item.changed_by_name || 'System'}
                    avatar={item.changed_by_avatar}
                    size={26}
                  />
                  <div className={styles.cardContent}>
                    <div className={styles.eventLabel} style={{ color: c.color }}>
                      <Icon size={10} strokeWidth={2.8} />
                      {c.label}
                    </div>
                    <div className={styles.eventDesc}>
                      <EventBody item={item} />
                    </div>
                  </div>
                  <div className={styles.timeTag}>{fmtTime(item.created_at)}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Skeleton ────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className={styles.skeletonWrap}>
      {[1,2,3,4,5].map(i => (
        <div key={i} className={styles.skeletonRow}>
          <div className={styles.skeletonDot} />
          <div className={styles.skeletonCard}>
            <div className={styles.skeletonAvatar} />
            <div className={styles.skeletonLines}>
              <div className={styles.skeletonLine} style={{ width: `${45 + i * 8}%` }} />
              <div className={styles.skeletonLine} style={{ width: `${30 + i * 5}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
