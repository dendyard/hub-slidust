import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckSquare, FileText } from 'lucide-react';
import { API_BASE, authFetch, useData } from '../../context/DataContext';
import DustFlowIcon from '../ui/DustFlowIcon';
import searchKitImg from '../../assets/searchkit.png';
import styles from './GlobalSearch.module.css';

const GlobalSearch = ({ onClose, onTaskClick, onFlowClick, onNoteClick }) => {
  const { tasks, flows, currentUser } = useData();
  const [query, setQuery] = useState('');
  const [slidNotes, setSlidNotes] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch SlidNote documents (they live in a separate API from DataContext notes)
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentUser?.active_organization_id) {
      params.set('organization_id', currentUser.active_organization_id);
    }
    const qs = params.toString();
    authFetch(`${API_BASE}/slid_note${qs ? `?${qs}` : ''}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSlidNotes(data); })
      .catch(() => {});
  }, [currentUser?.id, currentUser?.active_organization_id]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const q = query.trim().toLowerCase();

  const matchedTasks = !q ? [] : tasks
    .filter(t => t.title?.toLowerCase().includes(q))
    .slice(0, 8);

  const matchedFlows = !q ? [] : flows
    .filter(f => f.name?.toLowerCase().includes(q))
    .slice(0, 5);

  const matchedNotes = !q ? [] : slidNotes
    .filter(n => {
      const isPrivate = (n.visibility || 'public') === 'private';
      if (isPrivate) {
        return n.owner_id === currentUser?.id ||
          (Array.isArray(n.editor_ids) && n.editor_ids.includes(currentUser?.id));
      }
      return true;
    })
    .filter(n => n.title?.toLowerCase().includes(q))
    .slice(0, 5);

  const hasResults = matchedTasks.length > 0 || matchedFlows.length > 0 || matchedNotes.length > 0;

  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>

        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder="Search tasks, dust flows, slid notes..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => setQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className={styles.results}>
          {!q && (
            <div className={styles.emptyState}>
              <img src={searchKitImg} alt="" className={styles.emptyStateImg} />
              <span>Start typing to search tasks, dust flows, or slid notes</span>
            </div>
          )}

          {q && !hasResults && (
            <div className={styles.emptyState}>
              <img src={searchKitImg} alt="" className={styles.emptyStateImg} />
              <span>No results for &ldquo;{query}&rdquo;</span>
            </div>
          )}

          {matchedTasks.length > 0 && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>
                <CheckSquare size={12} />
                Task
              </div>
              {matchedTasks.map(task => (
                <button
                  key={task.id}
                  className={styles.resultItem}
                  onClick={() => { onTaskClick(task.id); onClose(); }}
                >
                  <CheckSquare size={14} className={styles.resultIcon} />
                  <span className={styles.resultTitle}>{task.title}</span>
                </button>
              ))}
            </div>
          )}

          {matchedFlows.length > 0 && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>
                <DustFlowIcon size={12} />
                Dust Flow
              </div>
              {matchedFlows.map(flow => (
                <button
                  key={flow.id}
                  className={styles.resultItem}
                  onClick={() => { onFlowClick(flow.id); onClose(); }}
                >
                  <DustFlowIcon size={14} className={styles.resultIcon} />
                  <span className={styles.resultTitle}>{flow.name}</span>
                </button>
              ))}
            </div>
          )}

          {matchedNotes.length > 0 && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>
                <FileText size={12} />
                Slid Note
              </div>
              {matchedNotes.map(note => (
                <button
                  key={note.id}
                  className={styles.resultItem}
                  onClick={() => { onNoteClick(note.id); onClose(); }}
                >
                  <FileText size={14} className={styles.resultIcon} />
                  <span className={styles.resultTitle}>{note.title || 'Untitled Slid Note'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GlobalSearch;
