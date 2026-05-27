import { useMemo } from 'react';
import UserAvatar from '../ui/UserAvatar';
import { Clock } from 'lucide-react';
import styles from './UserPerformance.module.css';

const STATUS_TYPES = [
  { key: 'BACKLOG',  label: 'Backlog',  color: '#94a3b8' },
  { key: 'PROGRESS', label: 'Progress', color: '#3b82f6' },
  { key: 'DONE',     label: 'Done',     color: '#22c55e' },
];


/**
 * Props:
 *   tasks     – array of task objects
 *   users     – array of user objects to evaluate
 *   workflows – global workflows array (for stage type & name lookup)
 *   stats     – [{ label, value }] shown alongside active contributors in header
 *   onTaskClick(taskId)
 */
const UserPerformance = ({ tasks = [], users = [], workflows = [], stats = [], onTaskClick }) => {
  const stageTypeMap = useMemo(() => {
    const map = {};
    workflows.forEach(w => { map[w.id] = w.type || 'BACKLOG'; });
    return map;
  }, [workflows]);

  const stageNameMap = useMemo(() => {
    const map = {};
    workflows.forEach(w => { map[w.id] = w.name; });
    return map;
  }, [workflows]);

  const userData = useMemo(() => {
    return users.map(u => {
      const assignedTasks = tasks.filter(t => t.assignee === u.id);
      const assignedSubtasks = tasks.flatMap(t =>
        (t.subtasks || []).filter(s => s.assigneeId === u.id)
      );

      const subtaskDone     = assignedSubtasks.filter(s => s.isDone === 1).length;
      const subtaskProgress = assignedSubtasks.filter(s => s.isDone === 2).length;
      const subtaskBacklog  = assignedSubtasks.filter(s => s.isDone === 0).length;

      const tasksByType = {};
      STATUS_TYPES.forEach(st => {
        let count = assignedTasks.filter(t => stageTypeMap[t.status] === st.key).length;
        if (st.key === 'DONE')     count += subtaskDone;
        if (st.key === 'PROGRESS') count += subtaskProgress;
        if (st.key === 'BACKLOG')  count += subtaskBacklog;
        tasksByType[st.key] = count;
      });

      const doneTasks     = assignedTasks.filter(t => stageTypeMap[t.status] === 'DONE').length;
      const totalTasks    = assignedTasks.length;
      const totalSubtasks = assignedSubtasks.length;
      const totalItems    = totalTasks + totalSubtasks;
      const doneItems     = doneTasks + subtaskDone;
      const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

      const subtaskParentIds = new Set(
        tasks.filter(t => (t.subtasks || []).some(s => s.assigneeId === u.id)).map(t => t.id)
      );
      const relatedTasks = tasks.filter(
        t => t.assignee === u.id || subtaskParentIds.has(t.id)
      );

      const latestTasks = [...relatedTasks]
        .sort((a, b) => {
          const aTime = a.latestCommentAt || a.updated_at || a.created_at || '';
          const bTime = b.latestCommentAt || b.updated_at || b.created_at || '';
          return bTime.localeCompare(aTime);
        })
        .slice(0, 5);

      return { user: u, tasksByType, totalTasks, totalSubtasks, totalItems, doneItems, pct, latestTasks };
    }).filter(d => d.totalItems > 0);
  }, [tasks, users, stageTypeMap]);

  const sorted = useMemo(() =>
    [...userData].sort((a, b) => b.totalItems - a.totalItems),
  [userData]);

  const ringColor = (pct) =>
    pct >= 75 ? '#22c55e' : pct >= 40 ? '#3b82f6' : '#f59e0b';

  const RING_R = 23;
  const RING_C = 2 * Math.PI * RING_R;

  return (
    <div className={styles.wrap}>

      {/* Header stat card */}
      {stats.length > 0 && (
        <div className={styles.headerCard}>
          <div className={styles.headerStats}>
            {stats.map(s => (
              <div key={s.label} className={styles.headerContrib}>
                <span className={styles.bigNum}>{s.value}</span>
                <div className={styles.headerRight}>
                  {s.label.split(' ').map(word => (
                    <span key={word} className={styles.headerLine}>{word}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Horizontal scrollable user cards */}
      <div className={styles.userList}>
        {sorted.length === 0 && (
          <div className={styles.empty}>Belum ada data performa user.</div>
        )}
        {sorted.map(({ user, pct, totalTasks, totalSubtasks, totalItems, tasksByType, latestTasks }) => (
          <div key={user.id} className={styles.userCard}>

            <div className={styles.cardTop}>
              <div className={styles.avatarWrap}>
                <UserAvatar user={user} size={44} />
                <svg className={styles.ring} width="52" height="52" viewBox="0 0 52 52">
                  <circle cx="26" cy="26" r={RING_R} fill="none" stroke="var(--border-color)" strokeWidth="3" />
                  {totalItems > 0 && (
                    <circle
                      cx="26" cy="26" r={RING_R}
                      fill="none"
                      stroke={ringColor(pct)}
                      strokeWidth="3"
                      strokeDasharray={RING_C}
                      strokeDashoffset={RING_C * (1 - pct / 100)}
                      strokeLinecap="round"
                      transform="rotate(-90 26 26)"
                    />
                  )}
                </svg>
              </div>

              <div className={styles.userInfo}>
                <span className={styles.userPct}>{pct}% tasks done</span>
                <span className={styles.userName}>{user.name}</span>
                <span className={styles.userMeta}>{totalTasks} tasks · {totalSubtasks} subtasks</span>
              </div>

              <div className={styles.badges}>
                {STATUS_TYPES.map(st => (
                  <span
                    key={st.key}
                    className={styles.badge}
                    style={{ background: st.color + '1a', color: st.color, border: `1px solid ${st.color}33` }}
                  >
                    {st.label} {tasksByType[st.key]}
                  </span>
                ))}
              </div>
            </div>

            {latestTasks.length > 0 && (
              <div className={styles.latestWrap}>
                <div className={styles.latestHeader}>
                  <Clock size={11} />
                  <span>5 latest updates</span>
                </div>
                {latestTasks.map(t => {
                  const type      = stageTypeMap[t.status] || 'BACKLOG';
                  const st        = STATUS_TYPES.find(s => s.key === type);
                  const stageName = stageNameMap[t.status] || t.status;
                  return (
                    <div
                      key={t.id}
                      className={styles.taskRow}
                      onClick={() => onTaskClick?.(t.id)}
                    >
                      <span className={styles.taskDot} style={{ background: st?.color }} />
                      <span className={styles.taskTitle}>{t.title}</span>
                      <span className={styles.taskStage} style={{ color: st?.color }}>{stageName}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserPerformance;
