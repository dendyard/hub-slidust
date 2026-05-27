import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import styles from './DeleteProjectModal.module.css';

const DeleteTaskModal = ({ taskTitle, onConfirm, onClose }) => {
  const [inputVal, setInputVal] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmed = inputVal === 'delete';

  const handleConfirm = async () => {
    if (!confirmed) return;
    setIsDeleting(true);
    await onConfirm();
    setIsDeleting(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.iconWrapper}>
          <AlertTriangle size={32} color="#ef4444" />
        </div>

        <h2 className={styles.title}>Delete Task</h2>
        <p className={styles.desc}>
          This action <strong>cannot be undone</strong>. Task{' '}
          <strong>"{taskTitle}"</strong> along with all its comments and attachments
          will be permanently deleted.
        </p>

        <div className={styles.confirmField}>
          <label>Type <code>delete</code> to confirm:</label>
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="delete"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && confirmed && handleConfirm()}
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.deleteBtn}
            onClick={handleConfirm}
            disabled={!confirmed || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Task'}
          </button>
        </div>

        <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
      </div>
    </div>
  );
};

export default DeleteTaskModal;
