import React, { useState } from 'react';
import { useData, API_BASE, resolveUploadUrl, authFetch } from '../../context/DataContext';
import { X, Trash2, UserPlus, UserMinus, Settings2, AlertTriangle, Pencil, Check, Upload, ImageIcon, Plus, GripVertical } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import styles from './ProjectSettingsModal.module.css';

const PRESET_COLORS = [
  '#94a3b8', '#6366f1', '#8b5cf6', '#ec4899',
  '#f59e0b', '#22c55e', '#14b8a6', '#ef4444',
  '#3b82f6', '#f97316', '#06b6d4', '#84cc16'
];
const WORKFLOW_TYPES = ['BACKLOG', 'PROGRESS', 'DONE'];

const ProjectSettingsModal = ({ onClose }) => {
  const {
    currentUser, users, projects, activeProjectId,
    projectMembers, toggleProjectMemberAPI,
    deleteProject, setActiveProjectId, updateProject,
    getProjectWorkflow, addWorkflowStage, updateWorkflowStage, deleteWorkflowStage, reorderWorkflowStages,
    organizationMembers
  } = useData();

  const activeProject = projects.find(p => p.id === activeProjectId);
  const isOwner = currentUser?.id === activeProject?.owner_id;
  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const canEdit = isAdminOrManager || isOwner;

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(activeProject?.name || '');

  // ── Workflow state ──
  const stages = getProjectWorkflow(activeProjectId);
  const [wfEditingId,    setWfEditingId]    = useState(null);
  const [wfEditingName,  setWfEditingName]  = useState('');
  const [wfEditingColor, setWfEditingColor] = useState('');
  const [wfEditingType,  setWfEditingType]  = useState('BACKLOG');
  const [wfNewName,      setWfNewName]      = useState('');
  const [wfNewColor,     setWfNewColor]     = useState('#6366f1');
  const [wfNewType,      setWfNewType]      = useState('BACKLOG');
  const [wfIsAdding,     setWfIsAdding]     = useState(false);
  const [wfError,        setWfError]        = useState('');
  const [wfConfirmDelId, setWfConfirmDelId] = useState(null);
  const [wfDraggingId,   setWfDraggingId]   = useState(null);
  const [wfDragOverId,   setWfDragOverId]   = useState(null);

  const wfStartEdit = (stage) => {
    setWfEditingId(stage.id); setWfEditingName(stage.name);
    setWfEditingColor(stage.color); setWfEditingType(stage.type || 'BACKLOG');
    setWfError('');
  };
  const wfSaveEdit = async () => {
    if (!wfEditingName.trim()) { setWfError('Stage name cannot be empty.'); return; }
    const res = await updateWorkflowStage(wfEditingId, { name: wfEditingName.trim(), color: wfEditingColor, type: wfEditingType });
    if (res?.error) { setWfError(res.error); return; }
    setWfEditingId(null); setWfError('');
  };
  const wfHandleDelete = async (id) => {
    const res = await deleteWorkflowStage(id);
    if (res?.error) setWfError(res.error);
    setWfConfirmDelId(null);
  };
  const wfHandleAdd = async () => {
    if (!wfNewName.trim()) { setWfError('Stage name cannot be empty.'); return; }
    setWfIsAdding(true);
    await addWorkflowStage(activeProjectId, wfNewName.trim(), wfNewColor, wfNewType);
    setWfNewName(''); setWfNewColor('#6366f1'); setWfNewType('BACKLOG');
    setWfIsAdding(false); setWfError('');
  };
  const wfDragStart = (e, id) => { setWfDraggingId(id); e.dataTransfer.effectAllowed = 'move'; };
  const wfDragOver  = (e, id) => { e.preventDefault(); if (id !== wfDraggingId) setWfDragOverId(id); };
  const wfDrop      = (e, targetId) => {
    e.preventDefault();
    if (!wfDraggingId || wfDraggingId === targetId) return;
    const ids = stages.map(s => s.id);
    const from = ids.indexOf(wfDraggingId), to = ids.indexOf(targetId);
    ids.splice(from, 1); ids.splice(to, 0, wfDraggingId);
    reorderWorkflowStages(activeProjectId, ids);
    setWfDraggingId(null); setWfDragOverId(null);
  };
  const [iconUploading, setIconUploading] = useState(false);
  const [iconError, setIconError] = useState('');

  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIconUploading(true);
    setIconError('');
    const formData = new FormData();
    formData.append('project_id', activeProjectId);
    formData.append('file', file);
    try {
      const res = await authFetch(`${API_BASE}/upload_project_icon`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        updateProject(activeProjectId, { icon: data.url });
      } else {
        setIconError(data.error || 'Upload gagal.');
      }
    } catch {
      setIconError('Failed to reach server.');
    } finally {
      setIconUploading(false);
      e.target.value = '';
    }
  };

  // Members of current project
  const memberIds = projectMembers
    .filter(pm => pm.project_id === activeProjectId)
    .map(pm => pm.user_id);

  const activeOrgId = currentUser?.active_organization_id ?? null;
  const orgUserIds = activeOrgId
    ? new Set(organizationMembers.filter(m => m.organization_id === activeOrgId).map(m => m.user_id))
    : null;

  const members = users.filter(u => memberIds.includes(u.id));
  // Non-members: scoped to active org when one is set
  const nonMembers = users.filter(u =>
    !memberIds.includes(u.id) && (!orgUserIds || orgUserIds.has(u.id))
  );

  const [memberSearch, setMemberSearch] = useState('');
  const [memberLimit, setMemberLimit] = useState(5);
  const filteredNonMembers = memberSearch.trim()
    ? nonMembers.filter(u => u.name.toLowerCase().includes(memberSearch.toLowerCase()) || u.username.toLowerCase().includes(memberSearch.toLowerCase()))
    : nonMembers;

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleteInput !== 'delete') return;
    setIsDeleting(true);
    await deleteProject(activeProjectId);
    const remaining = projects.filter(p => p.id !== activeProjectId);
    if (remaining.length > 0) setActiveProjectId(remaining[0].id);
    onClose();
  };

  const handleToggleMember = async (userId, isMember) => {
    const action = isMember ? 'remove' : 'add';
    await toggleProjectMemberAPI(activeProjectId, userId, action);
  };

  const roleBadgeColor = (role) => {
    const map = { admin: '#ef4444', manager: '#f59e0b', member: '#6366f1', viewer: '#94a3b8' };
    return map[role] || '#94a3b8';
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Settings2 size={18} />
            <div>
              <h2>Project Settings</h2>
              <span>{activeProject?.name}</span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <div className={styles.body}>

          {/* Project Info Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Project Info</h3>

            {/* Icon */}
            <div className={styles.iconRow}>
              {activeProject?.icon
                ? <img src={resolveUploadUrl(activeProject.icon)} className={styles.projectIconPreview} alt="project icon" />
                : <div className={styles.projectIconPlaceholder}><ImageIcon size={22} /></div>
              }
              {canEdit && (
                <label className={`${styles.uploadIconBtn} ${iconUploading ? styles.uploading : ''}`}>
                  <Upload size={13} />
                  {iconUploading ? 'Uploading...' : 'Upload Icon'}
                  <input type="file" accept="image/*" onChange={handleIconUpload} hidden disabled={iconUploading} />
                </label>
              )}
              {iconError && <span className={styles.iconError}>{iconError}</span>}
            </div>

            <div className={styles.nameRow}>
              {editingName ? (
                <>
                  <input
                    className={styles.nameInput}
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        updateProject(activeProjectId, { name: nameInput.trim() });
                        setEditingName(false);
                      }
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    autoFocus
                  />
                  <button className={styles.iconActionBtn} onClick={() => {
                    updateProject(activeProjectId, { name: nameInput.trim() });
                    setEditingName(false);
                  }}>
                    <Check size={14} />
                  </button>
                  <button className={styles.iconActionBtn} onClick={() => setEditingName(false)}>
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.nameDisplay}>{activeProject?.name}</span>
                  {canEdit && (
                    <button className={styles.iconActionBtn} onClick={() => {
                      setNameInput(activeProject?.name || '');
                      setEditingName(true);
                    }}>
                      <Pencil size={13} />
                    </button>
                  )}
                </>
              )}
            </div>
            {activeProject?.owner_id && (
              <p className={styles.ownerMeta}>
                Owner: <strong>{users.find(u => u.id === activeProject.owner_id)?.name || 'Unknown'}</strong>
              </p>
            )}
          </div>

          {/* Members Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Project Members</h3>
            <p className={styles.sectionDesc}>Manage who has access to this project.</p>

            {/* Current Members */}
            <div className={styles.memberList}>
              {members.length === 0 && (
                <p className={styles.empty}>Belum ada member di project ini.</p>
              )}
              {members.slice(0, memberLimit).map(user => (
                <div key={user.id} className={styles.memberRow}>
                  <UserAvatar user={user} size={32} style={{ border: '2px solid var(--border-color)' }} />
                  <div className={styles.memberInfo}>
                    <span className={styles.memberName}>
                      {user.name}
                      {user.id === currentUser?.id && <span className={styles.youTag}> (You)</span>}
                    </span>
                    <span className={styles.memberMeta}>
                      @{user.username} &nbsp;·&nbsp;
                      <span style={{ color: roleBadgeColor(user.role), fontWeight: 600 }}>{user.role}</span>
                    </span>
                  </div>
                  {canEdit && user.id !== currentUser?.id && (
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleToggleMember(user.id, true)}
                      title="Remove from project"
                    >
                      <UserMinus size={14} />Remove
                    </button>
                  )}
                </div>
              ))}
              {members.length > memberLimit && (
                <button className={styles.loadMoreBtn} onClick={() => setMemberLimit(v => v + 5)}>
                  Load More ({members.length - memberLimit} remaining)
                </button>
              )}
            </div>

            {/* Add Members */}
            {canEdit && nonMembers.length > 0 && (
              <div className={styles.addMemberSection}>
                <h4>Add Members</h4>
                <div className={styles.memberSearchBox}>
                  <input
                    type="text"
                    placeholder="Search name or username..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className={styles.memberSearchInput}
                  />
                </div>
                <div className={styles.nonMemberList}>
                  {filteredNonMembers.length === 0 && (
                    <p className={styles.empty}>No users found.</p>
                  )}
                  {filteredNonMembers.map(user => (
                    <div key={user.id} className={styles.nonMemberRow}>
                      <UserAvatar user={user} size={32} style={{ border: '2px solid var(--border-color)' }} />
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{user.name}</span>
                        <span className={styles.memberMeta}>
                          @{user.username} &nbsp;·&nbsp;
                          <span style={{ color: roleBadgeColor(user.role), fontWeight: 600 }}>{user.role}</span>
                        </span>
                      </div>
                      <button
                        className={styles.addBtn}
                        onClick={() => handleToggleMember(user.id, false)}
                        title="Add to project"
                      >
                        <UserPlus size={14} />Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Workflow Section */}
          {canEdit && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Workflow Stages</h3>
              <p className={styles.sectionDesc}>Drag to reorder stages.</p>

              {wfError && <div className={styles.wfError}>{wfError}</div>}

              <div className={styles.wfStageList}>
                {stages.map(stage => (
                  <div
                    key={stage.id}
                    className={`${styles.wfStageRow} ${wfDragOverId === stage.id ? styles.wfDragTarget : ''} ${wfDraggingId === stage.id ? styles.wfDragging : ''}`}
                    draggable
                    onDragStart={e => wfDragStart(e, stage.id)}
                    onDragOver={e => wfDragOver(e, stage.id)}
                    onDrop={e => wfDrop(e, stage.id)}
                    onDragEnd={() => { setWfDraggingId(null); setWfDragOverId(null); }}
                  >
                    <GripVertical size={14} className={styles.wfGrip} />
                    <div className={styles.wfDot} style={{ background: wfEditingId === stage.id ? wfEditingColor : stage.color }} />

                    {wfEditingId === stage.id ? (
                      <div className={styles.wfEditRow}>
                        <input
                          className={styles.wfInput}
                          value={wfEditingName}
                          onChange={e => setWfEditingName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && wfSaveEdit()}
                          autoFocus
                        />
                        <select className={styles.wfTypeSelect} value={wfEditingType} onChange={e => setWfEditingType(e.target.value)}>
                          {WORKFLOW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className={styles.wfColorPicker}>
                          {PRESET_COLORS.map(c => (
                            <button key={c} className={`${styles.wfSwatch} ${wfEditingColor === c ? styles.wfSwatchActive : ''}`} style={{ background: c }} onClick={() => setWfEditingColor(c)} />
                          ))}
                        </div>
                        <button className={styles.wfSaveBtn} onClick={wfSaveEdit}><Check size={14} /></button>
                        <button className={styles.wfCancelBtn} onClick={() => setWfEditingId(null)}><X size={14} /></button>
                      </div>
                    ) : wfConfirmDelId === stage.id ? (
                      <div className={styles.wfConfirmRow}>
                        <span>Delete <strong>"{stage.name}"</strong>?</span>
                        <button className={styles.wfCancelBtn} onClick={() => setWfConfirmDelId(null)}>Cancel</button>
                        <button className={styles.wfDelConfirmBtn} onClick={() => wfHandleDelete(stage.id)}>Yes, Delete</button>
                      </div>
                    ) : (
                      <>
                        <span className={styles.wfStageName}>{stage.name}</span>
                        <span className={`${styles.wfTypeBadge} ${styles[`wfType${stage.type || 'BACKLOG'}`]}`}>{stage.type || 'BACKLOG'}</span>
                        <div className={styles.wfActions}>
                          <button className={styles.wfEditBtn} onClick={() => wfStartEdit(stage)}><Pencil size={13} /></button>
                          {stages.length > 1 && (
                            <button className={styles.wfDeleteBtn} onClick={() => setWfConfirmDelId(stage.id)}><Trash2 size={13} /></button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add stage */}
              <div className={styles.wfAddRow}>
                <div className={styles.wfDot} style={{ background: wfNewColor }} />
                <input
                  className={styles.wfInput}
                  placeholder="New stage name..."
                  value={wfNewName}
                  onChange={e => setWfNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && wfHandleAdd()}
                />
                <select className={styles.wfTypeSelect} value={wfNewType} onChange={e => setWfNewType(e.target.value)}>
                  {WORKFLOW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className={styles.wfColorPicker}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} className={`${styles.wfSwatch} ${wfNewColor === c ? styles.wfSwatchActive : ''}`} style={{ background: c }} onClick={() => setWfNewColor(c)} />
                  ))}
                </div>
                <button className={styles.wfAddBtn} onClick={wfHandleAdd} disabled={wfIsAdding}>
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          {canEdit && (
            <div className={styles.dangerSection}>
              <h3 className={styles.dangerTitle}>
                <AlertTriangle size={15} /> Danger Zone
              </h3>

              {!showDeleteConfirm ? (
                <div className={styles.dangerRow}>
                  <div>
                    <strong>Delete Project</strong>
                    <p>All tasks, comments, and project data will be permanently deleted.</p>
                  </div>
                  <button className={styles.dangerBtn} onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 size={14} /> Delete Project
                  </button>
                </div>
              ) : (
                <div className={styles.deleteConfirm}>
                  <p className={styles.deleteWarning}>
                    Type <code>delete</code> to confirm deletion of project <strong>"{activeProject?.name}"</strong>:
                  </p>
                  <div className={styles.deleteInputRow}>
                    <input
                      type="text"
                      value={deleteInput}
                      onChange={e => setDeleteInput(e.target.value)}
                      placeholder="delete"
                      autoFocus
                      className={styles.deleteInput}
                    />
                    <button
                      className={styles.confirmDeleteBtn}
                      onClick={handleDelete}
                      disabled={deleteInput !== 'delete' || isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Confirm'}
                    </button>
                    <button
                      className={styles.cancelDeleteBtn}
                      onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsModal;
