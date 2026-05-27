import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { X, Plus, Trash2, GripVertical, Check, Pencil } from 'lucide-react';
import styles from './WorkflowModal.module.css';

const PRESET_COLORS = [
  '#94a3b8', '#6366f1', '#8b5cf6', '#ec4899',
  '#f59e0b', '#22c55e', '#14b8a6', '#ef4444',
  '#3b82f6', '#f97316', '#06b6d4', '#84cc16'
];

const WORKFLOW_TYPES = ['BACKLOG', 'PROGRESS', 'DONE'];

const WorkflowModal = ({ onClose }) => {
  const { activeProjectId, getProjectWorkflow, addWorkflowStage, updateWorkflowStage, deleteWorkflowStage, reorderWorkflowStages } = useData();
  const stages = getProjectWorkflow(activeProjectId);

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');
  const [editingType, setEditingType] = useState('BACKLOG');

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [newType, setNewType] = useState('BACKLOG');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  const [dragOverId, setDragOverId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null); // stage id to confirm delete

  const startEdit = (stage) => {
    setEditingId(stage.id);
    setEditingName(stage.name);
    setEditingColor(stage.color);
    setEditingType(stage.type || 'BACKLOG');
    setError('');
  };

  const saveEdit = async () => {
    if (!editingName.trim()) { setError('Nama stage tidak boleh kosong.'); return; }
    const res = await updateWorkflowStage(editingId, { name: editingName.trim(), color: editingColor, type: editingType });
    if (res?.error) { setError(res.error); return; }
    setEditingId(null);
    setError('');
  };

  const handleDelete = async (id) => {
    setError('');
    const res = await deleteWorkflowStage(id);
    if (res?.error) {
      setError(res.error);
    }
    setConfirmDeleteId(null);
  };

  const handleAdd = async () => {
    if (!newName.trim()) { setError('Nama stage tidak boleh kosong.'); return; }
    setIsAdding(true);
    await addWorkflowStage(activeProjectId, newName.trim(), newColor, newType);
    setNewName('');
    setNewColor('#6366f1');
    setNewType('BACKLOG');
    setIsAdding(false);
    setError('');
  };

  // Drag-to-reorder
  const handleDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    if (id !== draggingId) setDragOverId(id);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) return;

    const ids = stages.map(s => s.id);
    const fromIdx = ids.indexOf(draggingId);
    const toIdx = ids.indexOf(targetId);
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggingId);

    reorderWorkflowStages(activeProjectId, ids);
    setDraggingId(null);
    setDragOverId(null);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Manage Workflow Stages</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <p className={styles.description}>
          Drag untuk mengubah urutan, klik ikon pensil untuk mengedit nama dan warna stage.
        </p>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.stageList}>
          {stages.map(stage => (
            <div
              key={stage.id}
              className={`${styles.stageRow} ${dragOverId === stage.id ? styles.dragTarget : ''} ${draggingId === stage.id ? styles.draggingRow : ''}`}
              draggable
              onDragStart={e => handleDragStart(e, stage.id)}
              onDragOver={e => handleDragOver(e, stage.id)}
              onDrop={e => handleDrop(e, stage.id)}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
            >
              <div className={styles.dragHandle}><GripVertical size={16} /></div>
              <div className={styles.colorDot} style={{ backgroundColor: editingId === stage.id ? editingColor : stage.color }} />

              {editingId === stage.id ? (
                <div className={styles.editRow}>
                  <input
                    className={styles.editInput}
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    autoFocus
                  />
                  <select
                    className={styles.typeSelect}
                    value={editingType}
                    onChange={e => setEditingType(e.target.value)}
                  >
                    {WORKFLOW_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <div className={styles.colorPicker}>
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        className={`${styles.colorSwatch} ${editingColor === c ? styles.selectedSwatch : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setEditingColor(c)}
                      />
                    ))}
                  </div>
                  <button className={styles.saveBtn} onClick={saveEdit}><Check size={16} /></button>
                  <button className={styles.cancelEditBtn} onClick={() => setEditingId(null)}><X size={16} /></button>
                </div>
              ) : confirmDeleteId === stage.id ? (
                // Inline confirmation box
                <div className={styles.confirmRow}>
                  <span className={styles.confirmMsg}>
                    Hapus stage <strong>"{stage.name}"</strong>?
                  </span>
                  <div className={styles.confirmActions}>
                    <button className={styles.cancelEditBtn} onClick={() => setConfirmDeleteId(null)}>
                      Batal
                    </button>
                    <button className={styles.confirmDeleteBtn} onClick={() => handleDelete(stage.id)}>
                      Ya, Hapus
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className={styles.stageName}>{stage.name}</span>
                  <span className={`${styles.typeBadge} ${styles[`type${stage.type || 'BACKLOG'}`]}`}>
                    {stage.type || 'BACKLOG'}
                  </span>
                  <div className={styles.stageActions}>
                    <button className={styles.editBtn} onClick={() => startEdit(stage)} title="Edit">
                      <Pencil size={14} />
                    </button>
                    {stages.length > 1 && (
                      <button className={styles.deleteBtn} onClick={() => setConfirmDeleteId(stage.id)} title="Hapus">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new stage */}
        <div className={styles.addSection}>
          <div className={styles.colorDot} style={{ backgroundColor: newColor }} />
          <input
            className={styles.addInput}
            placeholder="Nama stage baru..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <select
            className={styles.typeSelect}
            value={newType}
            onChange={e => setNewType(e.target.value)}
          >
            {WORKFLOW_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className={styles.colorPickerInline}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                className={`${styles.colorSwatch} ${newColor === c ? styles.selectedSwatch : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <button className={styles.addBtn} onClick={handleAdd} disabled={isAdding}>
            <Plus size={16} /> Tambah Stage
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowModal;
