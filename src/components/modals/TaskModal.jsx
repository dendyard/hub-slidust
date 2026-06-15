import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useData, API_BASE, resolveUploadUrl, authFetch } from '../../context/DataContext';
import { X, Plus, Trash2, MessageSquare, Send, MoreHorizontal, UploadCloud, Paperclip, ChevronDown, ChevronUp, UserPlus, FolderOpen, ExternalLink, History, Link2, Check } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import MentionTextarea, { nameToHandle, extractMentionHandles } from '../ui/MentionTextarea';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import styles from './Modal.module.css';
import DeleteTaskModal from './DeleteTaskModal';
import TaskHistoryModal from './TaskHistoryModal';
import { linkifyHtml } from '../../utils/linkify';
import noActivityImg from '../../assets/noactivity.png';


const SUBTASK_STATUSES = [
  { value: 0, label: 'Backlog',     color: '#94a3b8' },
  { value: 2, label: 'On Progress', color: '#6366f1' },
  { value: 1, label: 'Done',        color: '#22c55e' },
];

// Returns true when a Quill/HTML description string has no visible content
const isDescriptionEmpty = (desc) => {
  if (!desc) return true;
  return desc.replace(/<[^>]*>/g, '').trim() === '';
};


// Render a comment message, highlighting @mentions and making URLs clickable
const URL_RE = /(https?:\/\/[^\s]+)/g;
const TOKEN_RE = /(https?:\/\/[^\s]+|@[\w]+)/g;

const renderMessage = (message) => {
  const parts = message.split(TOKEN_RE);
  return parts.map((part, i) => {
    if (URL_RE.test(part)) {
      URL_RE.lastIndex = 0;
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={styles.commentLink}>{part}</a>;
    }
    if (/^@[\w]+$/.test(part)) {
      return <span key={i} className={styles.mentionChip}>{part}</span>;
    }
    return part;
  });
};

