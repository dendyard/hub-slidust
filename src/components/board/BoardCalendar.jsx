import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useData } from '../../context/DataContext';
import styles from './BoardCalendar.module.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const PRIORITY_COLOR = {
  High:   '#ef4444',
  Medium: '#f59e0b',
  Low:    '#22c55e',
};

const BoardCalendar = ({ assigneeFilter, onTaskClick }) => {
  const { tasks, activeProjectId, getProjectWorkflow } = useData();
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based

  const stages = getProjectWorkflow(activeProjectId);
  const stageMap = useMemo(() => {
    const m = {};
    stages.forEach(s => { m[s.id] = s; });
    return m;
  }, [stages]);

  const projectTasks = useMemo(() =>
    tasks
      .filter(t => t.projectId === activeProjectId && t.due_date)
      .filter(t => !assigneeFilter || t.assignee === assigneeFilter),
  [tasks, activeProjectId, assigneeFilter]);

  // Map "YYYY-MM-DD" → tasks[]
  const tasksByDate = useMemo(() => {
    const map = {};
    projectTasks.forEach(t => {
      const key = t.due_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [projectTasks]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  // Build grid: days from previous month padding + current month days
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  const cells = [];
  // Padding from prev month
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, currentMonth: false, date: null });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push({ day: d, currentMonth: true, date: `${year}-${mm}-${dd}` });
  }
  // Padding next month
  const remainder = cells.length % 7;
  if (remainder > 0) {
    for (let d = 1; d <= 7 - remainder; d++) {
      cells.push({ day: d, currentMonth: false, date: null });
    }
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.calHeader}>
        <div className={styles.calNav}>
          <button className={styles.navBtn} onClick={prevMonth}><ChevronLeft size={16} /></button>
          <span className={styles.calTitle}>{MONTHS[month]} {year}</span>
          <button className={styles.navBtn} onClick={nextMonth}><ChevronRight size={16} /></button>
        </div>
        <button className={styles.todayBtn} onClick={goToday}>Today</button>
      </div>

      {/* Scrollable wrapper for mobile */}
      <div className={styles.calBody}>

      {/* Day labels */}
      <div className={styles.dayLabels}>
        {DAYS.map(d => <div key={d} className={styles.dayLabel}>{d}</div>)}
      </div>

      {/* Grid */}
      <div className={styles.grid}>
        {cells.map((cell, i) => {
          const cellTasks = cell.date ? (tasksByDate[cell.date] || []) : [];
          const isToday   = cell.date === todayStr;
          return (
            <div
              key={i}
              className={`${styles.cell} ${!cell.currentMonth ? styles.cellOtherMonth : ''} ${isToday ? styles.cellToday : ''}`}
            >
              <span className={`${styles.dayNum} ${isToday ? styles.dayNumToday : ''}`}>{cell.day}</span>
              <div className={styles.taskList}>
                {cellTasks.map(t => {
                  const stage = stageMap[t.status];
                  const dotColor = stage?.color || '#94a3b8';
                  return (
                    <button
                      key={t.id}
                      className={styles.taskChip}
                      style={{ borderLeft: `3px solid ${dotColor}` }}
                      onClick={() => onTaskClick(t.id)}
                      title={t.title}
                    >
                      <span className={styles.taskChipPriority} style={{ background: PRIORITY_COLOR[t.priority] || '#94a3b8' }} />
                      <span className={styles.taskChipTitle}>{t.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      </div> {/* end calBody */}
    </div>
  );
};

export default BoardCalendar;
