import { useMemo, useRef, useState } from 'react';
import { X, Plus, MessageSquare, CheckSquare, Clock, User, Play, Flag, CalendarClock, Download, ImageDown } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import styles from './TaskHistoryModal.module.css';

/* ── Event type config ── */
const TYPE = {
  created:   { label: 'Task Created',  icon: Plus,          color: '#22c55e', bg: '#dcfce7' },
  started:   { label: 'Started',       icon: Play,          color: '#3b82f6', bg: '#dbeafe' },
  due:       { label: 'Due Date',      icon: CalendarClock, color: '#f97316', bg: '#ffedd5' },
  done:      { label: 'Completed',     icon: Flag,          color: '#8b5cf6', bg: '#ede9fe' },
  subtask:   { label: 'Subtask',       icon: CheckSquare,   color: '#f59e0b', bg: '#fef3c7' },
  comment:   { label: 'Comment',       icon: MessageSquare, color: '#06b6d4', bg: '#cffafe' },
  assigned:  { label: 'Assigned To',   icon: User,          color: '#a855f7', bg: '#f3e8ff' },
};

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Build timeline items from raw data ── */
function buildTimeline(task, comments, users) {
  if (!task) return [];
  const findUser = id => users?.find(u => String(u.id) === String(id));
  const items = [];

  /* 1. Task Created */
  const creator = findUser(task.created_by);
  items.push({
    id:        'created',
    type:      'created',
    ts:        new Date(task.created_at).getTime(),
    date:      task.created_at,
    title:     'Task dibuat',
    desc:      task.title,
    userName:  creator?.name  || 'Unknown',
    userAvatar: creator?.avatar || null,
  });

  /* 2. Assigned (if assigned_to exists) */
  if (task.assigned_to) {
    const assignee = findUser(task.assigned_to);
    items.push({
      id:        'assigned',
      type:      'assigned',
      ts:        new Date(task.created_at).getTime() + 1000,
      date:      task.created_at,
      title:     'Di-assign ke',
      desc:      assignee?.name || 'Unknown',
      userName:  creator?.name  || 'Unknown',
      userAvatar: creator?.avatar || null,
    });
  }

  /* 3. Started */
  if (task.startedAt) {
    const startedBy = findUser(task.started_by);
    items.push({
      id:        'started',
      type:      'started',
      ts:        new Date(task.startedAt).getTime(),
      date:      task.startedAt,
      title:     'Task dimulai',
      desc:      null,
      userName:  startedBy?.name   || creator?.name  || 'Unknown',
      userAvatar: startedBy?.avatar || creator?.avatar || null,
    });
  }

  /* 4. Due Date */
  if (task.due_date) {
    items.push({
      id:        'due',
      type:      'due',
      ts:        new Date(task.due_date).getTime(),
      date:      task.due_date,
      title:     'Deadline',
      desc:      new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      userName:  creator?.name  || 'Unknown',
      userAvatar: creator?.avatar || null,
    });
  }

  /* 5. Completed */
  if (task.completedAt) {
    const completedBy = findUser(task.completed_by);
    items.push({
      id:        'done',
      type:      'done',
      ts:        new Date(task.completedAt).getTime(),
      date:      task.completedAt,
      title:     'Task selesai',
      desc:      null,
      userName:  completedBy?.name   || creator?.name  || 'Unknown',
      userAvatar: completedBy?.avatar || creator?.avatar || null,
    });
  }

  /* 7. Subtasks */
  (task.subtasks || []).forEach((s, i) => {
    const statusLabel = s.isDone === 1 ? 'Done' : s.isDone === 2 ? 'On Progress' : 'Backlog';
    const statusColor = s.isDone === 1 ? '#22c55e' : s.isDone === 2 ? '#3b82f6' : '#94a3b8';
    items.push({
      id:        'sub_' + (s.id || i),
      type:      'subtask',
      ts:        new Date(task.created_at).getTime() + 2000 + i * 100,
      date:      task.created_at,
      title:     s.title,
      desc:      statusLabel,
      descColor: statusColor,
      userName:  creator?.name  || 'Unknown',
      userAvatar: creator?.avatar || null,
    });
  });

  /* 8. Comments */
  (comments || []).forEach(c => {
    if (c.parent_id) return; // skip replies
    const plain = (c.message || '').replace(/<[^>]*>/g, '').trim();
    items.push({
      id:        'comment_' + c.id,
      type:      'comment',
      ts:        new Date(c.created_at).getTime(),
      date:      c.created_at,
      title:     plain.slice(0, 80) + (plain.length > 80 ? '…' : ''),
      desc:      null,
      userName:  c.user_name   || 'User',
      userAvatar: c.user_avatar || null,
    });
  });

  return items.sort((a, b) => a.ts - b.ts);
}

