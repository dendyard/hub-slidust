import { useMemo } from 'react';
import { useData } from '../../context/DataContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import UserAvatar from '../ui/UserAvatar';
import styles from './BoardStatistic.module.css';

/* ── helpers ──────────────────────────────────────────── */
const toDayLabel = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const toDayKey = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  // Use local date parts to avoid UTC timezone shift
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const STATUS_TYPES = [
  { key: 'BACKLOG',  label: 'Backlog',  color: '#94a3b8' },
  { key: 'PROGRESS', label: 'Progress', color: '#3b82f6' },
  { key: 'DONE',     label: 'Done',     color: '#22c55e' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipTitle}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.stroke }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

/* ── component ────────────────────────────────────────── */
const BoardStatistic = ({ assigneeFilter }) => {
  const { tasks, activeProjectId, getProjectWorkflow, users, projectMembers } = useData();

  const stages = getProjectWorkflow(activeProjectId);
  const allProjectTasks = tasks.filter(t => t.projectId === activeProjectId);

  // Members of this project
  const memberIds = useMemo(() =>
    projectMembers.filter(pm => pm.project_id === activeProjectId).map(pm => pm.user_id),
  [projectMembers, activeProjectId]);
  const memberUsers = useMemo(() => users.filter(u => memberIds.includes(u.id)), [users, memberIds]);

  // Apply assignee filter from Board toolbar
  const projectTasks = useMemo(() => {
    if (!assigneeFilter) return allProjectTasks;
    return allProjectTasks.filter(t =>
      t.assignee === assigneeFilter ||
      (t.subtasks || []).some(s => s.assigneeId === assigneeFilter)
    );
  }, [allProjectTasks, assigneeFilter]);

  // Map stage id → type
  const stageTypeMap = useMemo(() => {
    const map = {};
    stages.forEach(s => { map[s.id] = s.type || 'BACKLOG'; });
    return map;
  }, [stages]);

  /* current task count per status type */
  const typeCounts = useMemo(() =>
    STATUS_TYPES.map(st => ({
      ...st,
      count: projectTasks.filter(t => stageTypeMap[t.status] === st.key).length,
    })),
  [projectTasks, stageTypeMap]);

  /* area chart: tasks created per day (last 30 days) by status type */
  const chartData = useMemo(() => {
    const days = 30;
    const now = new Date();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i));
      const dayKey = toDayKey(d);
      const row = { date: toDayLabel(d) };
      STATUS_TYPES.forEach(st => {
        row[st.label] = projectTasks.filter(
          t => toDayKey(t.created_at) === dayKey && (stageTypeMap[t.status] === st.key || (!stageTypeMap[t.status] && st.key === 'BACKLOG'))
        ).length;
      });
      return row;
    });
  }, [projectTasks, stageTypeMap]);

  /* team workload: tasks + subtasks per member, broken down by status type */
  const workloadData = useMemo(() => {
    const visibleMembers = assigneeFilter
      ? memberUsers.filter(u => u.id === assigneeFilter)
      : memberUsers;

    return visibleMembers.map(u => {
      const assignedTasks = projectTasks.filter(t => t.assignee === u.id);
      const assignedSubtasks = projectTasks.flatMap(t =>
        (t.subtasks || []).filter(s => s.assigneeId === u.id)
      );

      // count tasks by status type
      const tasksByType = {};
      STATUS_TYPES.forEach(st => {
        tasksByType[st.key] = assignedTasks.filter(
          t => stageTypeMap[t.status] === st.key
        ).length;
      });

      const subtaskBacklog  = assignedSubtasks.filter(s => s.isDone === 0).length;
      const subtaskProgress = assignedSubtasks.filter(s => s.isDone === 2).length;
      const subtaskDone     = assignedSubtasks.filter(s => s.isDone === 1).length;

      const totalTasks    = assignedTasks.length;
      const totalSubtasks = assignedSubtasks.length;
      const totalItems    = totalTasks + totalSubtasks;

      return { user: u, tasksByType, subtaskBacklog, subtaskProgress, subtaskDone, totalTasks, totalSubtasks, totalItems };
    }).sort((a, b) => b.totalItems - a.totalItems);
  }, [projectTasks, memberUsers, assigneeFilter, stageTypeMap]);

  if (stages.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Belum ada workflow untuk ditampilkan.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>

      {/* Summary cards */}
      <div className={styles.summaryGrid}>
        {typeCounts.map(st => (
          <div key={st.key} className={styles.summaryCard}>
            <div className={styles.cardDot} style={{ background: st.color }} />
            <div>
              <div className={styles.cardCount}>{st.count}</div>
              <div className={styles.cardLabel}>{st.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stacked area chart */}
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>Daily Task Activity</h3>
          <p className={styles.chartSub}>Jumlah task dibuat per hari dalam 30 hari terakhir, dikelompokkan berdasarkan status</p>
        </div>

        {chartData.length === 0 ? (
          <div className={styles.noData}>Belum ada data task untuk ditampilkan.</div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <defs>
                {STATUS_TYPES.map(st => (
                  <linearGradient key={st.key} id={`grad-${st.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={st.color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={st.color} stopOpacity={0.04} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis
                dataKey="date"
                interval={4}
                tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '0.82rem', paddingTop: '12px' }}
              />
              {STATUS_TYPES.map(st => (
                <Area
                  key={st.key}
                  type="monotone"
                  dataKey={st.label}
                  stroke={st.color}
                  strokeWidth={2.5}
                  fill={`url(#grad-${st.key})`}
                  dot={{ r: 4, strokeWidth: 0, fill: st.color }}
                  activeDot={{ r: 6 }}
                  stackId="1"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>


      {/* Team Workload */}
      <div className={styles.tableCard}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>Team Workload</h3>
          <p className={styles.chartSub}>Jumlah task &amp; subtask yang di-assign per anggota tim</p>
        </div>

        {workloadData.length === 0 ? (
          <div className={styles.noData}>Belum ada anggota tim di project ini.</div>
        ) : (
          <div className={styles.workloadList}>
            {workloadData.map(({ user, tasksByType, subtaskBacklog, subtaskProgress, subtaskDone, totalTasks, totalSubtasks, totalItems }) => {
              const maxItems = workloadData[0].totalItems || 1;
              const barPct   = Math.round((totalItems / maxItems) * 100);
              return (
                <div key={user.id} className={styles.workloadRow}>
                  <div className={styles.workloadMember}>
                    <UserAvatar user={user} size={32} />
                    <div className={styles.workloadName}>
                      <span className={styles.workloadDisplayName}>{user.name}</span>
                      <span className={styles.workloadSub}>
                        {totalTasks} task · {totalSubtasks} subtask
                      </span>
                    </div>
                  </div>

                  <div className={styles.workloadBadges}>
                    {STATUS_TYPES.map(st => (
                      tasksByType[st.key] > 0 && (
                        <span
                          key={st.key}
                          className={styles.typeBadge}
                          style={{ background: st.color + '22', color: st.color, border: `1px solid ${st.color}44` }}
                        >
                          {st.label} {tasksByType[st.key]}
                        </span>
                      )
                    ))}
                    {subtaskBacklog > 0 && (
                      <span className={styles.typeBadge} style={{ background: '#94a3b822', color: '#94a3b8', border: '1px solid #94a3b844' }}>
                        Subtask Backlog {subtaskBacklog}
                      </span>
                    )}
                    {subtaskProgress > 0 && (
                      <span className={styles.typeBadge} style={{ background: '#6366f122', color: '#6366f1', border: '1px solid #6366f144' }}>
                        Subtask On Progress {subtaskProgress}
                      </span>
                    )}
                    {subtaskDone > 0 && (
                      <span className={styles.typeBadge} style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44' }}>
                        Subtask Done {subtaskDone}
                      </span>
                    )}
                  </div>

                  <div className={styles.workloadBarWrap}>
                    <div className={styles.workloadBarTrack}>
                      <div className={styles.workloadBarFill} style={{ width: `${barPct}%` }} />
                    </div>
                    <span className={styles.workloadTotal}>{totalItems}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default BoardStatistic;
