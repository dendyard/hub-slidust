import { useState, useRef } from 'react';
import { useData, API_BASE, authFetch } from '../../context/DataContext';
import { X, UserPlus, Eye, EyeOff, Save, Camera } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import styles from './Modal.module.css';

const AddUserModal = ({ onClose }) => {
  const { currentUser, addUser, updateUserAvatar, positions, departments, organizations, toggleOrganizationMember } = useData();

  const [name,        setName]        = useState('');
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [role,        setRole]        = useState('member');
  const [departmentId, setDepartmentId] = useState('');
  const [positionId,   setPositionId]   = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState('');
  const [selectedOrgs, setSelectedOrgs] = useState([]);

  // Avatar preview
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // Preview user object for UserAvatar
  const previewUser = { name, avatar: avatarPreview };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password.trim()) return;
    setSaving(true);
    setSaveMsg('');

    // 1. Create user
    const newId = await addUser({ name, username, password, role, department_id: departmentId || null, position_id: positionId || null, avatar: null });

    // 2. Assign organizations
    if (newId && currentUser?.role === 'admin' && selectedOrgs.length > 0) {
      await Promise.all(selectedOrgs.map(orgId => toggleOrganizationMember(orgId, newId, 'add')));
    }

    // 3. Upload avatar if selected
    if (avatarFile && newId) {
      const formData = new FormData();
      formData.append('user_id', newId);
      formData.append('file', avatarFile);
      try {
        const res  = await authFetch(`${API_BASE}/upload_user_avatar`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) updateUserAvatar(newId, data.url);
      } catch {}
    }

    setSaveMsg('✅ Member added successfully!');
    setSaving(false);
    setTimeout(onClose, 800);
  };

  const inputStyle = {
    padding: '9px 12px', borderRadius: '6px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-body)', color: 'var(--text-main)',
    fontSize: '0.9rem', width: '100%', boxSizing: 'border-box',
    outline: 'none', fontFamily: 'inherit',
  };

  const labelStyle = {
    display: 'flex', flexDirection: 'column', gap: '6px',
    fontSize: '0.85rem', color: 'var(--text-muted)',
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '860px' }}>

        {/* Header */}
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Avatar with upload overlay */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <UserAvatar user={previewUser} size={44} style={{ border: '2px solid var(--border-color)' }} />
              <label
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.45)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}
              >
                <Camera size={16} color="#fff" />
                <input
                  ref={fileInputRef}
                  type="file" accept="image/*" hidden
                  onChange={handleAvatarChange}
                />
              </label>
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', marginBottom: 2 }}>Add New Member</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {username ? `@${username}` : 'Username not filled'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
        </div>

        {/* Body */}
        <div className={styles.body} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

          {/* LEFT: Profile Details */}
          <div style={{ padding: '24px', borderRight: '1px solid var(--border-color)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Profile Details
            </h3>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
              <label style={labelStyle}>
                Full Name
                <input
                  type="text" required autoFocus
                  placeholder="e.g. Budi Santoso"
                  value={name} onChange={e => setName(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Username (Login)
                <input
                  type="text" required
                  placeholder="e.g. budi.santoso"
                  value={username} onChange={e => setUsername(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Password
                <div style={{
                  display: 'flex', alignItems: 'center',
                  border: '1px solid var(--border-color)', borderRadius: '6px',
                  background: 'var(--bg-body)', overflow: 'hidden',
                }}>
                  <input
                    type={showPw ? 'text' : 'password'} required
                    placeholder="Password..."
                    value={password} onChange={e => setPassword(e.target.value)}
                    style={{ ...inputStyle, border: 'none', borderRadius: 0, flex: 1 }}
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0 10px', flexShrink: 0 }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </label>

              <label style={labelStyle}>
                Department
                <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                  style={{ ...inputStyle, color: departmentId ? 'var(--text-main)' : 'var(--text-muted)' }}>
                  <option value="">— Select Department —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>

              <label style={labelStyle}>
                Position
                <select value={positionId} onChange={e => setPositionId(e.target.value)}
                  style={{ ...inputStyle, color: positionId ? 'var(--text-main)' : 'var(--text-muted)' }}>
                  <option value="">— Select Position —</option>
                  {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>

              <label style={labelStyle}>
                Role
                <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  {currentUser?.role === 'admin' && <option value="admin">Admin</option>}
                  <option value="viewer">Viewer</option>
                </select>
              </label>

              <button
                type="submit"
                className={styles.saveBtn}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px' }}
              >
                {saving ? <Save size={15} /> : <UserPlus size={15} />}
                {saving ? 'Saving...' : 'Add Member'}
              </button>

              {saveMsg && (
                <p style={{ fontSize: '0.85rem', color: saveMsg.startsWith('✅') ? '#22c55e' : '#ef4444', margin: 0 }}>
                  {saveMsg}
                </p>
              )}
            </form>
          </div>

          {/* RIGHT: Organizations */}
          <div style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Organizations</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Assign user to one or more organizations.</p>

            {currentUser?.role === 'admin' && organizations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                {organizations.map(org => {
                  const checked = selectedOrgs.includes(org.id);
                  return (
                    <div key={org.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
                      background: checked ? 'var(--color-primary-light)' : 'var(--bg-body)',
                      transition: 'all 0.15s',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: checked ? 600 : 400, color: checked ? 'var(--color-primary)' : 'var(--text-main)' }}>{org.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{checked ? 'Will be assigned' : 'Not assigned'}</div>
                      </div>
                      <label className={styles.toggleSwitch}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedOrgs(prev =>
                            prev.includes(org.id) ? prev.filter(id => id !== org.id) : [...prev, org.id]
                          )}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', gap: '12px', color: 'var(--text-muted)' }}>
                <UserPlus size={36} strokeWidth={1.2} />
                <p style={{ textAlign: 'center', fontSize: '0.82rem', lineHeight: 1.6 }}>
                  {organizations.length === 0 ? 'No organizations created yet.' : 'Only admins can assign organizations.'}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default AddUserModal;