/* ── Duration Badge ── */
function DurationBadge({ task }) {
  if (!task?.startedAt) return null;

  const start     = new Date(task.startedAt);
  const end       = task.completedAt ? new Date(task.completedAt) : new Date();
  const diffMs    = end - start;
  const diffDays  = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const isDone    = Boolean(task.completedAt);

  let label = '';
  if (diffDays > 0) {
    label = `${diffDays} hari${diffHours > 0 ? ` ${diffHours} jam` : ''}`;
  } else if (diffHours > 0) {
    label = `${diffHours} jam`;
  } else {
    const diffMin = Math.floor(diffMs / (1000 * 60));
    label = `${diffMin} menit`;
  }

  return (
    <div className={styles.durationBadge}>
      <span className={styles.durationDot} style={{ background: isDone ? '#8b5cf6' : '#3b82f6' }} />
      <span className={styles.durationText}>
        {isDone ? 'Selesai dalam' : 'Berjalan'}{' '}
        <strong>{label}</strong>
        {!isDone && <span className={styles.durationOngoing}> · sedang berjalan</span>}
      </span>
    </div>
  );
}

/* ── Export helper ── */
async function exportTimeline(el, format, filename) {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    width: el.scrollWidth,
    height: el.scrollHeight,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const url = canvas.toDataURL(mimeType, 0.95);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${format}`;
  a.click();
}

/* ── Main ── */
export default function TaskHistoryModal({ task, comments, users, onClose }) {
  const items       = useMemo(() => buildTimeline(task, comments, users), [task, comments, users]);
  const exportRef   = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [showFmt,   setShowFmt]   = useState(false);

  const handleExport = async (format) => {
    if (!exportRef.current) return;
    setShowFmt(false);
    setExporting(true);
    try {
      const slug = (task?.title || 'timeline').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      await exportTimeline(exportRef.current, format, `timeline_${slug}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}><Clock size={15} /></div>
            <div>
              <div className={styles.headerTitle}>Task Timeline</div>
              <div className={styles.headerSub} title={task?.title}>{task?.title}</div>
            </div>
          </div>
          <div className={styles.headerActions}>
            {/* Export button */}
            <div className={styles.exportWrap}>
              <button
                className={styles.exportBtn}
                onClick={() => setShowFmt(v => !v)}
                disabled={exporting || items.length === 0}
                title="Export timeline"
              >
                {exporting
                  ? <span className={styles.exportSpinner} />
                  : <><ImageDown size={14} /><span>Export</span></>
                }
              </button>
              {showFmt && (
                <div className={styles.fmtDropdown}>
                  <button onClick={() => handleExport('png')}>
                    <Download size={13} /> Export as PNG
                  </button>
                  <button onClick={() => handleExport('jpg')}>
                    <Download size={13} /> Export as JPG
                  </button>
                </div>
              )}
            </div>
            <button className={styles.closeBtn} onClick={onClose}><X size={17} /></button>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsBar}>
          {Object.entries(TYPE).map(([type, c]) => {
            const count = items.filter(i => i.type === type).length;
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

        {/* Timeline */}
        <div className={styles.body}>
          {items.length === 0 ? (
            <div className={styles.empty}>
              <Clock size={38} strokeWidth={1.2} />
              <p>Belum ada data timeline</p>
            </div>
          ) : (
            <div className={styles.timeline} ref={exportRef}>
              {/* Title for export */}
              <div className={styles.exportTitle}>{task?.title}</div>
              <div className={styles.exportSub}>Task Timeline · {items.length} events</div>
              <DurationBadge task={task} />

              {/* Continuous vertical line */}
              <div className={styles.verticalLine} />

              {items.map((item, idx) => {
                const c    = TYPE[item.type] || TYPE.created;
                const Icon = c.icon;
                const isRight = idx % 2 === 0;

                return (
                  <div key={item.id} className={`${styles.row} ${isRight ? styles.rowRight : styles.rowLeft}`}>

                    {/* Left side */}
                    <div className={styles.side}>
                      {!isRight && (
                        <Card item={item} c={c} Icon={Icon} />
                      )}
                    </div>

                    {/* Center dot + date */}
                    <div className={styles.center}>
                      <div className={styles.dateCircle} style={{ borderColor: c.color }}>
                        <div className={styles.dateCircleInner} style={{ color: c.color }}>
                          <span className={styles.dateDay}>
                            {new Date(item.date).getDate()}
                          </span>
                          <span className={styles.dateMon}>
                            {new Date(item.date).toLocaleDateString('id-ID', { month: 'short' })}
                          </span>
                        </div>
                        <div className={styles.dotCenter} style={{ background: c.color }} />
                      </div>
                    </div>

                    {/* Right side */}
                    <div className={styles.side}>
                      {isRight && (
                        <Card item={item} c={c} Icon={Icon} />
                      )}
                    </div>

                  </div>
                );
              })}

              {/* End cap */}
              <div className={styles.endCap}>
                <div className={styles.endDot} />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ── Event Card ── */
function Card({ item, c, Icon }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardLabel} style={{ color: c.color }}>
        <Icon size={10} strokeWidth={2.8} />
        {TYPE[item.type]?.label}
      </div>
      <div className={styles.cardTitle}>{item.title}</div>
      {item.desc && (
        <div
          className={styles.cardDesc}
          style={item.descColor ? { color: item.descColor, fontWeight: 600 } : {}}
        >
          {item.desc}
        </div>
      )}
      <div className={styles.cardFooter}>
        <UserAvatar
          user={{ name: item.userName, avatar: item.userAvatar }}
          size={18}
        />
        <span className={styles.cardUser}>{item.userName}</span>
        <span className={styles.cardTime}>{fmtTime(item.date)}</span>
      </div>
    </div>
  );
}
