import { useState, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import Column from './Column';
import ActivityTicker from './ActivityTicker';
import BoardStatistic from './BoardStatistic';
import BoardCalendar from './BoardCalendar';
import BoardRoadmap from './BoardRoadmap';
import BoardList from './BoardList';
import BoardNotes from './BoardNotes';
import { Search, GitBranch, Plus, LayoutDashboard, BarChart2, CalendarDays, Map, List, StickyNote, Sparkles, ChevronDown } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import AIWizardModal from '../modals/AIWizardModal';
import styles from './Board.module.css';

const Board = ({ onTaskClick, onTickerTaskClick }) => {
  const { tasks, workflows, activeProjectId, reorderTasks, getProjectWorkflow, currentUser, projectMembers, users } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('tab') || 'board';
  });
  const [glowTaskId, setGlowTaskId] = useState(null);
  const [noteCreateTrigger, setNoteCreateTrigger] = useState(0);
  const [showMoreAvatars, setShowMoreAvatars] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showAIWizard, setShowAIWizard] = useState(false);
  const createMenuRef = useRef(null);
  const [avatarSearch, setAvatarSearch] = useState('');
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 1370);
  const [isCompact, setIsCompact] = useState(window.innerWidth < 1310);
  const moreAvatarRef = useRef(null);

  useEffect(() => {
    const onResize = () => {
      setIsNarrow(window.innerWidth < 1370);
      setIsCompact(window.innerWidth < 1310);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!showCreateMenu) return;
    const handler = (e) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target))
        setShowCreateMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCreateMenu]);

  useEffect(() => {
    if (!showMoreAvatars) { setAvatarSearch(''); return; }
    const handler = (e) => {
      if (moreAvatarRef.current && !moreAvatarRef.current.contains(e.target))
        setShowMoreAvatars(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreAvatars]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'board') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    if (tab !== 'notes') params.delete('note');
    const qs = params.toString();
    window.history.pushState({}, '', `${window.location.pathname}${qs ? '?' + qs : ''}`);
  };

  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      setActiveTab(p.get('tab') || 'board');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (!activeProjectId) {
    return <div className={styles.emptyState}>Select a project from the sidebar to view its board.</div>;
  }

  // Compute stale tasks for the active project only
  const STALE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
  const now = Date.now();
  const progressIds = new Set(workflows.filter(w => w.type === 'PROGRESS').map(w => w.id));
  const staleTasks = tasks
    .filter(t => t.projectId === activeProjectId && progressIds.has(t.status))
    .map(t => {
      // Activity = latest comment only; tasks with no comments are always stale
      const commentTs = t.latestCommentAt ? new Date(t.latestCommentAt).getTime() : 0;
      if (commentTs > now - STALE_MS) return null;
      return {
        id:                   t.id,
        title:                t.title,
        idleSince:            commentTs,
        latestCommentMessage: t.latestCommentMessage ?? null,
        latestCommentBy:      t.latestCommentBy      ?? null,
        latestCommentAt:      t.latestCommentAt      ?? null,
        assignee:             users.find(u => u.id === t.assignee) ?? null,
      };
    })
    .filter(Boolean);
  const hasTicker = staleTasks.length > 0;

  const assignedUserIds = projectMembers
    .filter(pm => pm.project_id === activeProjectId)
    .map(pm => pm.user_id);
  const assignedUsers = users
    .filter(u => assignedUserIds.includes(u.id))
    .sort((a, b) => {
      if (a.id === currentUser?.id) return -1;
      if (b.id === currentUser?.id) return 1;
      return a.name.localeCompare(b.name);
    });

  const query = searchQuery.trim().toLowerCase();
  const projectTasks = tasks
    .filter(t => t.projectId === activeProjectId)
    .filter(t => !query || t.title.toLowerCase().includes(query))
    .filter(t => !assigneeFilter || t.assignee === assigneeFilter || (t.subtasks || []).some(s => s.assigneeId === assigneeFilter));
  const stages = getProjectWorkflow(activeProjectId);
  const canManageWorkflow = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const toggleAssigneeFilter = (userId) => {
    setAssigneeFilter(prev => prev === userId ? null : userId);
  };

  return (
    <>
    <div className={styles.boardContainer}>
      <ActivityTicker staleTasks={staleTasks} onTaskClick={onTickerTaskClick ?? onTaskClick} />
      <div className={`${styles.boardToolbar} ${hasTicker ? styles.boardToolbarShifted : ''}`}>
        <div className={styles.toolbarLeft}>
          {/* Tab switcher */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'roadmap' ? styles.tabActive : ''}`}
              onClick={() => switchTab('roadmap')}
            >
              <Map size={14} />
              Roadmap
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'board' ? styles.tabActive : ''}`}
              onClick={() => switchTab('board')}
            >
              <LayoutDashboard size={14} />
              Board
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'list' ? styles.tabActive : ''}`}
              onClick={() => switchTab('list')}
            >
              <List size={14} />
              List
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'calendar' ? styles.tabActive : ''}`}
              onClick={() => switchTab('calendar')}
            >
              <CalendarDays size={14} />
              Calendar
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'reporting' ? styles.tabActive : ''}`}
              onClick={() => switchTab('reporting')}
            >
              <BarChart2 size={14} />
              Reporting
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'notes' ? styles.tabActive : ''}`}
              onClick={() => switchTab('notes')}
            >
              <StickyNote size={14} />
              Notes
            </button>
          </div>

          {activeTab === 'board' && (
            <div className={styles.searchBox}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {assignedUsers.length > 0 && (
            <div className={styles.avatarFilter}>
              {assignedUsers.slice(0, isNarrow ? 2 : 5).map(u => (
                <UserAvatar
                  key={u.id}
                  user={u}
                  size={26}
                  title={u.name}
                  className={`${styles.filterAvatar} ${assigneeFilter === u.id ? styles.active : ''}`}
                  onClick={() => toggleAssigneeFilter(u.id)}
                />
              ))}
              {assignedUsers.length > (isNarrow ? 2 : 5) && (
                <div ref={moreAvatarRef} style={{ position: 'relative' }}>
                  <div
                    className={`${styles.avatarMore} ${showMoreAvatars ? styles.avatarMoreActive : ''}`}
                    onClick={() => setShowMoreAvatars(v => !v)}
                  >
                    +{assignedUsers.length - (isNarrow ? 2 : 5)}
                  </div>
                  {showMoreAvatars && (
                    <div className={styles.moreDropdown}>
                      <div className={styles.moreDropdownSearch}>
                        <Search size={12} />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search..."
                          value={avatarSearch}
                          onChange={e => setAvatarSearch(e.target.value)}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      {(avatarSearch.trim()
                        ? assignedUsers.filter(u => u.name.toLowerCase().includes(avatarSearch.toLowerCase()))
                        : assignedUsers.slice(isNarrow ? 2 : 5)
                      ).map(u => (
                        <button
                          key={u.id}
                          className={`${styles.moreDropdownItem} ${assigneeFilter === u.id ? styles.moreDropdownItemActive : ''}`}
                          onClick={() => { toggleAssigneeFilter(u.id); setShowMoreAvatars(false); }}
                        >
                          <UserAvatar user={u} size={22} />
                          <span>{u.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {(assigneeFilter || searchQuery.trim()) && activeTab === 'board' && (
                <button
                  className={styles.clearFilterBtn}
                  onClick={() => { setAssigneeFilter(null); setSearchQuery(''); }}
                  title="Clear filters"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>

        {activeTab === 'board' && (
          <div className={styles.createTaskWrap} ref={createMenuRef}>
            <button
              className={styles.createTaskBtn}
              onClick={() => onTaskClick(null, stages[0]?.id || null)}
            >
              <Plus size={15} />
              {!isCompact && 'Create Task'}
            </button>
            <button
              className={styles.createTaskChevron}
              onClick={() => setShowCreateMenu(v => !v)}
              title="More options"
            >
              <ChevronDown size={13} />
            </button>
            {showCreateMenu && (
              <div className={styles.createTaskMenu}>
                <button
                  className={styles.createTaskMenuItem}
                  onClick={() => { setShowCreateMenu(false); onTaskClick(null, stages[0]?.id || null); }}
                >
                  <Plus size={14} />
                  <span>Create Task</span>
                </button>
                <button
                  className={`${styles.createTaskMenuItem} ${styles.createTaskMenuItemAI}`}
                  onClick={() => { setShowCreateMenu(false); setShowAIWizard(true); }}
                >
                  <Sparkles size={14} />
                  <span>Create with AI Wizard</span>
                  <span className={styles.aiBadge}>AI</span>
                </button>
              </div>
            )}
          </div>
        )}
        {activeTab === 'notes' && (
          <button
            className={styles.createTaskBtn}
            onClick={() => setNoteCreateTrigger(t => t + 1)}
          >
            <Plus size={15} />
            New Note
          </button>
        )}
      </div>

      {activeTab === 'reporting' ? (
        <div className={`${styles.statisticWrap} ${hasTicker ? styles.boardShifted : ''}`}>
          <BoardStatistic assigneeFilter={assigneeFilter} />
        </div>
      ) : activeTab === 'list' ? (
        <div className={`${styles.statisticWrap} ${hasTicker ? styles.boardShifted : ''}`}>
          <BoardList assigneeFilter={assigneeFilter} onTaskClick={onTaskClick} />
        </div>
      ) : activeTab === 'calendar' ? (
        <div className={`${styles.statisticWrap} ${hasTicker ? styles.boardShifted : ''}`}>
          <BoardCalendar assigneeFilter={assigneeFilter} onTaskClick={onTaskClick} />
        </div>
      ) : activeTab === 'roadmap' ? (
        <div className={`${styles.statisticWrap} ${hasTicker ? styles.boardShifted : ''}`}>
          <BoardRoadmap assigneeFilter={assigneeFilter} onTaskClick={onTaskClick} />
        </div>
      ) : activeTab === 'notes' ? (
        <div className={`${styles.statisticWrap} ${hasTicker ? styles.boardShifted : ''}`}>
          <BoardNotes createTrigger={noteCreateTrigger} />
        </div>
      ) : stages.length === 0 ? (
        <div className={styles.noWorkflow}>
          <div className={styles.noWorkflowIcon}>
            <GitBranch size={36} strokeWidth={1.5} />
          </div>
          <h3 className={styles.noWorkflowTitle}>Belum ada workflow</h3>
          <p className={styles.noWorkflowDesc}>
            Project ini belum memiliki tahapan workflow. Tambahkan workflow untuk mulai mengelola task.
          </p>
          {canManageWorkflow && (
            <p className={styles.noWorkflowDesc} style={{ fontSize: '0.82rem', marginTop: 4 }}>
              Buka Project Settings untuk menambah workflow.
            </p>
          )}
        </div>
      ) : (
        <div className={`${styles.board} ${hasTicker ? styles.boardShifted : ''}`}>
          {stages.map(stage => {
            const isDone = stage.type === 'DONE';
            const stageTasks = projectTasks
              .filter(t => t.status === stage.id)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            return (
              <Column
                key={stage.id}
                stageId={stage.id}
                status={stage.name}
                stageColor={stage.color}
                tasks={stageTasks}
                glowTaskId={glowTaskId}
                onDropTask={(taskId, insertIndex) => {
                  const isStageChange = tasks.find(t => t.id === taskId)?.status !== stage.id;
                  reorderTasks(taskId, stage.id, insertIndex);
                  if (isStageChange) {
                    setGlowTaskId(taskId);
                    setTimeout(() => setGlowTaskId(null), 1400);
                  }
                }}
                onTaskClick={onTaskClick}
                maxTasks={isDone ? 20 : undefined}
                onSeeAll={isDone ? () => setActiveTab('list') : undefined}
              />
            );
          })}
        </div>
      )}

    </div>

    {showAIWizard && (
      <AIWizardModal
        initialStatus={stages[0]?.id || null}
        onClose={() => setShowAIWizard(false)}
        onConfirm={(aiData) => {
          setShowAIWizard(false);
          onTaskClick(null, aiData.status, aiData);
        }}
      />
    )}
    </>
  );
};

export default Board;
