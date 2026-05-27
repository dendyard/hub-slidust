import { useEffect, useState } from 'react';
import { X, Plus, ArrowRightLeft, UserCheck, CheckSquare, MessageSquare, Paperclip, Clock } from 'lucide-react';
import { API_BASE, authFetch } from '../../context/DataContext';
import UserAvatar from '../ui/UserAvatar';
import styles from './TaskHistoryModal.module.css';

const EVENT_CONFIG = {
  created:          { label: 'Task Created',        icon: Plus,            color: '#22c55e', bg: '#dcfce7' },
  status:           { label: 'Status Changed',       icon: ArrowRightLeft,  color: '#3b82f6', bg: '#dbeafe' },
  assigned:         { label: 'Assignee Changed',     icon: UserCheck,       color: '#a855f7', bg: '#f3e8ff' },
  subtask_status:   { label: 'Subtask Status',       icon: CheckSquare,     color: '#f59e0b', bg: '#fef3c7' },
  subtask_assigned: { label: 'Subtask Assigned',     icon: UserCheck,       color: '#ec4899', bg: '#fce7f3' },
  comment:          { label: 'Comment Added',        icon: MessageSquare,   color: '#06b6d4', bg: '#cffafe' },
  attachment:       { label: 'Attachment',           icon: Paperclip,       color: '#64748b', bg: '#f1f5f9' },
};

function getConfig(type) {
  return EVENT_CONFIG[type] || { label: type, icon: Clock, color: '#64748b', bg: '#f1f5f9' };
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDateGroup(ts) {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dDay.getTime() === today.getTime()) return 'Today';
  if (dDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByDate(items) {
  const groups = {};
  items.forEach(item => {
    const key = formatDateGroup(item.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}

function EventDescription({ item }) {
  const { change_type, old_value, new_value, subtask_title, changed_by_name } = item;

  if (change_type === 'created') {
    return <span>Task dibuat oleh <strong>{changed_by_name || 'System'}</strong></span>;
  }
  if (change_type === 'status') {
    return (
      <span>
        Status berubah dari{' '}
        <span className={styles.pill} style={{ background: '#fef3c7', color: '#92400e' }}>{old_value || '—'}</span>
        {' '}ke{' '}
        <span className={styles.pill} style={{ background: '#dbeafe', color: '#1e40af' }}>{new_value || '—'}</span>
      </span>
    );
  }
  if (change_type === 'assigned') {
    return (
      <span>
        Assignee berubah dari <strong>{old_value || 'Unassigned'}</strong> ke <strong>{new_value || 'Unassigned'}</strong>
      </span>
    );
  }
  if (change_type === 'subtask_status') {
    return (
      <span>
        Subtask <strong>"{subtask_title}"</strong> berubah dari{' '}
        <span className={styles.pill} style={{ background: '#fef3c7', color: '#92400e' }}>{old_value || '—'}</span>
        {' '}ke{' '}
        <span className={styles.pill} style={{ background: '#dcfce7', color: '#166534' }}>{new_value || '—'}</span>
      </span>
    );
  }
  if (change_type === 'subtask_assigned') {
    return (
      <span>
        Subtask <strong>"{subtask_title}"</strong> di-assign ke <strong>{new_value || 'Unassigned'}</strong>
      </span>
    );
  }
  if (change_type === 'comment') {
    return (
      <span>
        <strong>{changed_by_name}</strong> menambahkan komentar
        {new_value && <span className={styles.commentSnippet}>"{new_value}"</span>}
      </span>
    );
  }
  return <span>{old_value}{old_value && new_value ? ' → ' : ''}{new_value}</span>;
}

export default function TaskHistoryModal({ taskId, taskTitle, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    authFetch(`${API_BASE}/task_history?task_id=${taskId}`)
      .then(r => r.json())
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  const grouped = groupByDate(history);
  const dateKeys = Object.keys(grouped);

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <Clock size={16} />
            </div>
            <div>
              <div className={styles.headerTitle}>Task History</div>
              <div className={styles.headerSub}>{taskTitle}</div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Stats bar */}
        {!loading && history.length > 0 && (
          <div className={styles.statsBar}>
            {Object.entries(EVENT_CONFIG).map(([type, cfg]) => {
              const count = history.filter(h => h.change_type === type).length;
              if (!count) return null;
              const Icon = cfg.icon;
              return (
                <div key={type} className={styles.statChip} style={{ background: cfg.bg, color: cfg.color }}>
                  <Icon size={12} />
                  <span>{count}</span>
                </div>
              );
            })}
            <div className={styles.statTotal}>{history.length} events</div>
          </div>
        )}

        {/* Timeline */}
        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingWrap}>
              {[1,2,3,4].map(i => (
                <div key={i} className={styles.skeleton}>
                  <div className={styles.skeletonAvatar} />
                  <div className={styles.skeletonLines}>
                    <div className={styles.skeletonLine} style={{ width: '60%' }} />
                    <div className={styles.skeletonLine} style={{ width: '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className={styles.empty}>
              <Clock size={40} strokeWidth={1.2} />
              <p>Belum ada history untuk task ini</p>
            </div>
          ) : (
            <div className={styles.timeline}>
              {dateKeys.map((dateKey, di) => (
                <div key={dateKey} className={styles.dateGroup}>
                  <div className={styles.dateDivider}>
                    <span className={styles.datePill}>{dateKey}</span>
                  </div>

                  {grouped[dateKey].map((item, idx) => {
                    const cfg = getConfig(item.change_type);
                    const Icon = cfg.icon;
                    const isLast = di === dateKeys.length - 1 && idx === grouped[dateKey].length - 1;

                    return (
                      <div key={item.id} className={`${styles.event} ${isLast ? styles.eventLast : ''}`}>
                        {/* Timeline line + dot */}
                        <div className={styles.timelineSide}>
                          <div className={styles.dot} style={{ background: cfg.color, boxShadow: `0 0 0 3px ${cfg.bg}` }}>
                            <Icon size={10} color="#fff" strokeWidth={2.5} />
                          </div>
                          {!isLast && <div className={styles.line} />}
                        </div>

                        {/* Card */}
                        <div className={styles.card}>
                          <div className={styles.cardTop}>
                            {/* Avatar */}
                            <div className={styles.avatarWrap}>
                              <UserAvatar
                                name={item.changed_by_name || 'System'}
                                avatar={item.changed_by_avatar}
                                size={28}
                              />
                            </div>
                            {/* Content */}
                            <div className={styles.cardContent}>
                              <div className={styles.eventLabel} style={{ color: cfg.color }}>
                                <Icon size={11} strokeWidth={2.5} />
                                {cfg.label}
                              </div>
                              <div className={styles.eventDesc}>
                                <EventDescription item={item} />
                              </div>
                            </div>
                            {/* Time */}
                            <div className={styles.timeTag}>{formatTime(item.created_at)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
