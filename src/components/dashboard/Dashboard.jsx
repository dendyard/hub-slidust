import { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import UserPerformance from '../board/UserPerformance';
import { ChevronDown, X, CheckCircle2 } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import styles from './Dashboard.module.css';

/* Dropdown component */
const FilterDropdown = ({ options, value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <div className={styles.filterDropdown}>
      <button className={`${styles.filterBtn} ${value ? styles.filterBtnActive : ''}`} onClick={() => setOpen(v => !v)}>
        <span>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <>
          <div className={styles.filterBackdrop} onClick={() => setOpen(false)} />
          <div className={styles.filterMenu}>
            <div
              className={`${styles.filterOption} ${!value ? styles.filterOptionActive : ''}`}
              onClick={() => { onChange(''); setOpen(false); }}
            >
              {placeholder}
            </div>
            {options.map(o => (
              <div
                key={o.value}
                className={`${styles.filterOption} ${value === o.value ? styles.filterOptionActive : ''}`}
                onClick={() => { onChange(o.value); setOpen(false); }}
              >
                {o.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const formatRelative = (dateStr) => {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return 'Baru saja';
  if (m < 60) return `${m} menit lalu`;
  if (h < 24) return `${h} jam lalu`;
  return `${d} hari lalu`;
};

const TASK_LIMIT = 100;

/* ── Date helpers ── */
const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const getThisWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  return { from: toDateStr(monday), to: toDateStr(now) };
};
const fmtDateLabel = (str) => {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const Dashboard = ({ onTaskClick }) => {
  const { tasks, projects, workflows, users, positions, currentUser, fetchAllTasks } = useData();

  useEffect(() => { fetchAllTasks(); }, [fetchAllTasks]);

  /* ── Scope to accessible projects only ── */
  const accessibleIds = useMemo(() => new Set(projects.map(p => p.id)), [projects]);
  const accessibleTasks     = useMemo(() => tasks.filter(t => accessibleIds.has(t.projectId)), [tasks, accessibleIds]);
  const accessibleWorkflows = useMemo(() => workflows.filter(w => accessibleIds.has(w.project_id)), [workflows, accessibleIds]);

  /* ── Filters ── */
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [filterProject,  setFilterProject]  = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');

  /* ── Done range (default: this week) ── */
  const [doneFrom, setDoneFrom] = useState(() => getThisWeekRange().from);
  const [doneTo,   setDoneTo]   = useState(() => getThisWeekRange().to);
  const isThisWeek = useMemo(() => {
    const r = getThisWeekRange();
    return doneFrom === r.from && doneTo === r.to;
  }, [doneFrom, doneTo]);

  /* ── Stage ID → workflow lookup ── */
  const stageMap = {};
  accessibleWorkflows.forEach(w => { stageMap[w.id] = w; });

  /* ── Filter options ── */
  const assigneeOptions = useMemo(() => {
    const base = (currentUser?.role === 'member' && currentUser?.position_id)
      ? users.filter(u => u.position_id === currentUser.position_id)
      : users;
    return base.map(u => ({ value: u.id, label: u.name }));
  }, [users, currentUser]);

  const positionOptions = useMemo(() => {
    const usedIds = new Set(users.map(u => u.position_id).filter(Boolean));
    return positions.filter(p => usedIds.has(p.id)).map(p => ({ value: p.id, label: p.name }));
  }, [positions, users]);

  const projectOptions = projects.map(p => ({ value: p.id, label: p.name }));
  const statusOptions = useMemo(() => {
    const seen = new Set();
    return accessibleWorkflows
      .filter(w => { const key = w.name.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
      .map(w => ({ value: w.name.toLowerCase(), label: w.name }));
  }, [accessibleWorkflows]);

  const hasFilter = filterAssignee || filterPosition || filterProject || filterStatus || !isThisWeek;

  /* ── Filtered tasks ── */
  const filteredTasks = useMemo(() => {
    let result = accessibleTasks;

    if (filterProject) {
      result = result.filter(t => t.projectId === filterProject);
    }

    if (filterAssignee) {
      result = result.filter(t =>
        t.assignee === filterAssignee ||
        (t.subtasks || []).some(s => s.assigneeId === filterAssignee)
      );
    }

    if (filterPosition) {
      const posUserIds = new Set(users.filter(u => u.position_id === filterPosition).map(u => u.id));
      result = result.filter(t =>
        posUserIds.has(t.assignee) ||
        (t.subtasks || []).some(s => posUserIds.has(s.assigneeId))
      );
    }

    return result;
  }, [accessibleTasks, filterAssignee, filterPosition, filterProject, users]);

  /* ── Task table: sorted by latest update, limited to TASK_LIMIT ── */
  const taskTableRows = useMemo(() => {
    let result = [...filteredTasks];
    if (filterStatus) result = result.filter(t => accessibleWorkflows.find(w => w.id === t.status)?.name.toLowerCase() === filterStatus);
    return result
      .sort((a, b) => {
        const aTime = new Date(a.latestCommentAt || a.created_at || 0).getTime();
        const bTime = new Date(b.latestCommentAt || b.created_at || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, TASK_LIMIT)
      .map(t => ({
        ...t,
        _project:  projects.find(p => p.id === t.projectId),
        _assignee: users.find(u => u.id === t.assignee),
        _stage:    accessibleWorkflows.find(w => w.id === t.status),
        _lastUpdated: t.latestCommentAt || t.created_at,
      }));
  }, [filteredTasks, filterStatus, projects, users, accessibleWorkflows]);


  const totalTasks = filteredTasks.length;
  const openTasks  = filteredTasks.filter(t => stageMap[t.status]?.type === 'BACKLOG').length;
  const inProgress = filteredTasks.filter(t => stageMap[t.status]?.type === 'PROGRESS').length;
  const doneTasks  = filteredTasks.filter(t => stageMap[t.status]?.type === 'DONE').length;


  /* ── Filtered users (for UserPerformance) ── */
  const filteredUsers = useMemo(() => {
    let base = users;
    if (currentUser?.role === 'member' && currentUser?.position_id) {
      base = base.filter(u => u.position_id === currentUser.position_id);
    }
    if (filterAssignee) base = base.filter(u => u.id === filterAssignee);
    if (filterPosition) base = base.filter(u => u.position_id === filterPosition);
    return base.filter(u =>
      filteredTasks.some(t => t.assignee === u.id) ||
      filteredTasks.some(t => (t.subtasks || []).some(s => s.assigneeId === u.id))
    );
  }, [users, filteredTasks, filterAssignee, filterPosition, currentUser]);

  /* ── Tasks Done (filtered by date range) ── */
  const doneThisWeek = useMemo(() => {
    const start = doneFrom ? new Date(doneFrom + 'T00:00:00') : null;
    const end   = doneTo   ? new Date(doneTo   + 'T23:59:59') : null;

    return filteredTasks
      .filter(t => {
        if (stageMap[t.status]?.type !== 'DONE') return false;
        if (!t.completedAt) return false;
        const d = new Date(t.completedAt);
        if (start && d < start) return false;
        if (end   && d > end)   return false;
        return true;
      })
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .map(t => ({
        ...t,
        _project:     projects.find(p => p.id === t.projectId),
        _assignee:    users.find(u => u.id === t.assignee),
        _stage:       accessibleWorkflows.find(w => w.id === t.status),
        _completedBy: users.find(u => u.id === t.completedBy),
      }));
  }, [filteredTasks, stageMap, projects, users, accessibleWorkflows, doneFrom, doneTo]);

  return (
    <div className={styles.dashboard}>

      {/* ── Open Task bar ── */}
      <div className={styles.headerCard}>
        <div className={styles.headerStats}>
          {[
            { label: 'Open Task',   value: openTasks  },
            { label: 'On Progress', value: inProgress },
            { label: 'Done',        value: doneTasks  },
            { label: 'Total Task',  value: totalTasks },
          ].map(s => (
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

      {/* ── Unified filter bar ── */}
      <div className={styles.unifiedFilterBar}>
        <span className={styles.filterBarLabel}>Filter</span>
        <span className={styles.filterDivider} />
        {/* Global filters */}
        <FilterDropdown
          placeholder="All Assignees"
          options={assigneeOptions}
          value={filterAssignee}
          onChange={setFilterAssignee}
        />
        {currentUser?.role !== 'member' && (
          <FilterDropdown
            placeholder="All Positions"
            options={positionOptions}
            value={filterPosition}
            onChange={setFilterPosition}
          />
        )}
        <FilterDropdown
          placeholder="All Projects"
          options={projectOptions}
          value={filterProject}
          onChange={setFilterProject}
        />

        <span className={styles.filterDivider} />

        {/* Status filter — for Latest Tasks */}
        <FilterDropdown
          placeholder="All Status"
          options={statusOptions}
          value={filterStatus}
          onChange={setFilterStatus}
        />

        <span className={styles.filterDivider} />

        {/* Done date range — for Tasks Done */}
        <span className={styles.filterGroupLabel}>Done:</span>
        <input
          type="date"
          className={styles.dateInput}
          value={doneFrom}
          max={doneTo || undefined}
          onChange={e => setDoneFrom(e.target.value)}
        />
        <span className={styles.dateRangeSep}>–</span>
        <input
          type="date"
          className={styles.dateInput}
          value={doneTo}
          min={doneFrom || undefined}
          onChange={e => setDoneTo(e.target.value)}
        />
        {!isThisWeek && (
          <button
            className={styles.thisWeekBtn}
            onClick={() => { const r = getThisWeekRange(); setDoneFrom(r.from); setDoneTo(r.to); }}
          >
            This Week
          </button>
        )}

        {hasFilter && (
          <>
            <span className={styles.filterDivider} />
            <button
              className={styles.clearFilter}
              onClick={() => {
                setFilterAssignee('');
                setFilterPosition('');
                setFilterProject('');
                setFilterStatus('');
                const r = getThisWeekRange();
                setDoneFrom(r.from);
                setDoneTo(r.to);
              }}
            >
              <X size={13} /> Clear All
            </button>
          </>
        )}
      </div>

      {/* ── 2-col: Tasks Done + Latest Tasks ── */}
      <div className={styles.twoColGrid}>

        {/* Tasks Done — columns: Task | Done by | Completed */}
        <div className={styles.section}>
          <div className={styles.doneTitleRow}>
            <CheckCircle2 size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
            <span className={styles.sectionTitle}>Tasks Done This Week</span>
            <span className={styles.doneBadge}>{doneThisWeek.length}</span>
            {(!isThisWeek && (doneFrom || doneTo)) && (
              <span className={styles.rangeLabel}>
                {fmtDateLabel(doneFrom)} – {fmtDateLabel(doneTo)}
              </span>
            )}
          </div>
          <div className={styles.taskTable}>
            <div className={styles.taskTableHeadSm}>
              <span className={styles.tcTitle}>Task</span>
              <span className={styles.tcDoneBy}>Done by</span>
              <span className={styles.tcUpdated}>Completed</span>
            </div>
            <div className={styles.taskTableBodySm}>
              {doneThisWeek.length === 0 ? (
                <p className={styles.taskTableEmpty}>Belum ada task yang selesai dalam periode ini.</p>
              ) : (
                doneThisWeek.map((t) => (
                  <div
                    key={t.id}
                    className={`${styles.taskTableRowSm} ${onTaskClick ? styles.taskTableRowClickable : ''}`}
                    onClick={() => onTaskClick && onTaskClick(t.id)}
                  >
                    <span className={styles.tcTitle}>{t.title}</span>
                    <span className={styles.tcDoneBy}>
                      {t._completedBy
                        ? (
                          <span className={styles.doneByWrap}>
                            <UserAvatar user={t._completedBy} size={22} />
                            <span className={styles.doneByName}>{t._completedBy.name}</span>
                          </span>
                        )
                        : <span className={styles.unassigned}>—</span>
                      }
                    </span>
                    <span className={styles.tcUpdated}>{formatRelative(t.completedAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Latest Tasks — columns: Task | Assignee | Status */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Latest Tasks</h3>
          <div className={styles.taskTable}>
            <div className={styles.taskTableHeadSm}>
              <span className={styles.tcTitle}>Task</span>
              <span className={styles.tcAssignee}>By</span>
              <span className={styles.tcStatus}>Status</span>
            </div>
            <div className={styles.taskTableBodySm}>
              {taskTableRows.length === 0 ? (
                <p className={styles.taskTableEmpty}>Belum ada task.</p>
              ) : (
                taskTableRows.map((t) => {
                  const stageColor = t._stage?.type === 'DONE' ? '#22c55e'
                    : t._stage?.type === 'PROGRESS' ? '#6366f1'
                    : '#94a3b8';
                  return (
                    <div
                      key={t.id}
                      className={`${styles.taskTableRowSm} ${onTaskClick ? styles.taskTableRowClickable : ''}`}
                      onClick={() => onTaskClick && onTaskClick(t.id)}
                    >
                      <span className={styles.tcTitle}>{t.title}</span>
                      <span className={styles.tcAssignee}>
                        {t._assignee
                          ? <UserAvatar user={t._assignee} size={24} title={t._assignee.name} />
                          : <span className={styles.unassigned}>—</span>
                        }
                      </span>
                      <span className={styles.tcStatus}>
                        <span className={styles.statusDot} style={{ background: stageColor }} />
                        <span style={{ color: stageColor, fontWeight: 600 }}>
                          {t._stage?.name || 'Backlog'}
                        </span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── User Performance ── */}
      <UserPerformance
        tasks={filteredTasks}
        users={filteredUsers}
        workflows={accessibleWorkflows}
        onTaskClick={onTaskClick}
      />

    </div>
  );
};

export default Dashboard;
