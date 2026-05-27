import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useData } from '../../context/DataContext';
import UserAvatar from '../ui/UserAvatar';
import styles from './BoardRoadmap.module.css';

const QUARTERS = [
  { key: 'Q1', label: 'Q1', months: 'Jan – Mar', range: [0, 2] },
  { key: 'Q2', label: 'Q2', months: 'Apr – Jun', range: [3, 5] },
  { key: 'Q3', label: 'Q3', months: 'Jul – Sep', range: [6, 8] },
  { key: 'Q4', label: 'Q4', months: 'Oct – Dec', range: [9, 11] },
];

const PRIORITY_COLOR = {
  High:   '#ef4444',
  Medium: '#f59e0b',
  Low:    '#22c55e',
};

const BoardRoadmap = ({ assigneeFilter, onTaskClick }) => {
  const { tasks, activeProjectId, getProjectWorkflow, users } = useData();
  const [year, setYear] = useState(new Date().getFullYear());

  const stages = getProjectWorkflow(activeProjectId);
  const stageMap = useMemo(() => {
    const m = {};
    stages.forEach(s => { m[s.id] = s; });
    return m;
  }, [stages]);

  const projectTasks = useMemo(() =>
    tasks
      .filter(t => t.projectId === activeProjectId)
      .filter(t => !assigneeFilter || t.assignee === assigneeFilter),
  [tasks, activeProjectId, assigneeFilter]);

  // Group tasks by quarter based on due_date; tasks without due_date go to "No Date"
  const tasksByQuarter = useMemo(() => {
    const map = { Q1: [], Q2: [], Q3: [], Q4: [], none: [] };
    projectTasks.forEach(t => {
      if (!t.due_date) {
        map.none.push(t);
        return;
      }
      const d = new Date(t.due_date);
      if (d.getFullYear() !== year) return;
      const month = d.getMonth();
      const q = QUARTERS.find(q => month >= q.range[0] && month <= q.range[1]);
      if (q) map[q.key].push(t);
    });
    return map;
  }, [projectTasks, year]);

  const totalInYear = QUARTERS.reduce((s, q) => s + tasksByQuarter[q.key].length, 0);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.nav}>
          <button className={styles.navBtn} onClick={() => setYear(y => y - 1)}><ChevronLeft size={16} /></button>
          <span className={styles.yearLabel}>{year}</span>
          <button className={styles.navBtn} onClick={() => setYear(y => y + 1)}><ChevronRight size={16} /></button>
        </div>
        <span className={styles.totalBadge}>{totalInYear} task in {year}</span>
      </div>

      {/* Quarter columns */}
      <div className={styles.columns}>
        {QUARTERS.map(q => {
          const qTasks = tasksByQuarter[q.key];
          const isCurrentQ = (() => {
            const now = new Date();
            const m = now.getMonth();
            return now.getFullYear() === year && m >= q.range[0] && m <= q.range[1];
          })();

          return (
            <div key={q.key} className={`${styles.column} ${isCurrentQ ? styles.columnCurrent : ''}`}>
              <div className={styles.colHeader}>
                <div className={styles.colTitleWrap}>
                  <span className={styles.colQ}>{q.label}</span>
                  <span className={styles.colMonths}>{q.months}</span>
                  {isCurrentQ && <span className={styles.nowBadge}>Now</span>}
                </div>
                <span className={styles.colCount}>{qTasks.length}</span>
              </div>

              <div className={styles.taskList}>
                {qTasks.length === 0 && (
                  <div className={styles.empty}>No tasks</div>
                )}
                {qTasks.map(t => {
                  const stage   = stageMap[t.status];
                  const assignee = users.find(u => u.id === t.assignee);
                  const due = t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;

                  return (
                    <button
                      key={t.id}
                      className={styles.taskCard}
                      onClick={() => onTaskClick(t.id)}
                    >
                      <div className={styles.taskTop}>
                        <span className={styles.taskTitle}>{t.title}</span>
                        {assignee && <UserAvatar user={assignee} size={20} style={{ flexShrink: 0 }} />}
                      </div>
                      <div className={styles.taskMeta}>
                        {stage && (
                          <span className={styles.stageBadge} style={{ background: stage.color + '22', color: stage.color }}>
                            {stage.name}
                          </span>
                        )}
                        <span
                          className={styles.priorityBadge}
                          style={{ background: (PRIORITY_COLOR[t.priority] || '#94a3b8') + '22', color: PRIORITY_COLOR[t.priority] || '#94a3b8' }}
                        >
                          {t.priority || 'No priority'}
                        </span>
                        {due && <span className={styles.dueBadge}>Due {due}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* No due date section */}
      {tasksByQuarter.none.length > 0 && (
        <div className={styles.noDueSection}>
          <div className={styles.noDueHeader}>
            <span className={styles.noDueTitle}>No due date</span>
            <span className={styles.colCount}>{tasksByQuarter.none.length}</span>
          </div>
          <div className={styles.noDueList}>
            {tasksByQuarter.none.map(t => {
              const stage    = stageMap[t.status];
              const assignee = users.find(u => u.id === t.assignee);
              return (
                <button
                  key={t.id}
                  className={styles.taskCard}
                  onClick={() => onTaskClick(t.id)}
                >
                  <div className={styles.taskTop}>
                    <span className={styles.taskTitle}>{t.title}</span>
                    {assignee && <UserAvatar user={assignee} size={20} style={{ flexShrink: 0 }} />}
                  </div>
                  <div className={styles.taskMeta}>
                    {stage && (
                      <span className={styles.stageBadge} style={{ background: stage.color + '22', color: stage.color }}>
                        {stage.name}
                      </span>
                    )}
                    <span
                      className={styles.priorityBadge}
                      style={{ background: (PRIORITY_COLOR[t.priority] || '#94a3b8') + '22', color: PRIORITY_COLOR[t.priority] || '#94a3b8' }}
                    >
                      {t.priority || 'No priority'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BoardRoadmap;
