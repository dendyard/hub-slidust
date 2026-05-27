import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../../context/DataContext';
import { FileText, Trash2, X, Clock, ListChecks } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import styles from './BoardNotes.module.css';

const formatDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const TASK_MARKER = /\s*\[\[embedded_tasks:([^\]]*)\]\]/;

const parseNoteContent = (raw = '') => {
  const match = raw.match(TASK_MARKER);
  const taskIds = match ? match[1].split(',').filter(Boolean) : [];
  const text = raw.replace(TASK_MARKER, '');
  return { text, taskIds };
};

const serializeNoteContent = (text, taskIds) =>
  taskIds.length > 0 ? `${text}\n[[embedded_tasks:${taskIds.join(',')}]]` : text;

const NoteModal = ({ note, onClose, onUpdate, onDelete, users, canDelete }) => {
  const { tasks, workflows, activeProjectId } = useData();

  const [initParsed] = useState(() => parseNoteContent(note.content));
  const { text: initText, taskIds: initTaskIds } = initParsed;

  const [title,           setTitle]           = useState(note.title || '');
  const [text,            setText]            = useState(initText);
  const [embeddedTaskIds, setEmbeddedTaskIds] = useState(initTaskIds);
  const [glowTaskId,      setGlowTaskId]      = useState(null);
  const [confirmDelete,   setConfirmDelete]   = useState(false);
  const [confirmExit,     setConfirmExit]     = useState(false);
  const [showBrowser,        setShowBrowser]        = useState(false);
  const [taskSearch,         setTaskSearch]         = useState('');
  const [taskLimit,          setTaskLimit]          = useState(10);
  const [popupStyle,         setPopupStyle]         = useState({});
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);

  const titleRef    = useRef(null);
  const embedBtnRef = useRef(null);
  const popupRef    = useRef(null);
  const isDirtyRef  = useRef(false);

  const isDirty = title !== (note.title || '') ||
    text !== initText ||
    embeddedTaskIds.join(',') !== initTaskIds.join(',');
  isDirtyRef.current = isDirty;

  const projectWorkflows = workflows
    .filter(w => w.project_id === activeProjectId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const filteredDoneTasks = tasks
    .filter(t => t.projectId === activeProjectId)
    .filter(t => selectedWorkflowId ? t.status === selectedWorkflowId : true)
    .filter(t => !embeddedTaskIds.includes(t.id))
    .filter(t => !taskSearch || t.title?.toLowerCase().includes(taskSearch.toLowerCase()));

  const embeddedTasks = embeddedTaskIds
    .map(id => tasks.find(t => t.id === id))
    .filter(Boolean);

  useEffect(() => {
    titleRef.current?.focus();
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (showBrowser)   { closeBrowser(); return; }
        if (confirmDelete) { setConfirmDelete(false); return; }
        if (confirmExit)   { setConfirmExit(false); return; }
        if (isDirtyRef.current) { setConfirmExit(true); return; }
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showBrowser, confirmDelete, confirmExit]);

  useEffect(() => {
    if (!showBrowser) return;
    const handler = (e) => {
      if (popupRef.current?.contains(e.target)) return;
      if (embedBtnRef.current?.contains(e.target)) return;
      closeBrowser();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBrowser]);

  const tryClose = () => {
    if (isDirtyRef.current) { setConfirmExit(true); return; }
    onClose();
  };

  const handleSave = () => {
    onUpdate(note.id, { title, content: serializeNoteContent(text, embeddedTaskIds) });
    onClose();
  };

  const openBrowser = () => {
    if (embedBtnRef.current) {
      const rect = embedBtnRef.current.getBoundingClientRect();
      setPopupStyle({
        bottom: window.innerHeight - rect.top + 8,
        left: Math.max(16, Math.min(rect.left, window.innerWidth - 336)),
      });
    }
    setShowBrowser(true);
    setTaskSearch('');
    setTaskLimit(10);
    setSelectedWorkflowId(null);
  };

  const closeBrowser = () => {
    setShowBrowser(false);
    setTaskSearch('');
    setTaskLimit(10);
    setSelectedWorkflowId(null);
  };

  const addTask = (task) => {
    setEmbeddedTaskIds(prev => [task.id, ...prev]);
    setGlowTaskId(task.id);
    setTimeout(() => setGlowTaskId(null), 1200);
  };

  const removeTask = (taskId) => {
    setEmbeddedTaskIds(prev => prev.filter(id => id !== taskId));
  };

  const openTask = (taskId) => {
    const params = new URLSearchParams(window.location.search);
    params.set('task', taskId);
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  };

  const author = users.find(u => u.id === note.created_by);

  return createPortal(
    <>
      <div className={styles.modalOverlay} onClick={tryClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>

          <div className={styles.modalHeader}>
            <div className={styles.modalMeta}>
              {author && <UserAvatar user={author} size={22} title={author.name} />}
              <span className={styles.metaDate}>
                <Clock size={11} />
                {formatDate(note.updated_at || note.created_at)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {canDelete && (
                <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)} title="Delete note">
                  <Trash2 size={15} />
                </button>
              )}
              <button className={styles.closeBtn} onClick={tryClose}>
                <X size={18} />
              </button>
            </div>
          </div>

          <input
            ref={titleRef}
            className={styles.modalTitle}
            placeholder="Note title…"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <textarea
            className={styles.modalContent}
            placeholder="Write anything…"
            value={text}
            onChange={e => setText(e.target.value)}
          />

          {embeddedTasks.length > 0 && (
            <div className={styles.embeddedSection}>
              {embeddedTasks.map(task => (
                <button key={task.id} className={`${styles.embeddedItem} ${glowTaskId === task.id ? styles.embeddedItemGlow : ''}`} onClick={() => openTask(task.id)}>
                  <span className={styles.embeddedTitle}>{task.title}</span>
                  <span className={styles.embeddedRemove} role="button" onClick={e => { e.stopPropagation(); removeTask(task.id); }}>
                    <X size={11} />
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className={styles.noteToolbar}>
            <button
              ref={embedBtnRef}
              className={`${styles.embedBtn} ${showBrowser ? styles.embedBtnActive : ''}`}
              onClick={showBrowser ? closeBrowser : openBrowser}
            >
              <ListChecks size={14} />
              <span>Embed Task</span>
            </button>
          </div>

          {confirmExit && (
            <div className={styles.confirmOverlay} onClick={() => setConfirmExit(false)}>
              <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
                <p className={styles.confirmTitle}>Unsaved changes</p>
                <p className={styles.confirmDesc}>Do you want to save your changes before closing?</p>
                <div className={styles.confirmActions}>
                  <button className={styles.confirmSaveBtn} onClick={handleSave}>Save & Close</button>
                  <button className={styles.confirmDiscardBtn} onClick={onClose}>Discard</button>
                  <button className={styles.confirmCancelBtn} onClick={() => setConfirmExit(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {confirmDelete && (
            <div className={styles.confirmOverlay} onClick={() => setConfirmDelete(false)}>
              <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
                <p className={styles.confirmTitle}>Delete Note?</p>
                <p className={styles.confirmDesc}>This note will be permanently deleted and cannot be recovered.</p>
                <div className={styles.confirmActions}>
                  <button className={styles.confirmDeleteBtn} onClick={() => { onDelete(note.id); onClose(); }}>Delete</button>
                  <button className={styles.confirmCancelBtn} onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {showBrowser && (
        <div ref={popupRef} className={styles.taskPopup} style={popupStyle}>
          <div className={styles.taskPopupHeader}>
            <input
              className={styles.taskPopupSearch}
              placeholder="Search tasks…"
              value={taskSearch}
              onChange={e => { setTaskSearch(e.target.value); setTaskLimit(10); }}
              autoFocus
            />
          </div>
          <div className={styles.taskPopupFilters}>
            <button
              className={`${styles.filterChip} ${!selectedWorkflowId ? styles.filterChipActive : ''}`}
              onClick={() => { setSelectedWorkflowId(null); setTaskLimit(10); }}
            >
              All
            </button>
            {projectWorkflows.map(wf => (
              <button
                key={wf.id}
                className={`${styles.filterChip} ${selectedWorkflowId === wf.id ? styles.filterChipActive : ''}`}
                onClick={() => { setSelectedWorkflowId(wf.id); setTaskLimit(10); }}
              >
                {wf.name}
              </button>
            ))}
          </div>
          <div className={styles.taskPopupList}>
            {filteredDoneTasks.length === 0 ? (
              <div className={styles.taskPopupEmpty}>
                {taskSearch ? 'No tasks match your search' : 'No tasks in this status'}
              </div>
            ) : (
              <>
                {filteredDoneTasks.slice(0, taskLimit).map(task => (
                  <button key={task.id} className={styles.taskPopupItem} onClick={() => addTask(task)}>
                    <span>{task.title}</span>
                  </button>
                ))}
                {filteredDoneTasks.length > taskLimit && (
                  <button className={styles.taskPopupLoadMore} onClick={() => setTaskLimit(l => l + 10)}>
                    Load more ({filteredDoneTasks.length - taskLimit} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

const BoardNotes = ({ createTrigger }) => {
  const { notes, fetchNotes, addNote, updateNote, deleteNote, activeProjectId, currentUser, users } = useData();
  const [openNoteId, setOpenNoteId] = useState(() => {
    return new URLSearchParams(window.location.search).get('note') || null;
  });

  useEffect(() => {
    fetchNotes(activeProjectId);
  }, [activeProjectId]);

  useEffect(() => {
    if (!createTrigger) return;
    addNote(activeProjectId, currentUser?.id).then(id => openNoteById(id));
  }, [createTrigger]);

  const openNoteById = (id) => {
    setOpenNoteId(id);
    const params = new URLSearchParams(window.location.search);
    params.set('note', id);
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  const handleCloseNote = () => {
    setOpenNoteId(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('note');
    const qs = params.toString();
    window.history.pushState({}, '', `${window.location.pathname}${qs ? '?' + qs : ''}`);
  };

  const projectNotes = notes
    .filter(n => n.project_id === activeProjectId)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const openNote = projectNotes.find(n => n.id === openNoteId) || null;

  const getExcerpt = (rawContent, max = 100) => {
    if (!rawContent) return '';
    const plain = rawContent.replace(TASK_MARKER, '').replace(/\s+/g, ' ').trim();
    return plain.length > max ? plain.slice(0, max) + '…' : plain;
  };

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        {projectNotes.length === 0 ? (
          <div className={styles.empty}>
            <FileText size={48} strokeWidth={1.2} />
            <p>No notes yet. Create your first note!</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {projectNotes.map(note => {
              const author = users.find(u => u.id === note.created_by);
              return (
                <div key={note.id} className={styles.card} onClick={() => openNoteById(note.id)}>
                  <div className={styles.cardTitle}>
                    {note.title || <span className={styles.untitled}>Untitled</span>}
                  </div>
                  {note.content && (
                    <div className={styles.cardExcerpt}>{getExcerpt(note.content)}</div>
                  )}
                  <div className={styles.cardFooter}>
                    <span className={styles.cardDate}>
                      <Clock size={11} />
                      {formatDate(note.updated_at || note.created_at)}
                    </span>
                    {author && <UserAvatar user={author} size={20} title={author.name} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {openNote && (
        <NoteModal
          note={openNote}
          users={users}
          canDelete={currentUser?.role === 'admin' || currentUser?.role === 'manager' || openNote.created_by === currentUser?.id}
          onClose={handleCloseNote}
          onUpdate={updateNote}
          onDelete={deleteNote}
        />
      )}
    </div>
  );
};

export default BoardNotes;
