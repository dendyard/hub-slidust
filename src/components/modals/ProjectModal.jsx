import { useState } from 'react';
import { useData, API_BASE, authFetch } from '../../context/DataContext';
import { X, FolderPlus, UserPlus, UserMinus, ImageIcon, Upload } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import styles from './ProjectSettingsModal.module.css';

const ProjectModal = ({ onClose }) => {
  const { currentUser, users, addProject, toggleProjectMemberAPI, updateProject, organizationMembers } = useData();

  const [projectName, setProjectName] = useState('');
  const [iconFile,    setIconFile]    = useState(null);
  const [iconPreview, setIconPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-select the creator
  const [selectedIds, setSelectedIds] = useState(() =>
    currentUser?.role === 'manager' || currentUser?.role === 'admin'
      ? [currentUser.id]
      : []
  );

  const isSelected  = (id) => selectedIds.includes(id);
  const isCreator   = (id) => id === currentUser?.id;

  const toggleUser = (id) => {
    if (isCreator(id)) return;
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleIconChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const roleBadgeColor = (role) => {
    const map = { admin: '#ef4444', manager: '#f59e0b', member: '#6366f1', viewer: '#94a3b8' };
    return map[role] || '#94a3b8';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setIsSubmitting(true);

    try {
      const newProj = await addProject({ name: projectName.trim() });

      // Upload icon if chosen
      if (iconFile && newProj?.id) {
        const fd = new FormData();
        fd.append('project_id', newProj.id);
        fd.append('file', iconFile);
        const res  = await authFetch(`${API_BASE}/upload_project_icon`, { method: 'POST', body: fd });
        const data = await res.json();
        if (data.url) updateProject(newProj.id, { icon: data.url });
      }

      // Ensure creator is included
      const finalIds = [...new Set([
        ...(currentUser?.role === 'manager' || currentUser?.role === 'admin' ? [currentUser.id] : []),
        ...selectedIds,
      ])];

      await Promise.all(finalIds.map(uid => toggleProjectMemberAPI(newProj.id, uid, 'add')));

      onClose();
    } catch {
      alert('Gagal membuat project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [memberSearch, setMemberSearch] = useState('');

  // Only show users from the same organization as the current user
  const currentUserOrgId = organizationMembers.find(m => m.user_id === currentUser?.id)?.organization_id ?? null;
  const sameOrgUserIds = currentUserOrgId
    ? new Set(organizationMembers.filter(m => m.organization_id === currentUserOrgId).map(m => m.user_id))
    : null;
  const eligibleUsers = sameOrgUserIds ? users.filter(u => sameOrgUserIds.has(u.id)) : users;

  const selectedUsers   = eligibleUsers.filter(u => isSelected(u.id));
  const unselectedUsers = eligibleUsers.filter(u => !isSelected(u.id));
  const filteredUnselected = memberSearch.trim()
    ? unselectedUsers.filter(u =>
        u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        u.username.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : unselectedUsers;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <FolderPlus size={18} />
            <div>
              <h2>Create New Project</h2>
              <span>Fill in the basic information for the new project</span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className={styles.body}>

            {/* Project Info */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Project Info</h3>

              {/* Icon upload */}
              <div className={styles.iconRow}>
                {iconPreview
                  ? <img src={iconPreview} className={styles.projectIconPreview} alt="preview" />
                  : <div className={styles.projectIconPlaceholder}><ImageIcon size={22} /></div>
                }
                <label className={styles.uploadIconBtn}>
                  <Upload size={13} />
                  {iconPreview ? 'Change Icon' : 'Upload Icon'}
                  <input type="file" accept="image/*" onChange={handleIconChange} hidden />
                </label>
                {iconPreview && (
                  <button
                    type="button"
                    className={styles.iconActionBtn}
                    onClick={() => { setIconFile(null); setIconPreview(''); }}
                    title="Remove icon"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Project Name
                </label>
                <input
                  className={styles.nameInput}
                  type="text"
                  placeholder="e.g. Website Redesign Q3"
                  required
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  autoFocus
                  style={{ maxWidth: '100%' }}
                />
              </div>
            </div>

            {/* Members */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Assign Members</h3>
              <p className={styles.sectionDesc}>Choose who will have direct access to this project.</p>

              {/* Selected members */}
              <div className={styles.memberList}>
                {selectedUsers.map(user => (
                  <div key={user.id} className={styles.memberRow}>
                    <UserAvatar user={user} size={32} style={{ border: '2px solid var(--border-color)' }} />
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>
                        {user.name}
                        {isCreator(user.id) && <span className={styles.youTag}> (You)</span>}
                      </span>
                      <span className={styles.memberMeta}>
                        @{user.username}&nbsp;·&nbsp;
                        <span style={{ color: roleBadgeColor(user.role), fontWeight: 600 }}>{user.role}</span>
                      </span>
                    </div>
                    {!isCreator(user.id) && (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => toggleUser(user.id)}
                        title="Remove from project"
                      >
                        <UserMinus size={14} /> Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Unselected users */}
              {unselectedUsers.length > 0 && (
                <div className={styles.addMemberSection}>
                  <h4>Add Member</h4>
                  <div className={styles.memberSearchBox}>
                    <input
                      type="text"
                      placeholder="Search by name or username..."
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      className={styles.memberSearchInput}
                    />
                  </div>
                  <div className={styles.nonMemberList}>
                    {filteredUnselected.length === 0 && (
                      <p className={styles.empty}>No users found.</p>
                    )}
                    {filteredUnselected.map(user => (
                      <div key={user.id} className={styles.nonMemberRow}>
                        <UserAvatar user={user} size={32} style={{ border: '2px solid var(--border-color)' }} />
                        <div className={styles.memberInfo}>
                          <span className={styles.memberName}>{user.name}</span>
                          <span className={styles.memberMeta}>
                            @{user.username}&nbsp;·&nbsp;
                            <span style={{ color: roleBadgeColor(user.role), fontWeight: 600 }}>{user.role}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          className={styles.addBtn}
                          onClick={() => toggleUser(user.id)}
                          title="Add to project"
                        >
                          <UserPlus size={14} /> Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            flexShrink: 0,
            background: 'var(--bg-surface)',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '8px 18px',
                fontSize: '0.88rem',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !projectName.trim()}
              style={{
                background: 'var(--color-primary)',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 20px',
                fontSize: '0.88rem',
                fontWeight: 700,
                color: '#fff',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || !projectName.trim() ? 0.6 : 1,
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <FolderPlus size={14} />
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default ProjectModal;
