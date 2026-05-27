import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { X, Plus, Pencil, Trash2, Check, Building2 } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import styles from './Modal.module.css';

const OrganizationModal = ({ onClose }) => {
  const {
    currentUser, organizations, organizationMembers,
    projects, users,
    addOrganization, updateOrganization, deleteOrganization,
    toggleOrganizationMember, toggleOrganizationProject,
  } = useData();

  const isAdmin = currentUser?.role === 'admin';

  const [selectedId, setSelectedId]   = useState(organizations[0]?.id ?? null);
  const [newOrgName, setNewOrgName]   = useState('');
  const [adding, setAdding]           = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [editName, setEditName]       = useState('');
  const [saving, setSaving]           = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const selectedOrg = organizations.find(o => o.id === selectedId) ?? null;

  const membersOfSelected = organizationMembers
    .filter(m => m.organization_id === selectedId)
    .map(m => m.user_id);

  const projectsOfSelected = projects.filter(p => p.organization_id === selectedId);
  const unassignedProjects  = projects.filter(p => !p.organization_id);

  const handleAdd = async (e) => {
    e?.preventDefault();
    if (!newOrgName.trim() || saving) return;
    setSaving(true);
    try {
      const data = await addOrganization(newOrgName.trim());
      setNewOrgName('');
      setAdding(false);
      if (data?.id) setSelectedId(data.id);
    } catch (err) {
      console.error('Failed to add organization', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (id) => {
    if (!editName.trim()) return;
    await updateOrganization(id, editName.trim());
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    await deleteOrganization(id);
    setConfirmDeleteId(null);
    setSelectedId(organizations.find(o => o.id !== id)?.id ?? null);
  };

  const handleToggleMember = (userId) => {
    const has = membersOfSelected.includes(userId);
    toggleOrganizationMember(selectedId, userId, has ? 'remove' : 'add');
  };

  const handleToggleProject = (projectId, isAssigned) => {
    toggleOrganizationProject(selectedId, projectId, isAssigned ? 'unassign' : 'assign');
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '820px' }}>

        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={18} />
            <h2 style={{ fontSize: '1rem' }}>Organizations</h2>
          </div>
          <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
        </div>

        <div className={styles.body} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 0, minHeight: 420 }}>

          {/* ── Left: org list ── */}
          <div style={{ borderRight: '1px solid var(--border-color)', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {organizations.map(org => (
              <div
                key={org.id}
                onClick={() => { setSelectedId(org.id); setEditingId(null); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: 'var(--border-radius-sm)', cursor: 'pointer',
                  background: selectedId === org.id ? 'var(--color-primary-light)' : 'transparent',
                  color: selectedId === org.id ? 'var(--color-primary)' : 'var(--text-main)',
                  fontWeight: selectedId === org.id ? 600 : 400, fontSize: '0.88rem',
                }}
              >
                {editingId === org.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(org.id); if (e.key === 'Escape') setEditingId(null); }}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1, border: '1px solid var(--color-primary)', borderRadius: 4, padding: '2px 6px', fontSize: '0.85rem', background: 'var(--bg-body)', color: 'var(--text-main)', outline: 'none' }}
                  />
                ) : (
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</span>
                )}

                {isAdmin && editingId !== org.id && (
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingId(org.id); setEditName(org.name); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 4 }}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => setConfirmDeleteId(org.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px 4px', borderRadius: 4 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
                {editingId === org.id && (
                  <button onClick={() => handleRename(org.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: '2px 4px' }}>
                    <Check size={14} />
                  </button>
                )}
              </div>
            ))}

            {/* Delete confirm */}
            {confirmDeleteId && (
              <div style={{ padding: '8px 10px', background: '#fef2f2', borderRadius: 'var(--border-radius-sm)', border: '1px solid #fecaca', fontSize: '0.8rem' }}>
                <p style={{ marginBottom: 8, color: '#dc2626' }}>Delete this organization?</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleDelete(confirmDeleteId)}
                    style={{ flex: 1, padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}>
                    Delete
                  </button>
                  <button onClick={() => setConfirmDeleteId(null)}
                    style={{ flex: 1, padding: '4px 8px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {isAdmin && (
              adding ? (
                <form onSubmit={handleAdd} style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input
                    autoFocus
                    value={newOrgName}
                    onChange={e => setNewOrgName(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && (setAdding(false), setNewOrgName(''))}
                    placeholder="Organization name..."
                    disabled={saving}
                    style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--color-primary)', borderRadius: 4, fontSize: '0.83rem', background: 'var(--bg-body)', color: 'var(--text-main)', outline: 'none' }}
                  />
                  <button type="submit" disabled={saving}
                    style={{ padding: '6px 8px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                    <Check size={14} />
                  </button>
                </form>
              ) : (
                <button onClick={() => setAdding(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, padding: '7px 10px', border: '1px dashed var(--border-color)', borderRadius: 'var(--border-radius-sm)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.83rem', width: '100%' }}>
                  <Plus size={13} /> New Organization
                </button>
              )
            )}
          </div>

          {/* ── Right: detail panel ── */}
          {selectedOrg ? (
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>

              {/* Org meta */}
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>{selectedOrg.name}</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Created by {selectedOrg.created_by_name || '—'} · {new Date(selectedOrg.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>

              {/* Members */}
              <div>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>Members</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {users.map(u => {
                    const isMember = membersOfSelected.includes(u.id);
                    return (
                      <div key={u.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)',
                        background: isMember ? 'var(--color-primary-light)' : 'var(--bg-body)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <UserAvatar user={u} size={28} />
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: isMember ? 600 : 400, color: isMember ? 'var(--color-primary)' : 'var(--text-main)' }}>{u.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{u.username} · {u.role}</div>
                          </div>
                        </div>
                        {isAdmin && (
                          <label className={styles.toggleSwitch}>
                            <input type="checkbox" checked={isMember} onChange={() => handleToggleMember(u.id)} />
                            <span className={styles.slider}></span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Projects */}
              <div>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>Projects</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Assigned to this org */}
                  {projectsOfSelected.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)',
                      background: 'var(--color-primary-light)',
                    }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>{p.name}</span>
                      {isAdmin && (
                        <label className={styles.toggleSwitch}>
                          <input type="checkbox" checked={true} onChange={() => handleToggleProject(p.id, true)} />
                          <span className={styles.slider}></span>
                        </label>
                      )}
                    </div>
                  ))}
                  {/* Unassigned projects */}
                  {isAdmin && unassignedProjects.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)',
                      background: 'var(--bg-body)',
                    }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.name}</span>
                      <label className={styles.toggleSwitch}>
                        <input type="checkbox" checked={false} onChange={() => handleToggleProject(p.id, false)} />
                        <span className={styles.slider}></span>
                      </label>
                    </div>
                  ))}
                  {projectsOfSelected.length === 0 && unassignedProjects.length === 0 && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No projects available.</p>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              {organizations.length === 0 ? 'No organizations yet.' : 'Select an organization.'}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default OrganizationModal;
