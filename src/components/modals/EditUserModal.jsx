import { useState } from 'react';
import { useData, API_BASE, authFetch } from '../../context/DataContext';
import { X, Key, Save, Eye, EyeOff, Camera } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import styles from './Modal.module.css';

const EditUserModal = ({ user, onClose }) => {
  const { currentUser, projects, projectMembers, positions, departments, organizations, organizationMembers, updateUserProfile, resetUserPassword, toggleProjectMemberAPI, updateUserAvatar, toggleOrganizationMember } = useData();

  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager';
  const canEdit = isAdminOrManager || currentUser.id === user.id;
  const canResetOthers = isAdminOrManager && currentUser.id !== user.id;
  const canResetOwn = currentUser.id === user.id;
  const canResetPassword = canResetOthers || canResetOwn;

  // Avatar upload
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarUploading(true);
    const formData = new FormData();
    formData.append('user_id', user.id);
    formData.append('file', file);
    try {
      const res = await authFetch(`${API_BASE}/upload_user_avatar`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) updateUserAvatar(user.id, data.url);
    } catch {}
    finally { setAvatarUploading(false); e.target.value = ''; }
  };

  // Profile state
  const [name,       setName]       = useState(user.name || '');
  const [username,   setUsername]   = useState(user.username || '');
  const [role,       setRole]       = useState(user.role || 'member');
  const [departmentId, setDepartmentId] = useState(user.department_id || '');
  const [positionId, setPositionId] = useState(user.position_id || '');
  const [isActive, setIsActive] = useState(user.is_active !== undefined ? Boolean(Number(user.is_active)) : true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Password state
  const [showPwForm, setShowPwForm] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setSaveMsg('');
    const updates = { name, username, department_id: departmentId || null, position_id: positionId || null };
    if (currentUser.role === 'admin' && currentUser.id !== user.id) {
      updates.is_active = isActive ? 1 : 0;
    }
    if (isAdminOrManager && currentUser.id !== user.id) {
      updates.role = role;
    }
    const res = await updateUserProfile(currentUser.id, user.id, updates);
    setSaving(false);
    setSaveMsg(res.error ? `❌ ${res.error}` : '✅ Profile saved successfully!');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPw.trim()) return;
    setPwSaving(true);
    setPwMsg('');
    const res = await resetUserPassword(currentUser.id, user.id, newPw);
    setPwSaving(false);
    if (res.error) {
      setPwMsg(`❌ ${res.error}`);
    } else {
      setPwMsg('✅ Password reset successfully!');
      setNewPw('');
      setTimeout(() => setShowPwForm(false), 1500);
    }
  };

  const handleToggleProjectAccess = async (projectId, hasAccess) => {
    const action = hasAccess ? 'remove' : 'add';
    const res = await toggleProjectMemberAPI(projectId, user.id, action);
    if (res.error) alert(res.error);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '860px' }}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <UserAvatar user={user} size={44} style={{ border: '2px solid var(--border-color)' }} />
              {canEdit && (
                <label style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: avatarUploading ? 'wait' : 'pointer',
                  opacity: 0, transition: 'opacity 0.15s',
                }} onMouseEnter={e => e.currentTarget.style.opacity = 1}
                   onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                  <Camera size={16} color="#fff" />
                  <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} disabled={avatarUploading} />
                </label>
              )}
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', marginBottom: 2 }}>Edit User</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{user.username}</span>
            </div>
          </div>
          <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
        </div>

        <div className={styles.body} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>

          {/* LEFT: Profile & Security */}
          <div style={{ padding: '24px', borderRight: '1px solid var(--border-color)' }}>
            {/* Profile Form */}
            <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profile Details</h3>
            <form onSubmit={handleSaveProfile} style={{ display: 'grid', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Full Name
                <input type="text" value={name} onChange={e => setName(e.target.value)} disabled={!canEdit} required
                  style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-main)', fontSize: '0.9rem' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Username (Login)
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} disabled={!canEdit} required
                  style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-main)', fontSize: '0.9rem' }} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Department
                <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} disabled={!isAdminOrManager}
                  style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: departmentId ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <option value="">— Select Department —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Position
                <select value={positionId} onChange={e => setPositionId(e.target.value)} disabled={!isAdminOrManager}
                  style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: positionId ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <option value="">— Select Position —</option>
                  {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>

              {/* Role — admin/manager editing others */}
              {isAdminOrManager && currentUser.id !== user.id && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Role
                  <select value={role} onChange={e => setRole(e.target.value)}
                    style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                    {currentUser.role === 'admin' && <option value="admin">Admin</option>}
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
              )}

              {/* Active toggle — admin only, not self */}
              {currentUser.role === 'admin' && currentUser.id !== user.id && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-body)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.85rem' }}>Account Status</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isActive ? '#22c55e' : '#ef4444' }}>{isActive ? 'Active' : 'Deactivated'}</span>
                    <label className={styles.toggleSwitch}>
                      <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                </div>
              )}

              {canEdit && (
                <button type="submit" className={styles.saveBtn} disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Save size={15} /> {saving ? 'Saving...' : 'Save Profile'}
                </button>
              )}
              {saveMsg && <p style={{ fontSize: '0.85rem', color: saveMsg.startsWith('✅') ? '#22c55e' : '#ef4444', margin: 0 }}>{saveMsg}</p>}
            </form>

            {/* Password Reset */}
            {canResetPassword && (
              <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security</h3>
                  {!showPwForm && (
                    <button onClick={() => setShowPwForm(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)' }}>
                      <Key size={13} /> Reset Password
                    </button>
                  )}
                </div>

                {showPwForm && (
                  <form onSubmit={handleResetPassword} style={{ display: 'grid', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-primary)', borderRadius: '6px', background: 'var(--bg-body)', overflow: 'hidden' }}>
                        <input
                          type={showPw ? 'text' : 'password'}
                          placeholder="New password..."
                          value={newPw}
                          onChange={e => setNewPw(e.target.value)}
                          required
                          autoFocus
                          style={{ flex: 1, border: 'none', outline: 'none', padding: '9px 12px', background: 'transparent', color: 'var(--text-main)', fontSize: '0.9rem' }}
                        />
                        <button type="button" onClick={() => setShowPw(p => !p)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0 10px', flexShrink: 0 }}>
                          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" className={styles.saveBtn} disabled={pwSaving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Key size={14} /> {pwSaving ? 'Resetting...' : 'Confirm Reset'}
                      </button>
                      <button type="button" onClick={() => { setShowPwForm(false); setNewPw(''); setPwMsg(''); }}
                        style={{ padding: '8px 14px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        Cancel
                      </button>
                    </div>
                    {pwMsg && <p style={{ fontSize: '0.85rem', color: pwMsg.startsWith('✅') ? '#22c55e' : '#ef4444', margin: 0 }}>{pwMsg}</p>}
                  </form>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Project Access */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px', overflowY: 'auto' }}>

            {/* Organizations */}
            <div>
              <h3 style={{ marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Organizations</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Organizations this user belongs to.</p>

              {currentUser.role === 'admin' ? (
                /* Admin: full toggle list */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {organizations.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No organizations yet.</p>}
                  {organizations.map(org => {
                    const isMember = organizationMembers.some(m => m.organization_id === org.id && m.user_id === user.id);
                    return (
                      <div key={org.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
                        background: isMember ? 'var(--color-primary-light)' : 'var(--bg-body)',
                        transition: 'all 0.15s',
                      }}>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: isMember ? 600 : 400, color: isMember ? 'var(--color-primary)' : 'var(--text-main)' }}>{org.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{isMember ? 'Member' : 'Not a member'}</div>
                        </div>
                        <label className={styles.toggleSwitch}>
                          <input type="checkbox" checked={isMember}
                            onChange={() => toggleOrganizationMember(org.id, user.id, isMember ? 'remove' : 'add')} />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Non-admin: read-only, only orgs the user belongs to */
                (() => {
                  const myOrgs = organizations.filter(org =>
                    organizationMembers.some(m => m.organization_id === org.id && m.user_id === user.id)
                  );
                  return myOrgs.length === 0
                    ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Not assigned to any organization.</p>
                    : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {myOrgs.map(org => (
                          <div key={org.id} style={{
                            padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
                            background: 'var(--color-primary-light)',
                          }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-primary)' }}>{org.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Member</div>
                          </div>
                        ))}
                      </div>
                    );
                })()
              )}
            </div>

            {/* Project Access */}
            <div>
              <h3 style={{ marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project Access</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Manage user access to specific projects.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                {projects.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No projects yet.</p>}
                {projects.map(project => {
                  const isMember = projectMembers.some(pm => pm.project_id === project.id && pm.user_id === user.id);
                  return (
                    <div key={project.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
                      background: isMember ? 'var(--color-primary-light)' : 'var(--bg-body)',
                      transition: 'all 0.15s'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: isMember ? 600 : 400, color: isMember ? 'var(--color-primary)' : 'var(--text-main)' }}>{project.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{isMember ? 'Has access' : 'No access'}</div>
                      </div>
                      <label className={styles.toggleSwitch}>
                        <input
                          type="checkbox"
                          checked={isMember}
                          onChange={() => handleToggleProjectAccess(project.id, isMember)}
                          disabled={!isAdminOrManager}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default EditUserModal;
