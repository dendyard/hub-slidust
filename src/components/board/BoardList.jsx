import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, X, CalendarRange, Download } from 'lucide-react';
import { useData } from '../../context/DataContext';
import UserAvatar from '../ui/UserAvatar';
import styles from './BoardList.module.css';

const PRIORITY_COLOR = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const SortIcon = ({ col, sortKey, sortDir }) => {
  if (sortKey !== col) return <ChevronsUpDown size={13} className={styles.sortIcon} />;
  return sortDir === 'asc'
    ? <ChevronUp size={13} className={`${styles.sortIcon} ${styles.sortActive}`} />
    : <ChevronDown size={13} className={`${styles.sortIcon} ${styles.sortActive}`} />;
};

const BoardList = ({ assigneeFilter, onTaskClick }) => {
  const { tasks, activeProjectId, getProjectWorkflow, users } = useData();

  const stages = getProjectWorkflow(activeProjectId);
  const stageMap = useMemo(() => {
    const m = {};
    stages.forEach(s => { m[s.id] = s; });
    return m;
  }, [stages]);

  const [filterStatus,    setFilterStatus]    = useState('');
  const [filterPriority,  setFilterPriority]  = useState('');
  const [search,          setSearch]          = useState('');
  const [dateField,       setDateField]       = useState('due_date'); // 'start_date' | 'due_date'
  const [dateFrom,        setDateFrom]        = useState('');
  const [dateTo,          setDateTo]          = useState('');
  const [showDateFilter,  setShowDateFilter]  = useState(false);
  const [sortKey,         setSortKey]         = useState('title');
  const [sortDir,         setSortDir]         = useState('asc');

  const filtered = useMemo(() => {
    let list = tasks.filter(t => t.projectId === activeProjectId);
    if (assigneeFilter) list = list.filter(t => t.assignee === assigneeFilter);
    if (filterStatus)   list = list.filter(t => t.status === filterStatus);
    if (filterPriority) list = list.filter(t => t.priority === filterPriority);
    if (search.trim())  list = list.filter(t => t.title.toLowerCase().includes(search.trim().toLowerCase()));

    // Date range filter
    if (dateFrom || dateTo) {
      list = list.filter(t => {
        const d = t[dateField];
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo   && d > dateTo)   return false;
        return true;
      });
    }

    list = [...list].sort((a, b) => {
      let va, vb;
      if (sortKey === 'title')      { va = a.title?.toLowerCase();                  vb = b.title?.toLowerCase(); }
      if (sortKey === 'status')     { va = stageMap[a.status]?.name?.toLowerCase(); vb = stageMap[b.status]?.name?.toLowerCase(); }
      if (sortKey === 'priority')   { const o = { High: 0, Medium: 1, Low: 2 }; va = o[a.priority] ?? 3; vb = o[b.priority] ?? 3; }
      if (sortKey === 'assignee')   { va = users.find(u => u.id === a.assignee)?.name?.toLowerCase() ?? ''; vb = users.find(u => u.id === b.assignee)?.name?.toLowerCase() ?? ''; }
      if (sortKey === 'due_date')   { va = a.due_date   || '9999'; vb = b.due_date   || '9999'; }
      if (sortKey === 'start_date') { va = a.start_date || '9999'; vb = b.start_date || '9999'; }
      if (va === undefined) return 0;
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [tasks, activeProjectId, assigneeFilter, filterStatus, filterPriority, search, dateField, dateFrom, dateTo, sortKey, sortDir, stageMap, users]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const hasFilters = filterStatus || filterPriority || search || dateFrom || dateTo;
  const clearFilters = () => { setFilterStatus(''); setFilterPriority(''); setSearch(''); setDateFrom(''); setDateTo(''); setShowDateFilter(false); };

  const today = new Date().toISOString().slice(0, 10);

  // ── Export to CSV ──────────────────────────────────────────
  const exportToCsv = () => {
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      // Wrap in quotes if it contains comma, quote, or newline
      return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = ['Title', 'Subtasks', 'Status', 'Priority', 'Assignee', 'Start Date', 'Due Date'];

    const rows = filtered.map(t => {
      const stage    = stageMap[t.status];
      const assignee = users.find(u => u.id === t.assignee);
      const subtaskText = t.subtasks?.length
        ? `${t.subtasks.filter(s => s.isDone).length}/${t.subtasks.length}`
        : '';
      return [
        escape(t.title),
        escape(subtaskText),
        escape(stage?.name || ''),
        escape(t.priority || ''),
        escape(assignee?.name || ''),
        escape(formatDate(t.start_date)),
        escape(formatDate(t.due_date)),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `tasks_export_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      {/* Filter bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search tasks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          className={styles.filterSelect}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">All Status</option>
          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <select
          className={styles.filterSelect}
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
        >
          <option value="">All Priority</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        {/* Date range filter toggle */}
        <button
          className={`${styles.dateFilterBtn} ${showDateFilter ? styles.dateFilterBtnActive : ''} ${(dateFrom || dateTo) ? styles.dateFilterBtnSet : ''}`}
          onClick={() => setShowDateFilter(v => !v)}
          title="Filter by date"
        >
          <CalendarRange size={14} />
          Date
          {(dateFrom || dateTo) && <span className={styles.dateDot} />}
        </button>

        {hasFilters && (
          <button className={styles.clearBtn} onClick={clearFilters}>
            <X size={13} /> Clear
          </button>
        )}

        <span className={styles.countBadge}>{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>

        <button
          className={styles.exportBtn}
          onClick={exportToCsv}
          title="Export to CSV"
          disabled={filtered.length === 0}
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Date range panel */}
      {showDateFilter && (
        <div className={styles.datePanel}>
          <div className={styles.datePanelInner}>
            <span className={styles.datePanelLabel}>Filter by</span>
            <select
              className={styles.datePanelSelect}
              value={dateField}
              onChange={e => setDateField(e.target.value)}
            >
              <option value="start_date">Start Date</option>
              <option value="due_date">Due Date</option>
            </select>

            <span className={styles.datePanelLabel}>From</span>
            <input
              type="date"
              className={styles.datePanelInput}
              value={dateFrom}
              max={dateTo || undefined}
              onChange={e => setDateFrom(e.target.value)}
            />

            <span className={styles.datePanelLabel}>To</span>
            <input
              type="date"
              className={styles.datePanelInput}
              value={dateTo}
              min={dateFrom || undefined}
              onChange={e => setDateTo(e.target.value)}
            />

            {(dateFrom || dateTo) && (
              <button className={styles.dateClearBtn} onClick={() => { setDateFrom(''); setDateTo(''); }}>
                <X size={12} /> Clear dates
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th} onClick={() => toggleSort('title')}>
                Title <SortIcon col="title" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={styles.th} onClick={() => toggleSort('status')}>
                Status <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={styles.th} onClick={() => toggleSort('priority')}>
                Priority <SortIcon col="priority" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={styles.th} onClick={() => toggleSort('assignee')}>
                Assignee <SortIcon col="assignee" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={styles.th} onClick={() => toggleSort('start_date')}>
                Start Date <SortIcon col="start_date" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={styles.th} onClick={() => toggleSort('due_date')}>
                Due Date <SortIcon col="due_date" sortKey={sortKey} sortDir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.empty}>No tasks found.</td>
              </tr>
            )}
            {filtered.map(t => {
              const stage    = stageMap[t.status];
              const assignee = users.find(u => u.id === t.assignee);
              const isOverdue = t.due_date && t.due_date < today && stage?.type !== 'DONE';
              return (
                <tr key={t.id} className={styles.row} onClick={() => onTaskClick(t.id)}>
                  <td className={styles.tdTitle}>
                    <span className={styles.titleText}>{t.title}</span>
                    {(t.subtasks?.length > 0) && (
                      <span className={styles.subtaskBadge}>{t.subtasks.filter(s => s.isDone).length}/{t.subtasks.length}</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    <span className={styles.muted}>{stage?.name || '—'}</span>
                  </td>
                  <td className={styles.td}>
                    <span
                      className={styles.priorityPill}
                      style={{ background: (PRIORITY_COLOR[t.priority] || '#94a3b8') + '22', color: PRIORITY_COLOR[t.priority] || '#94a3b8' }}
                    >
                      {t.priority || '—'}
                    </span>
                  </td>
                  <td className={styles.td}>
                    {assignee
                      ? <div className={styles.assigneeCell}><UserAvatar user={assignee} size={22} /><span>{assignee.name}</span></div>
                      : <span className={styles.muted}>—</span>
                    }
                  </td>
                  <td className={styles.td}>
                    <span className={styles.dateCell}>{formatDate(t.start_date)}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.dateCell} ${isOverdue ? styles.overdue : ''}`}>
                      {formatDate(t.due_date)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BoardList;