const TaskModal = ({ taskId, initialStatus, initialData, onClose, readOnly = false, onOpenInProject }) => {
  const { currentUser, tasks, users, projects, projectMembers, activeProjectId, addTask, updateTask, deleteTask, patchTask, pollTasks, getProjectWorkflow } = useData();
  const existingTask = taskId ? tasks.find(t => t.id === taskId) : null;
  const taskProjectId = existingTask?.projectId ?? activeProjectId;
  const projectUsers = users.filter(u => projectMembers.some(pm => pm.project_id === taskProjectId && pm.user_id === u.id));
  const defaultStageId = initialStatus || getProjectWorkflow(taskProjectId)[0]?.id || '';
  const [formData, setFormData] = useState(existingTask || {
    title:       initialData?.title       || '',
    description: initialData?.description || '',
    status:      initialData?.status      || defaultStageId,
    priority:    'Low',
    assignee:    currentUser?.id          || '',
    subtasks:    initialData?.subtasks    || [],
    start_date:  '',
    due_date:    ''
  });

  const [newSubtask, setNewSubtask] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editingSubtaskText, setEditingSubtaskText] = useState('');
  const [subtaskAssigneeSearch, setSubtaskAssigneeSearch] = useState({}); // {subId: searchText}
  const [openAssigneeMenu, setOpenAssigneeMenu] = useState(null); // subId
  const [assigneeDropdownPos, setAssigneeDropdownPos] = useState({ top: 0, left: 0 });
  const [openSubStatusMenu, setOpenSubStatusMenu] = useState(null); // subId
  const [subStatusDropdownPos, setSubStatusDropdownPos] = useState({ top: 0, left: 0 });

  const [mainAssigneeSearch, setMainAssigneeSearch] = useState('');
  const [openMainAssigneeMenu, setOpenMainAssigneeMenu] = useState(false);
  const [openStatusMenu, setOpenStatusMenu] = useState(false);
  const [openPriorityMenu, setOpenPriorityMenu] = useState(false);
  
  const [createdTempId, setCreatedTempId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);
  const pendingCloseRef = useRef(false);

  // Complete date manual edit
  const [showCompletedConfirm, setShowCompletedConfirm] = useState(false);
  const [pendingCompletedDate, setPendingCompletedDate] = useState('');
  const skipDirtyOnceRef = useRef(false);

  const handleCompletedDateChange = (newDate) => {
    setPendingCompletedDate(newDate);
    setShowCompletedConfirm(true);
  };
  const handleConfirmCompletedDate = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!existingTask || !pendingCompletedDate) return;
    const newCompletedAt = pendingCompletedDate + ' 00:00:00';
    // Targeted API call updates completed_at only, without running the full task save.
    const res = await authFetch(`${API_BASE}/tasks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'patch_completed_at', id: existingTask.id, completedAt: newCompletedAt }),
    });
    if (res.ok) {
      patchTask(existingTask.id, { completedAt: newCompletedAt });
      skipDirtyOnceRef.current = true;
      setFormData(prev => ({ ...prev, completedAt: newCompletedAt }));
      setPendingCompletedDate('');
      setShowCompletedConfirm(false);
    }
  };
  const handleCancelCompletedDate = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setPendingCompletedDate('');
    setShowCompletedConfirm(false);
  };
  
  const [comments, setComments] = useState([]);
  const [newCommentId, setNewCommentId] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [activeCommentMenuId, setActiveCommentMenuId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null); // comment object | null
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const [attachments, setAttachments] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState(null);
  const [descEditing, setDescEditing] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const descContentRef = useRef(null);
  const isHydratingTaskRef    = useRef(false);
  const isImmediateSavingRef  = useRef(false);
  const isDirtyRef            = useRef(false);

  const canDeleteTask = currentUser?.role === 'admin' || currentUser?.role === 'manager' || existingTask?.created_by === currentUser?.id;

  const actualTaskId = existingTask ? existingTask.id : createdTempId;

  /* ── Task URL & copy link ── */
  // Served by the backend (PHP) since the frontend site is static nginx and can't run PHP.
  // API_BASE = ".../index.php/api" → strip trailing "/api" to reach the share route.
  const getTaskUrl = () => {
    const shareBase = API_BASE.replace(/\/api\/?$/, '');
    return `${shareBase}/share/${taskProjectId}?task=${actualTaskId}`;
  };

  const handleCopyLink = () => {
    if (!actualTaskId) return;
    navigator.clipboard.writeText(getTaskUrl()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ── Dynamic OG meta tags ── */
  useEffect(() => {
    if (!actualTaskId || !formData.title) return;
    const taskUrl   = getTaskUrl();
    const plainDesc = (formData.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 160);
    const prevTitle = document.title;

    const setMeta = (prop, content, isName = false) => {
      const sel = isName ? `meta[name="${prop}"]` : `meta[property="${prop}"]`;
      let el = document.querySelector(sel);
      if (!el) {
        el = document.createElement('meta');
        isName ? el.setAttribute('name', prop) : el.setAttribute('property', prop);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    document.title = `${formData.title} · Slidust`;
    setMeta('og:title',       formData.title);
    setMeta('og:description', plainDesc || 'View this task on Slidust');
    setMeta('og:url',         taskUrl);
    setMeta('og:type',        'article');
    setMeta('twitter:title',       formData.title,                      true);
    setMeta('twitter:description', plainDesc || 'View this task on Slidust', true);
    setMeta('twitter:card',        'summary',                           true);

    return () => {
      document.title = prevTitle;
    };
  }, [actualTaskId, formData.title, formData.description]);

  const titleRef = useRef(null);
  const quillRef  = useRef(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [formData.title]);

  useEffect(() => {
    if (descEditing) {
      setTimeout(() => quillRef.current?.getEditor()?.focus(), 0);
    }
  }, [descEditing]);

  // Detect if description needs collapse (> 500 words or rendered height > 500px)
  // useLayoutEffect fires before browser paint → no flash of full content before collapsing
  useLayoutEffect(() => {
    if (descEditing) return;
    const text = (formData.description || '').replace(/<[^>]*>/g, '').trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount > 500) { setDescOverflows(true); return; }
    if (descContentRef.current) {
      setDescOverflows(descContentRef.current.scrollHeight > 500);
    } else {
      setDescOverflows(false);
    }
  }, [formData.description, descEditing]);

  // Reset expanded state when opening a different task
  // (descOverflows is intentionally NOT reset here — useLayoutEffect re-checks it when formData.description changes)
  useEffect(() => {
    setDescExpanded(false);
  }, [existingTask?.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (previewAttachment) { setPreviewAttachment(null); return; }
      if (showDirtyConfirm) { setShowDirtyConfirm(false); return; }
      handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isDirty, showDirtyConfirm, previewAttachment]);

  // Keep isDirtyRef in sync so hydration effect can read current value without closure staleness
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // Mark dirty automatically when formData changes
  useEffect(() => {
    if (isHydratingTaskRef.current) {
      isHydratingTaskRef.current = false;
      return;
    }
    if (skipDirtyOnceRef.current) {
      skipDirtyOnceRef.current = false;
      return;
    }
    if (isImmediateSavingRef.current) return; // skip — subtask status already saving immediately
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    if (!readOnly && formData.title.trim().length > 0) {
      setIsDirty(true);
    }
  }, [formData]);

  useEffect(() => {
    if (!existingTask) return;
    // Skip hydration while user has unsaved edits — prevents background polling from
    // overwriting text the user is currently typing before auto-save fires.
    if (isDirtyRef.current) return;
    isHydratingTaskRef.current = true;
    setFormData(existingTask);
    setIsDirty(false);
    setIsInitialLoad(false);
  }, [existingTask]);

  // Fetch Attachments
  useEffect(() => {
    if (!actualTaskId) return;
    const fetchAtt = async () => {
      try {
        const res = await authFetch(`${API_BASE}/attachments?task_id=${actualTaskId}`);
        if (res.ok) {
          const data = await res.json();
          setAttachments(Array.isArray(data) ? data : []);
        } else {
          setAttachments([]);
        }
      } catch (e) {
         console.error("Failed to load attachments");
         setAttachments([]);
      }
    };
    fetchAtt();
  }, [actualTaskId]);

  const handleFileUpload = async (files) => {
    if (!actualTaskId || files.length === 0) return;
    setIsUploading(true);
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 20 * 1024 * 1024) {
            alert(`File ${file.name} is too large (>20MB)`);
            continue;
        }
        const fd = new FormData();
        fd.append('task_id', actualTaskId);
        fd.append('file', file);
        try {
            const res = await authFetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: fd
            });
            const data = await res.json();
            if (data && data.id) {
                setAttachments(p => [data, ...(Array.isArray(p) ? p : [])]);
                const task = tasks.find(t => t.id === actualTaskId);
                patchTask(actualTaskId, { attachmentCount: (task?.attachmentCount || 0) + 1 });
            } else if (data.error) {
                alert(data.error);
            }
        } catch (e) {
            alert("Upload failed for " + file.name);
        }
    }
    setIsUploading(false);
  };

  const handleDeleteAttachment = async (id) => {
    if(!window.confirm("Delete this attachment?")) return;
    try {
      const res = await authFetch(`${API_BASE}/attachments?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if(data.success) {
        setAttachments(p => (Array.isArray(p) ? p : []).filter(a => a.id !== id));
        const task = tasks.find(t => t.id === actualTaskId);
        patchTask(actualTaskId, { attachmentCount: Math.max(0, (task?.attachmentCount || 0) - 1) });
      }
    } catch(e) {}
  };

  useEffect(() => {
    if (!actualTaskId) return;
    const fetchComments = async () => {
      setIsLoadingComments(true);
      try {
        const res = await authFetch(`${API_BASE}/comments?task_id=${actualTaskId}`);
        if (res.ok) {
          const data = await res.json();
          setComments(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("Failed to load comments", e);
      } finally {
        setIsLoadingComments(false);
      }
    };
    fetchComments();
  }, [actualTaskId]);

  // Poll comments every 15s while modal is open
  useEffect(() => {
    if (!actualTaskId) return;
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      authFetch(`${API_BASE}/comments?task_id=${actualTaskId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (Array.isArray(data)) setComments(data);
        })
        .catch(() => {});
    };
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [actualTaskId]);

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const res = await authFetch(`${API_BASE}/comments?id=${commentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        if (actualTaskId) {
          const task = tasks.find(t => t.id === actualTaskId);
          patchTask(actualTaskId, { commentCount: Math.max(0, (task?.commentCount || 0) - 1) });
        }
      }
    } catch (e) {
      alert("Failed to delete comment");
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !actualTaskId) return;
    setIsSendingComment(true);

    // Resolve @handles → user IDs for mention notifications
    const handles    = extractMentionHandles(newComment);
    const mentionIds = users
      .filter(u => handles.includes(nameToHandle(u.name)) && u.id !== currentUser.id)
      .map(u => u.id);

    try {
      const res = await authFetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          task_id:     actualTaskId,
          user_id:     currentUser.id,
          message:     newComment,
          mention_ids: mentionIds,
        })
      });
      const data = await res.json();
      if (data && data.id) {
        setComments(prev => [...prev, data]);
        setNewCommentId(data.id);
        setTimeout(() => setNewCommentId(null), 1500);
        setNewComment('');
        const task = tasks.find(t => t.id === actualTaskId);
        patchTask(actualTaskId, {
          commentCount:        (task?.commentCount || 0) + 1,
          latestCommentAt:     new Date().toISOString(),
          latestCommentMessage: newComment,
          latestCommentBy:     currentUser?.name,
        });
      }
    } catch (e) {
      alert("Failed to send comment.");
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !actualTaskId || !replyingTo) return;
    setIsSendingReply(true);
    const handles    = extractMentionHandles(replyText);
    const mentionIds = users
      .filter(u => handles.includes(nameToHandle(u.name)) && u.id !== currentUser.id)
      .map(u => u.id);
    try {
      const res = await authFetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id:     actualTaskId,
          user_id:     currentUser.id,
          message:     replyText,
          mention_ids: mentionIds,
          parent_id:   replyingTo.id,
        }),
      });
      const data = await res.json();
      if (data?.id) {
        setComments(prev => [...prev, { ...data, parent_id: replyingTo.id }]);
        setNewCommentId(data.id);
        setTimeout(() => setNewCommentId(null), 1500);
        setReplyText('');
        setReplyingTo(null);
      }
    } catch {
      alert('Failed to send reply.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const performAutoSave = async () => {
    if (!formData.title.trim()) return;
    setIsAutoSaving(true);
    try {
      if (actualTaskId) {
        await updateTask({ ...formData, id: actualTaskId, projectId: taskProjectId });
        setIsDirty(false);
      } else {
        const created = await addTask({ ...formData, projectId: taskProjectId });
        if (created && created.id) setCreatedTempId(created.id);
        setIsDirty(false);
      }
    } finally {
      setIsAutoSaving(false);
      if (pendingCloseRef.current) {
        pendingCloseRef.current = false;
        setShowDirtyConfirm(false);
        pollTasks();
        onClose();
      }
    }
  };

  // Save subtask status change immediately — bypass the 1.5s debounce
  const saveSubtaskStatus = async (subId, newStatus) => {
    if (!actualTaskId || readOnly) return;
    const updatedSubtasks = formData.subtasks.map(s =>
      s.id === subId ? { ...s, isDone: newStatus } : s
    );
    const updated = { ...formData, subtasks: updatedSubtasks };
    isImmediateSavingRef.current = true;
    setFormData(updated);
    setIsAutoSaving(true);
    try {
      await updateTask({ ...updated, id: actualTaskId, projectId: taskProjectId });
    } finally {
      isImmediateSavingRef.current = false;
      setIsAutoSaving(false);
    }
  };

  // Save main task assignee change immediately — bypass the 1.5s debounce
  const saveAssignee = async (newAssigneeId) => {
    if (!actualTaskId || readOnly) return;
    const updated = { ...formData, assignee: newAssigneeId };
    isImmediateSavingRef.current = true;
    setFormData(updated);
    setIsAutoSaving(true);
    try {
      await updateTask({ ...updated, id: actualTaskId, projectId: taskProjectId });
    } finally {
      isImmediateSavingRef.current = false;
      setIsAutoSaving(false);
    }
  };

  // Save priority change immediately — bypass the 1.5s debounce
  const savePriority = async (newPriority) => {
    if (!actualTaskId || readOnly) return;
    const updated = { ...formData, priority: newPriority };
    isImmediateSavingRef.current = true;
    setFormData(updated);
    setIsAutoSaving(true);
    try {
      await updateTask({ ...updated, id: actualTaskId, projectId: taskProjectId });
    } finally {
      isImmediateSavingRef.current = false;
      setIsAutoSaving(false);
    }
  };

  // Debounce auto-save — paused while the complete-date confirm bar is open
  useEffect(() => {
    if (!isDirty) return;
    if (showCompletedConfirm) return;  // wait for user to confirm/cancel the date change
    const timer = setTimeout(() => {
      performAutoSave();
    }, 1500);
    return () => clearTimeout(timer);
  }, [isDirty, formData, actualTaskId, showCompletedConfirm]);

  const handleClose = () => {
    if (isDirty) {
      pendingCloseRef.current = true;
      setShowDirtyConfirm(true);
    } else {
      pollTasks();
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await performAutoSave();
    onClose();
  };

  const handleAddSubtask = () => {
    if (newSubtask.trim()) {
      setFormData(prev => ({
        ...prev,
        subtasks: [...(prev.subtasks || []), { id: `s${Date.now()}`, title: newSubtask, isDone: 0, assigneeId: null }]
      }));
      setNewSubtask('');
    }
  };

  const removeSubtask = (subId) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter(s => s.id !== subId)
    }));
  };

  const startEditSubtask = (sub) => {
    setEditingSubtaskId(sub.id);
    setEditingSubtaskText(sub.title);
  };

  const commitSubtaskEdit = (subId) => {
    const trimmed = editingSubtaskText.trim();
    if (trimmed) {
      setFormData(prev => ({
        ...prev,
        subtasks: prev.subtasks.map(s => s.id === subId ? { ...s, title: trimmed } : s)
      }));
    }
    setEditingSubtaskId(null);
    setEditingSubtaskText('');
  };

  const saveSubtaskAssignee = async (subId, userId) => {
    if (!actualTaskId || readOnly) return;
    const updatedSubtasks = formData.subtasks.map(s =>
      s.id === subId ? { ...s, assigneeId: userId } : s
    );
    const updated = { ...formData, subtasks: updatedSubtasks };
    isImmediateSavingRef.current = true;
    setFormData(updated);
    setIsAutoSaving(true);
    try {
      await updateTask({ ...updated, id: actualTaskId, projectId: taskProjectId });
    } finally {
      isImmediateSavingRef.current = false;
      setIsAutoSaving(false);
    }
  };

  const setSubtaskAssignee = (subId, userId) => {
    if (actualTaskId) {
      saveSubtaskAssignee(subId, userId);
    } else {
      setFormData(prev => ({
        ...prev,
        subtasks: prev.subtasks.map(s => s.id === subId ? { ...s, assigneeId: userId } : s)
      }));
    }
    setOpenAssigneeMenu(null);
    setSubtaskAssigneeSearch(prev => ({ ...prev, [subId]: '' }));
  };

  const getFilteredUsers = (subId) => {
    const query = (subtaskAssigneeSearch[subId] || '').toLowerCase();
    if (!query) return projectUsers;
    return projectUsers.filter(u => u.name.toLowerCase().includes(query));
  };

  const taskProject = projects.find(p => p.id === taskProjectId);
  const hasProjectAccess =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'manager' ||
    projectMembers.some(pm => pm.project_id === taskProjectId && pm.user_id === currentUser?.id);

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button type="button" onClick={handleClose} className={styles.floatCloseBtn}><X size={20} /></button>

        <div className={styles.splitBody}>
         <div className={styles.leftPane}>
          <form id="taskModalForm" onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '20px', height: '100%'}}>
           <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '20px'}}>

          {onOpenInProject && taskProject && hasProjectAccess && (
            <div className={styles.taskMeta}>
              <span className={styles.projectChip}>
                <FolderOpen size={13} />
                {taskProject.name}
              </span>
              <button
                type="button"
                className={styles.openInProjectBtn}
                onClick={() => onOpenInProject(taskProject.id)}
              >
                <ExternalLink size={12} />
                Open in Project
              </button>
            </div>
          )}

          <div className={styles.titleGroup}>
            <textarea
              ref={titleRef}
              required
              className={styles.titleInput}
              value={formData.title}
              onChange={e => !readOnly && setFormData({...formData, title: e.target.value})}
              placeholder="Task title..."
              rows={1}
              readOnly={readOnly}
            />
            {actualTaskId && (
              <button
                type="button"
                className={`${styles.copyLinkBtn} ${copied ? styles.copyLinkBtnDone : ''}`}
                onClick={handleCopyLink}
                title={copied ? 'Link copied!' : 'Copy task link'}
              >
                {copied ? <Check size={20} /> : <Link2 size={20} />}
              </button>
            )}
          </div>

          <div className={styles.formGroup}>
            <label>Description</label>
            {descEditing && !readOnly ? (
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={formData.description || ''}
                onChange={content => setFormData(prev => ({ ...prev, description: content }))}
                placeholder="Add description..."
                className={styles.wysiwyg}
                onBlur={() => setDescEditing(false)}
              />
            ) : (
              <>
                <div
                  className={`${styles.descPreview} ${descOverflows && !descExpanded ? styles.descPreviewCollapsed : ''}`}
                  onClick={() => !readOnly && setDescEditing(true)}
                >
                  {!isDescriptionEmpty(formData.description) ? (
                    <>
                      <div
                        ref={descContentRef}
                        className={`ql-snow ${styles.descContent}`}
                        dangerouslySetInnerHTML={{ __html: linkifyHtml(formData.description.replace(/&nbsp;/g, ' ')) }}
                      />
                      {descOverflows && !descExpanded && (
                        <div
                          className={styles.descFade}
                          onClick={e => { e.stopPropagation(); setDescExpanded(true); }}
                        />
                      )}
                    </>
                  ) : (
                    <span className={styles.descPlaceholder}>
                      {readOnly ? 'No description.' : 'Add description...'}
                    </span>
                  )}
                </div>
                {descOverflows && !isDescriptionEmpty(formData.description) && (
                  <button
                    type="button"
                    className={styles.descToggleBtn}
                    onClick={() => setDescExpanded(v => !v)}
                  >
                    {descExpanded
                      ? <><ChevronUp size={13} /> Show less</>
                      : <><ChevronDown size={13} /> Show more</>
                    }
                  </button>
                )}
              </>
            )}
          </div>

          <div className={styles.fieldRow}>
            {/* ── Status ── */}
            {(() => {
              const stages = getProjectWorkflow(taskProjectId);
              const currentStage = stages.find(s => s.id === formData.status);
              return (
                <div className={styles.fieldGroup}>
                  <label>Status</label>
                  <div className={styles.pillWrapper}>
                    <button
                      type="button"
                      className={styles.pillTrigger}
                      onClick={() => { if (readOnly) return; setOpenStatusMenu(v => !v); setOpenPriorityMenu(false); setOpenMainAssigneeMenu(false); }}
                      disabled={readOnly}
                    >
                      {currentStage && <span className={styles.pillDot} style={{ background: currentStage.color }} />}
                      <span>{currentStage?.name || 'Select…'}</span>
                      <ChevronDown size={13} className={styles.pillChevron} />
                    </button>
                    {openStatusMenu && (
                      <div className={styles.pillDropdown}>
                        {stages.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            className={`${styles.pillOption} ${formData.status === s.id ? styles.pillOptionActive : ''}`}
                            onMouseDown={() => { setFormData(f => ({...f, status: s.id})); setOpenStatusMenu(false); }}
                          >
                            <span className={styles.pillDot} style={{ background: s.color }} />
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Priority ── */}
            {(() => {
              const PRIORITIES = [
                { value: 'Low',    color: '#22c55e' },
                { value: 'Medium', color: '#f59e0b' },
                { value: 'High',   color: '#ef4444' },
              ];
              const current = PRIORITIES.find(p => p.value === formData.priority) || PRIORITIES[0];
              return (
                <div className={styles.fieldGroup}>
                  <label>Priority</label>
                  <div className={styles.pillWrapper}>
                    <button
                      type="button"
                      className={styles.pillTrigger}
                      onClick={() => { if (readOnly) return; setOpenPriorityMenu(v => !v); setOpenStatusMenu(false); setOpenMainAssigneeMenu(false); }}
                      disabled={readOnly}
                    >
                      <span className={styles.pillDot} style={{ background: current.color }} />
                      <span>{current.value}</span>
                      <ChevronDown size={13} className={styles.pillChevron} />
                    </button>
                    {openPriorityMenu && (
                      <div className={styles.pillDropdown}>
                        {PRIORITIES.map(p => (
                          <button
                            key={p.value}
                            type="button"
                            className={`${styles.pillOption} ${formData.priority === p.value ? styles.pillOptionActive : ''}`}
                            onMouseDown={() => { savePriority(p.value); setOpenPriorityMenu(false); }}
                          >
                            <span className={styles.pillDot} style={{ background: p.color }} />
                            {p.value}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Assignee ── */}
            {(() => {
              const assignee = users.find(u => u.id === formData.assignee);
              const filtered = projectUsers.filter(u =>
                !mainAssigneeSearch || u.name.toLowerCase().includes(mainAssigneeSearch.toLowerCase())
              );
              return (
                <div className={styles.fieldGroup}>
                  <label>Assignee</label>
                  <div className={styles.pillWrapper}>
                    <button
                      type="button"
                      className={styles.pillTrigger}
                      onClick={() => { if (readOnly) return; setOpenMainAssigneeMenu(v => !v); setOpenStatusMenu(false); setOpenPriorityMenu(false); setMainAssigneeSearch(''); }}
                      disabled={readOnly}
                    >
                      {assignee
                        ? <><UserAvatar user={assignee} size={18} /><span>{assignee.name}</span></>
                        : <span className={styles.pillPlaceholder}>Unassigned</span>
                      }
                      <ChevronDown size={13} className={styles.pillChevron} />
                    </button>
                    {openMainAssigneeMenu && (
                      <div className={styles.pillDropdown}>
                        <div className={styles.pillSearch}>
                          <input
                            type="text"
                            autoFocus
                            placeholder="Search…"
                            value={mainAssigneeSearch}
                            onChange={e => setMainAssigneeSearch(e.target.value)}
                            className={styles.pillSearchInput}
                          />
                        </div>
                        <button
                          type="button"
                          className={`${styles.pillOption} ${!formData.assignee ? styles.pillOptionActive : ''}`}
                          onMouseDown={() => { saveAssignee(''); setOpenMainAssigneeMenu(false); }}
                        >
                          <span className={styles.pillPlaceholder}>Unassigned</span>
                        </button>
                        {filtered.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            className={`${styles.pillOption} ${formData.assignee === u.id ? styles.pillOptionActive : ''}`}
                            onMouseDown={() => { saveAssignee(u.id); setOpenMainAssigneeMenu(false); }}
                          >
                            <UserAvatar user={u} size={20} />
                            {u.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label>Start Date</label>
              <input
                type="date"
                value={formData.start_date || ''}
                onChange={e => setFormData({...formData, start_date: e.target.value})}
                disabled={readOnly}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Due Date</label>
              <input
                type="date"
                value={formData.due_date || ''}
                onChange={e => setFormData({...formData, due_date: e.target.value})}
                disabled={readOnly}
              />
            </div>
            {formData.completedAt && (
              <div className={styles.formGroup}>
                <label>Complete Date</label>
                <input
                  type="date"
                  value={pendingCompletedDate || formData.completedAt.split(/[ T]/)[0]}
                  onChange={e => handleCompletedDateChange(e.target.value)}
                  className={styles.completedDateInput}
                  disabled={readOnly}
                />
              </div>
            )}
          </div>
          {showCompletedConfirm && (
            <div className={styles.completedConfirmBar}>
              <span>Are you sure you want to change the completion date?</span>
              <div className={styles.completedConfirmActions}>
                <button type="button" className={styles.completedConfirmYes} onClick={handleConfirmCompletedDate}>Yes, change it</button>
                <button type="button" className={styles.completedConfirmNo} onClick={handleCancelCompletedDate}>Cancel</button>
              </div>
            </div>
          )}

          <div className={styles.formGroup}>
            <label>Subtasks</label>
            <div className={styles.subtaskList}>
              {[...(formData.subtasks || [])].sort((a, b) => {
                if (!a.started_at && !b.started_at) return 0;
                if (!a.started_at) return 1;
                if (!b.started_at) return -1;
                return new Date(a.started_at) - new Date(b.started_at);
              }).map(sub => {
                const subtaskAssignee = users.find(u => u.id === sub.assigneeId);
                const filteredUsers = getFilteredUsers(sub.id);

                return (
                  <div key={sub.id} className={styles.subtaskItem}>
                    <div className={styles.subtaskRowMain}>
                      {editingSubtaskId === sub.id ? (
                        <input
                          type="text"
                          className={styles.subtaskEditInput}
                          value={editingSubtaskText}
                          autoFocus
                          onChange={e => setEditingSubtaskText(e.target.value)}
                          onBlur={() => commitSubtaskEdit(sub.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitSubtaskEdit(sub.id); }
                            if (e.key === 'Escape') { setEditingSubtaskId(null); }
                          }}
                        />
                      ) : (
                        <span
                          className={`${sub.isDone === 1 ? styles.strike : ''} ${styles.subtaskTitle}`}
                          onClick={() => !readOnly && startEditSubtask(sub)}
                        >{sub.title}</span>
                      )}
                    </div>

                    {/* Subtask Status Dropdown */}
                    {(() => {
                      const st = SUBTASK_STATUSES.find(s => s.value === sub.isDone) || SUBTASK_STATUSES[0];
                      return (
                        <div className={styles.subStatusWrap}>
                          <button
                            type="button"
                            className={styles.subStatusBtn}
                            style={{ background: st.color, borderColor: st.color, color: '#fff' }}
                            disabled={readOnly}
                            onClick={(e) => {
                              if (readOnly) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              setSubStatusDropdownPos({ top: rect.bottom + 4, left: rect.left });
                              setOpenSubStatusMenu(openSubStatusMenu === sub.id ? null : sub.id);
                            }}
                            onBlur={() => setTimeout(() => setOpenSubStatusMenu(null), 150)}
                          >
                            {st.label}
                            <ChevronDown size={11} />
                          </button>
                          {openSubStatusMenu === sub.id && (
                            <div
                              className={styles.subStatusDropdown}
                              style={{ position: 'fixed', top: subStatusDropdownPos.top, left: subStatusDropdownPos.left, zIndex: 9999 }}
                            >
                              {SUBTASK_STATUSES.map(opt => (
                                <div
                                  key={opt.value}
                                  className={`${styles.subStatusOption} ${sub.isDone === opt.value ? styles.subStatusOptionActive : ''}`}
                                  style={sub.isDone === opt.value ? { color: opt.color } : {}}
                                  onMouseDown={() => {
                                    saveSubtaskStatus(sub.id, opt.value);
                                    setOpenSubStatusMenu(null);
                                  }}
                                >
                                  {opt.label}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Assignee Avatar Picker */}
                    <div className={styles.avatarPickerWrap}>
                      <button
                        type="button"
                        className={styles.avatarPickerBtn}
                        title={subtaskAssignee ? subtaskAssignee.name : 'Assign user'}
                        disabled={readOnly}
                        onClick={(e) => {
                          if (readOnly) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          setAssigneeDropdownPos({ top: rect.bottom + 4, left: rect.left });
                          setOpenAssigneeMenu(openAssigneeMenu === sub.id ? null : sub.id);
                          setSubtaskAssigneeSearch(prev => ({ ...prev, [sub.id]: '' }));
                        }}
                      >
                        {subtaskAssignee
                          ? <UserAvatar user={subtaskAssignee} size={26} />
                          : <span className={styles.avatarPickerEmpty}><UserPlus size={13} /></span>
                        }
                      </button>
                      {!readOnly && sub.assigneeId && openAssigneeMenu !== sub.id && (
                        <button
                          type="button"
                          className={styles.avatarUnassignBtn}
                          onClick={() => setSubtaskAssignee(sub.id, null)}
                          title="Remove assignee"
                        >
                          <X size={9} />
                        </button>
                      )}
                      {openAssigneeMenu === sub.id && (
                        <div
                          className={styles.autocompleteDropdown}
                          style={{ position: 'fixed', top: assigneeDropdownPos.top, left: assigneeDropdownPos.left, zIndex: 9999 }}
                        >
                          <div style={{ padding: '4px 4px 2px' }}>
                            <input
                              type="text"
                              ref={el => el && el.focus({ preventScroll: true })}
                              className={styles.pillSearchInput}
                              placeholder="Search..."
                              value={subtaskAssigneeSearch[sub.id] ?? ''}
                              onChange={e => setSubtaskAssigneeSearch(prev => ({ ...prev, [sub.id]: e.target.value }))}
                              onBlur={() => setTimeout(() => setOpenAssigneeMenu(null), 150)}
                            />
                          </div>
                          {filteredUsers.length === 0 && (
                            <div className={styles.autocompleteItem} style={{ color: 'var(--text-muted)' }}>Tidak ditemukan</div>
                          )}
                          {filteredUsers.map(u => (
                            <div
                              key={u.id}
                              className={styles.autocompleteItem}
                              onMouseDown={() => setSubtaskAssignee(sub.id, u.id)}
                            >
                              <UserAvatar user={u} size={20} />
                              {u.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {!readOnly && (
                      <button type="button" onClick={() => setConfirmDeleteSubId(sub.id)} className={styles.deleteSubBtn}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {!readOnly && (
              <div className={styles.addSubtask}>
                <input
                  type="text"
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  placeholder="New subtask..."
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                />
                <button type="button" onClick={handleAddSubtask}><Plus size={16} /></button>
              </div>
            )}
          </div>

           {/* Attachments Section */}
           {actualTaskId && (
             <div className={styles.formGroup}>
               <label>Attachments</label>
               {!readOnly && (
               <div
                 className={`${styles.dropzone} ${isDragOver ? styles.dragOver : ''}`}
                 onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                 onDragLeave={() => setIsDragOver(false)}
                 onDrop={e => {
                   e.preventDefault();
                   setIsDragOver(false);
                   if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                     handleFileUpload(e.dataTransfer.files);
                   }
                 }}
                 onClick={() => document.getElementById('fileUploadInput').click()}
               >
                 <UploadCloud size={24} />
                 <span>Click or drag files here to attach</span>
                 {isUploading && <span style={{fontSize: '0.8rem', color: 'var(--color-primary)'}}>Uploading...</span>}
                 <input
                   id="fileUploadInput"
                   type="file"
                   multiple
                   style={{display: 'none'}}
                   accept="image/*,video/*"
                   onChange={e => handleFileUpload(e.target.files)}
                 />
               </div>
               )}
               
               {Array.isArray(attachments) && attachments.length > 0 && (
                 <div className={styles.attachmentsGrid}>
                   {attachments.map(att => {
                     const isImage = att.file_type.startsWith('image/');
                     const isVideo = att.file_type.startsWith('video/');
                     const path = resolveUploadUrl(att.file_path);
                     
                     return (
                       <div 
                         key={att.id} 
                         className={styles.attachmentThumbnail}
                         onClick={() => setPreviewAttachment(att)}
                       >
                         {isImage && <img src={path} alt={att.file_name} />}
                         {isVideo && <video src={path} autoPlay loop muted />}
                         {!isImage && !isVideo && <Paperclip size={20} />}
                         
                         {!readOnly && (
                           <button
                             type="button"
                             onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(att.id); }}
                             className={styles.attachmentDelete}
                           >
                             <X size={12} />
                           </button>
                         )}
                       </div>
                     );
                   })}
                 </div>
               )}
             </div>
           )}

           </div>
            
           <div className={styles.footer} style={{marginTop: 'auto', borderTop: '1px solid var(--border-color)', padding: '16px 0 0 0', background: 'transparent'}}>
             {!readOnly && existingTask && canDeleteTask && (
               <button
                 type="button"
                 className={styles.deleteBtn}
                 onClick={() => setShowDeleteModal(true)}
               >
                 Delete Task
               </button>
             )}
             <div style={{ flex: 1 }}></div>
             {!readOnly && isAutoSaving && (
               <span className={styles.autoSavePill}>
                 <span className={styles.spinner} />
                 Saving...
               </span>
             )}
             <button type="button" onClick={handleClose} className={styles.cancelBtn}>Close</button>
           </div>
           {existingTask?.createdByName && (
             <span className={styles.createdBy}>Created by {existingTask.createdByName}</span>
           )}
          </form>
         </div>

         <div className={`${styles.rightPane} ${commentsOpen ? styles.rightPaneOpen : ''}`}>
           <div className={styles.commentsContainer}>
             <button
               type="button"
               className={styles.commentsHeader}
               onClick={() => setCommentsOpen(v => !v)}
             >
               <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <MessageSquare size={16} style={{display: 'inline', verticalAlign: 'text-bottom'}} />
                 Activity & Comments
                 {comments.length > 0 && (
                   <span className={styles.commentCount}>{comments.length}</span>
                 )}
                 {actualTaskId && (
                   <button
                     type="button"
                     className={styles.seeHistoryBtn}
                     onClick={e => { e.stopPropagation(); setShowHistory(true); }}
                     title="See History"
                   >
                     <History size={12} />
                     See History
                   </button>
                 )}
               </span>
               <span className={styles.commentsToggleIcon}>
                 {commentsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
               </span>
             </button>
             
             <div className={styles.commentsList}>
               {!actualTaskId ? (
                 <div style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px', fontSize: '0.9rem'}}>Save the task first to add comments.</div>
               ) : isLoadingComments ? (
                 <div className={styles.commentsLoading}>
                   {[1,2,3].map(i => (
                     <div key={i} className={styles.skeletonBubble}>
                       <div className={styles.skeletonAvatar} />
                       <div className={styles.skeletonLines}>
                         <div className={styles.skeletonLine} style={{width: '40%'}} />
                         <div className={styles.skeletonLine} style={{width: '80%'}} />
                         <div className={styles.skeletonLine} style={{width: '60%'}} />
                       </div>
                     </div>
                   ))}
                 </div>
               ) : comments.length === 0 ? (
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8 }}>
                  <img src={noActivityImg} alt="" style={{ width: 150, opacity: 0.85 }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No activity yet.</span>
                </div>
               ) : (() => {
                 const topLevel = [...comments]
                   .filter(c => !c.parent_id)
                   .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                 const getReplies = (parentId) => [...comments]
                   .filter(c => String(c.parent_id) === String(parentId))
                   .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                 const renderComment = (c, parent = null, hasReplies = false) => (
                   <div key={c.id} className={`${styles.commentBubble} ${parent ? styles.replyBubble : ''} ${hasReplies ? styles.commentBubbleHasReplies : ''} ${c.id === newCommentId ? styles.commentGlow : ''}`}>
                     <div className={styles.avatarCol}>
                       <UserAvatar user={{ avatar: c.user_avatar, name: c.user_name }} size={parent ? 24 : 32} />
                       {hasReplies && <div className={styles.threadLine} />}
                     </div>
                     <div className={styles.commentContent}>
                       <div style={{display:'flex', alignItems:'baseline', gap:'8px'}}>
                         <span className={styles.commentAuthor}>{c.user_name || 'Unknown'}</span>
                         <span className={styles.commentTime}>
                           {new Date(c.created_at).toLocaleString('id-ID', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                         </span>
                       </div>
                       <div className={styles.commentText}>{renderMessage(c.message)}</div>
                       <div className={styles.commentMeta}>
                         {!parent && actualTaskId && !readOnly && (
                           <button className={styles.replyBtn} onClick={() => { setReplyingTo(replyingTo?.id === c.id ? null : c); setReplyText(''); }}>
                             Reply
                           </button>
                         )}
                         <div style={{flex: 1}} />
                         {(currentUser.id === c.user_id || currentUser.role === 'admin') && (
                           <div style={{position: 'relative'}} onClick={e => e.stopPropagation()}>
                             <button className={styles.commentOptionsBtn} onClick={() => setActiveCommentMenuId(activeCommentMenuId === c.id ? null : c.id)}>
                               <MoreHorizontal size={14} />
                             </button>
                             {activeCommentMenuId === c.id && (
                               <div className={styles.commentOptionsMenu}>
                                 <button className={styles.commentDeleteBtn} onClick={() => { setActiveCommentMenuId(null); handleDeleteComment(c.id); }}>
                                   <Trash2 size={12} /> Delete
                                 </button>
                               </div>
                             )}
                           </div>
                         )}
                       </div>
                     </div>
                   </div>
                 );

                 return topLevel.map(c => {
                   const replies = getReplies(c.id);
                   const isReplying = replyingTo?.id === c.id;
                   const hasReplies = replies.length > 0 || isReplying;
                   return (
                     <div key={c.id} className={styles.commentThread}>
                       {renderComment(c, null, hasReplies)}
                       {(replies.length > 0 || isReplying) && (
                         <div className={styles.replyThread}>
                           {replies.map(r => renderComment(r, c))}
                           {isReplying && (
                             <div className={styles.replyInputRow}>
                               <UserAvatar user={currentUser} size={24} />
                               <div className={styles.replyInputBox}>
                                 <MentionTextarea
                                   className={styles.commentTextarea}
                                   placeholder="Write a reply..."
                                   value={replyText}
                                   onChange={setReplyText}
                                   onSend={handleSendReply}
                                   disabled={isSendingReply}
                                   users={projectUsers}
                                   autoFocus
                                 />
                                 <div className={styles.replyInputActions}>
                                   <button type="button" className={styles.replyCancelBtn} onClick={() => { setReplyingTo(null); setReplyText(''); }}>
                                     Cancel
                                   </button>
                                   <button type="button" className={styles.commentSendBtn} onClick={handleSendReply} disabled={!replyText.trim() || isSendingReply}>
                                     <Send size={13} /> Reply
                                   </button>
                                 </div>
                               </div>
                             </div>
                           )}
                         </div>
                       )}
                     </div>
                   );
                 });
               })()
               }
             </div>

             <div className={styles.commentInputArea}>
               <UserAvatar user={currentUser} size={32} />
               <div className={styles.commentInputBox}>
                 <MentionTextarea
                   className={styles.commentTextarea}
                   placeholder={actualTaskId ? "Add a comment... (type @ to mention)" : "Save the task first to add comments."}
                   value={newComment}
                   onChange={setNewComment}
                   onSend={handleSendComment}
                   disabled={!actualTaskId || isSendingComment}
                   users={projectUsers}
                 />
                 <button
                   type="button"
                   onClick={handleSendComment}
                   disabled={!newComment.trim() || isSendingComment || !actualTaskId}
                   className={styles.commentSendBtnFloat}
                 >
                   <Send size={15} strokeWidth={2.2} />
                 </button>
               </div>
             </div>
           </div>
         </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteTaskModal
          taskTitle={formData.title}
          onConfirm={async () => { await deleteTask(taskId); onClose(); }}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {showHistory && (
        <div onClick={e => e.stopPropagation()}>
          <TaskHistoryModal
            task={existingTask}
            comments={comments}
            users={users}
            onClose={() => setShowHistory(false)}
          />
        </div>
      )}

      {confirmDeleteSubId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setConfirmDeleteSubId(null)}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--border-radius-sm)', padding: '28px 32px', maxWidth: '380px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>Delete Subtask</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
              Are you sure you want to delete this subtask? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDeleteSubId(null)}
                style={{ padding: '8px 18px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-main)' }}>
                Cancel
              </button>
              <button onClick={() => { removeSubtask(confirmDeleteSubId); setConfirmDeleteSubId(null); }}
                style={{ padding: '8px 18px', borderRadius: 'var(--border-radius-sm)', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dirty-close confirm */}
      {showDirtyConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowDirtyConfirm(false)}
        >
          <div
            style={{
              background: 'var(--bg-surface)', borderRadius: 12,
              padding: '28px 32px', width: 340,
              boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', margin: 0 }}>
              Autosave Progressing…
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Your changes are being saved. Close now and they may not be saved.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                  background: 'var(--color-danger, #ef4444)', color: '#fff',
                  fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                }}
              >Close Without Saving</button>
              <button
                onClick={() => { pendingCloseRef.current = false; setShowDirtyConfirm(false); }}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 8,
                  border: '1px solid var(--border-color)', background: 'transparent',
                  color: 'var(--text-main)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview */}
      {previewAttachment && (
        <div className={styles.previewOverlay} onClick={(e) => { e.stopPropagation(); setPreviewAttachment(null); }}>
          <div className={styles.previewContent} onClick={e => e.stopPropagation()}>
            <button className={styles.previewCloseBtn} onClick={() => setPreviewAttachment(null)}>
              <X size={20} />
            </button>
            {previewAttachment.file_type.startsWith('image/') && (
              <img src={resolveUploadUrl(previewAttachment.file_path)} alt="Preview" />
            )}
            {previewAttachment.file_type.startsWith('video/') && (
              <video src={resolveUploadUrl(previewAttachment.file_path)} controls autoPlay style={{maxWidth: '100%', maxHeight: '90vh'}} />
            )}
            {!previewAttachment.file_type.startsWith('image/') && !previewAttachment.file_type.startsWith('video/') && (
              <div style={{background: 'white', padding: '40px', borderRadius: '8px', textAlign: 'center'}}>
                <Paperclip size={48} color="var(--text-muted)" />
                <div style={{marginTop: '16px', color: 'black'}}>Preview not available</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskModal;
