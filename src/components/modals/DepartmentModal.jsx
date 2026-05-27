import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { X, Plus, Pencil, Trash2, Check, Ban } from 'lucide-react';
import styles from './Modal.module.css';

const DepartmentModal = ({ onClose }) => {
  const { departments, addDepartment, updateDepartment, deleteDepartment } = useData();

  const [newName,     setNewName]     = useState('');
  const [editingId,   setEditingId]   = useState(null);
  const [editingName, setEditingName] = useState('');
  const [error,       setError]       = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (departments.some(d => d.name.toLowerCase() === name.toLowerCase())) {
      setError('Department already exists.'); return;
    }
    await addDepartment(name);
    setNewName('');
    setError('');
  };

  const startEdit = (dep) => {
    setEditingId(dep.id);
    setEditingName(dep.name);
    setError('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const name = editingName.trim();
    if (!name) return;
    if (departments.some(d => d.name.toLowerCase() === name.toLowerCase() && d.id !== editingId)) {
      setError('Department already exists.'); return;
    }
    await updateDepartment(editingId, name);
    setEditingId(null);
    setEditingName('');
    setError('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department? Users assigned to it will be unassigned.')) return;
    await deleteDepartment(id);
  };

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 14px', borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-body)',
  };

  const inputStyle = {
    flex: 1, padding: '8px 10px', borderRadius: '6px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-surface)', color: 'var(--text-main)',
    fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit',
  };

  const iconBtn = (danger = false) => ({
    background: 'none', border: 'none', cursor: 'pointer',
    color: danger ? 'var(--color-danger, #ef4444)' : 'var(--text-muted)',
    display: 'flex', alignItems: 'center', padding: '4px',
    borderRadius: '4px', flexShrink: 0,
    transition: 'color 0.12s, background 0.12s',
  });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>

        <div className={styles.header}>
          <h2>Departments</h2>
          <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
        </div>

        <div className={styles.body}>
          {/* Add new */}
          <div className={styles.section}>
            <h3 style={{ marginBottom: '12px' }}>Add Department</h3>
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Department name..."
                value={newName}
                onChange={e => { setNewName(e.target.value); setError(''); }}
                style={inputStyle}
                autoFocus
              />
              <button type="submit" className={styles.saveBtn}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <Plus size={15} /> Add
              </button>
            </form>
            {error && <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '6px' }}>{error}</p>}
          </div>

          {/* List */}
          <div className={styles.section}>
            <h3 style={{ marginBottom: '12px' }}>
              Department List <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem' }}>({departments.length})</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {departments.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No departments yet.</p>
              )}
              {departments.map(dep => (
                <div key={dep.id} style={rowStyle}>
                  {editingId === dep.id ? (
                    <form onSubmit={handleUpdate} style={{ display: 'flex', flex: 1, gap: '8px' }}>
                      <input
                        value={editingName}
                        onChange={e => { setEditingName(e.target.value); setError(''); }}
                        style={{ ...inputStyle, borderColor: 'var(--color-primary)' }}
                        autoFocus
                      />
                      <button type="submit" style={iconBtn()} title="Save">
                        <Check size={16} color="var(--color-primary)" />
                      </button>
                      <button type="button" style={iconBtn()} title="Cancel"
                        onClick={() => { setEditingId(null); setError(''); }}>
                        <Ban size={16} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text-main)' }}>{dep.name}</span>
                      <button style={iconBtn()} title="Edit" onClick={() => startEdit(dep)}>
                        <Pencil size={15} />
                      </button>
                      <button style={iconBtn(true)} title="Delete" onClick={() => handleDelete(dep.id)}>
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentModal;
