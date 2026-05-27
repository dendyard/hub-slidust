import { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { CheckSquare, Square, Paperclip, MessageSquare, Calendar, ArrowUpDown, Clock, ChevronDown, Check, CheckCircle2 } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import styles from './MyBoard.module.css';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, '': 3 };

const priorityMeta = {
  high:   { bg: '#FF70BF' },
  medium: { bg: '#9AD872' },
  low:    { bg: '#FFEF91' },
};

const STATUS_FILTERS = [
  { key: 'PROGRESS', label: 'On Progress', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', colorMuted: '#60a5fa' },
  { key: 'BACKLOG',  label: 'Backlog',     color: '#b45309', bg: '#fffbeb', border: '#fcd34d', colorMuted: '#f59e0b' },
  { key: 'DONE',     label: 'Done',        color: '#15803d', bg: '#f0fdf4', border: '#86efac', colorMuted: '#22c55e' },
  { key: 'ALL',      label: 'All',         color: '#6d28d9', bg: '#f5f3ff', border: '#c4b5fd', colorMuted: '#8b5cf6' },
];


const MyBoard = ({ onTaskClick }) => {
  const { tasks, users, currentUser, projects, workflows, fetchAllTasks } = useData();

  useEffect(() => { fetchAllTasks(); }, [fetchAllTasks]);

  const LS_KEY = `myboard_filter_${currentUser.id}`;

  const [sortBy, setSortBy] = useState('priority');
  const [statusFilter, setStatusFilter] = useState('PROGRESS');
  const [assigneeFilter, setAssigneeFilter] = useState(() => {
    try {
      const saved = localStorage.getItem(`myboard_filter_${currentUser.id}`);
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set([currentUser.id]);
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const filterRef = useRef(null);

  // Persist filter to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify([...assigneeFilter]));
    } catch {}
  }, [assigneeFilter, LS_KEY]);

  // Close popup on outside click
  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
        setFilterSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const role      = currentUser.role;
  const isAdmin   = role === 'admin';
  const isManager = role === 'manager';
  const canFilter = isAdmin || isManager;

  const stageTypeMap = useMemo(() => {
    const map = {};
    workflows.forEach(w => { map[w.id] = w.type || 'BACKLOG'; });
    return map;
  }, [workflows]);

  const filterableUsers = useMemo(() => {
    if (!canFilter) return [currentUser];
    const pool = isAdmin
      ? users
      : users.filter(u =>
          (u.department_id && u.department_id === currentUser.department_id) || u.id === currentUser.id
        );
    return [...pool].sort((a, b) => {
      if (a.id === currentUser.id) return -1;
      if (b.id === currentUser.id) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [users, currentUser, isAdmin, canFilter]);

  const deptUserIds = useMemo(
    () => new Set(filterableUsers.map(u => u.id)),
    [filterableUsers]
  );

  const effectiveUserIds = useMemo(
    () => assigneeFilter.size > 0 ? assigneeFilter : deptUserIds,
    [assigneeFilter, deptUserIds]
  );

  const myTasks = useMemo(() =>
    tasks.filter(t =>
      effectiveUserIds.has(t.assignee) ||
      (t.subtasks || []).some(s => effectiveUserIds.has(s.assigneeId))
    ),
  [tasks, effectiveUserIds]);

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return myTasks;
    return myTasks.filter(t => (stageTypeMap[t.status] || 'BACKLOG') === statusFilter);
  }, [myTasks, statusFilter, stageTypeMap]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      if (sortBy === 'priority') {
        const pa = PRIORITY_ORDER[a.priority?.toLowerCase() ?? ''] ?? 3;
        const pb = PRIORITY_ORDER[b.priority?.toLowerCase() ?? ''] ?? 3;
        if (pa !== pb) return pa - pb;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    }),
  [filtered, sortBy]);

  // Users shown in the trigger button (max 3 stacked)
  const selectedUsers = assigneeFilter.size > 0
    ? filterableUsers.filter(u => assigneeFilter.has(u.id))
    : [];

  const toggleUser = (uid) => setAssigneeFilter(prev => {
    const next = new Set(prev);
    next.has(uid) ? next.delete(uid) : next.add(uid);
    return next;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className={styles.title}>My Board</h1>
            <span className={styles.count}>{sorted.length} task{sorted.length !== 1 ? 's' : ''}</span>
          </div>
          <p className={styles.subtitle}>
            Here is the list of tasks from various projects assigned to you, including the subtasks.<br />
            Always update the activity on your tasks and complete them properly.
          </p>
        </div>

        <div className={styles.controls}>
          {/* Status filter */}
          <div className={styles.filterGroup}>
            {STATUS_FILTERS.map(f => {
              const isActive = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  className={`${styles.filterBtn} ${isActive ? styles.active : ''}`}
                  style={{
                    '--f-color':  f.color,
                    '--f-bg':     f.bg,
                    '--f-border': f.border,
                    borderColor:  isActive ? f.color  : f.border,
                    color:        isActive ? f.color  : f.colorMuted,
                    background:   isActive ? f.bg     : 'transparent',
                    fontWeight:   isActive ? '600'    : '400',
                  }}
                  onClick={() => setStatusFilter(f.key)}
                >{f.label}</button>
              );
            })}
          </div>

          <div className={styles.filterDivider} />

          {/* Sort */}
          <div className={styles.filterGroup}>
            <button
              className={`${styles.filterBtn} ${sortBy === 'priority' ? styles.active : ''}`}
              onClick={() => setSortBy('priority')}
            ><ArrowUpDown size={13} /> Priority</button>
            <button
              className={`${styles.filterBtn} ${sortBy === 'created' ? styles.active : ''}`}
              onClick={() => setSortBy('created')}
            ><Clock size={13} /> Created</button>
          </div>

          {/* Assignee filter — admin/manager only */}
          {canFilter && (
            <>
              <div className={styles.filterDivider} />
              <div className={styles.filterPickerWrap} ref={filterRef}>

                {/* Trigger button */}
                <button
                  className={`${styles.filterPickerBtn} ${filterOpen ? styles.filterPickerBtnOpen : ''} ${assigneeFilter.size > 0 ? styles.filterPickerBtnActive : ''}`}
                  onClick={() => setFilterOpen(o => !o)}
                >
                  {selectedUsers.length === 0 ? (
                    <span className={styles.filterAllLabel}>All Members</span>
                  ) : (
                    <div className={styles.filterAvatarStack}>
                      {selectedUsers.slice(0, 3).map((u, i) => (
                        <span key={u.id} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 10 - i, display: 'inline-flex' }}>
                          <UserAvatar user={u} size={22} />
                        </span>
                      ))}
                      {selectedUsers.length > 3 && (
                        <span className={styles.filterMoreBadge}>+{selectedUsers.length - 3}</span>
                      )}
                    </div>
                  )}
                  <ChevronDown size={13} className={filterOpen ? styles.chevronOpen : ''} />
                </button>

                {/* Popup */}
                {filterOpen && (
                  <div className={styles.filterPopup}>
                    <div className={styles.filterPopupHeader}>
                      <span className={styles.filterPopupTitle}>Filter by member</span>
                      <div className={styles.filterPopupActions}>
                        <button
                          className={styles.filterPopupActionBtn}
                          onClick={() => setAssigneeFilter(new Set(filterableUsers.map(u => u.id)))}
                        >All</button>
                        <button
                          className={styles.filterPopupActionBtn}
                          onClick={() => setAssigneeFilter(new Set())}
                        >Clear</button>
                      </div>
                    </div>

                    <div className={styles.filterSearchWrap}>
                      <input
                        className={styles.filterSearchInput}
                        type="text"
                        placeholder="Search member..."
                        value={filterSearch}
                        onChange={e => setFilterSearch(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className={styles.filterUserList}>
                      {filterableUsers.filter(u =>
                        u.name.toLowerCase().includes(filterSearch.toLowerCase())
                      ).map(u => {
                        const active = assigneeFilter.has(u.id);
                        return (
                          <button
                            key={u.id}
                            className={`${styles.filterUserRow} ${active ? styles.filterUserRowActive : ''}`}
                            onClick={() => toggleUser(u.id)}
                          >
                            <UserAvatar user={u} size={30} />
                            <span className={styles.filterUserName}>
                              {u.id === currentUser.id ? `${u.name} (You)` : u.name}
                            </span>
                            <span className={`${styles.filterUserToggle} ${active ? styles.filterUserToggleOn : ''}`}>
                              {active && <Check size={10} strokeWidth={3} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}><p>No tasks found.</p></div>
      ) : (
        <div className={styles.grid}>
          {sorted.map(task => (
            <MyCard
              key={task.id}
              task={task}
              users={users}
              projects={projects}
              viewUserIds={effectiveUserIds}
              stageType={stageTypeMap[task.status] || 'BACKLOG'}
              onClick={() => onTaskClick(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MyCard = ({ task, users, projects, viewUserIds, stageType, onClick }) => {
  const project  = projects.find(p => p.id === task.projectId);
  const assignee = users.find(u => u.id === task.assignee);

  const mySubtasks = (task.subtasks || []).filter(s => viewUserIds.has(s.assigneeId));
  const isMine     = viewUserIds.has(task.assignee);

  const completedSubtasks = (task.subtasks || []).filter(s => s.isDone === 1).length;
  const totalSubtasks     = (task.subtasks || []).length;

  const priorityKey = task.priority?.toLowerCase() ?? '';
  const pMeta       = priorityMeta[priorityKey];

  const dueDateLabel = (() => {
    if (!task.due_date) return null;
    const d = new Date(task.due_date + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  })();

  const completedDateLabel = (() => {
    if (!task.completedAt) return null;
    return new Date(task.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  })();

  const dueDateState = (() => {
    if (!task.due_date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due   = new Date(task.due_date + 'T00:00:00');
    return (due - today) / (1000 * 60 * 60 * 24) < 2 ? 'overdue' : 'normal';
  })();

  return (
    <div
      className={styles.card}
      style={pMeta ? { background: pMeta.bg, borderColor: pMeta.bg } : undefined}
      onClick={onClick}
    >
      <div className={styles.cardMeta}>
        {project && <span className={styles.projectTag}>{project.name}</span>}
      </div>

      <h4 className={styles.cardTitle}>{task.title}</h4>

      {mySubtasks.length > 0 && (
        <div className={styles.mySubtasks}>
          {mySubtasks.map(s => (
            <div key={s.id} className={`${styles.subtaskRow} ${s.isDone === 1 ? styles.subtaskDone : ''}`}>
              {s.isDone > 0 ? <CheckSquare size={12} /> : <Square size={12} />}
              <span>{s.title}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.cardFooter}>
        <div className={styles.metrics}>
          {totalSubtasks > 0 && (
            <span className={`${styles.metric} ${completedSubtasks === totalSubtasks ? styles.metricDone : ''}`}>
              <CheckSquare size={12} />{completedSubtasks}/{totalSubtasks}
            </span>
          )}
          {task.attachmentCount > 0 && (
            <span className={styles.metric}><Paperclip size={12} />{task.attachmentCount}</span>
          )}
          {task.commentCount > 0 && (
            <span className={styles.metric}><MessageSquare size={12} />{task.commentCount}</span>
          )}
          {dueDateLabel && stageType !== 'DONE' && (
            <span className={`${styles.metric} ${dueDateState === 'overdue' ? styles.metricOverdue : ''}`}>
              <Calendar size={12} />{dueDateLabel}
            </span>
          )}
          {completedDateLabel && (
            <span className={`${styles.metric} ${styles.metricCompleted}`}>
              <CheckCircle2 size={12} />{completedDateLabel}
            </span>
          )}
        </div>
        <div className={styles.cardRight}>
          {!isMine && <span className={styles.subtaskOnlyTag}>Subtask</span>}
          {assignee && <UserAvatar user={assignee} size={24} title={assignee.name} style={{ boxShadow: 'var(--shadow-sm)' }} />}
        </div>
      </div>
    </div>
  );
};

export default MyBoard;
