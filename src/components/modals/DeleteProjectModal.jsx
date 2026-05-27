import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import styles from './DeleteProjectModal.module.css';

const DeleteProjectModal = ({ projectName, onConfirm, onClose }) => {
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

        <h2 className={styles.title}>Hapus Project</h2>
        <p className={styles.desc}>
          Tindakan ini <strong>tidak dapat dibatalkan</strong>. Semua task, komentar, attachment, 
          dan data terkait project <strong>"{projectName}"</strong> akan dihapus secara permanen.
        </p>

        <div className={styles.confirmField}>
          <label>Ketik <code>delete</code> untuk mengkonfirmasi:</label>
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
          <button className={styles.cancelBtn} onClick={onClose}>Batal</button>
          <button
            className={styles.deleteBtn}
            onClick={handleConfirm}
            disabled={!confirmed || isDeleting}
          >
            {isDeleting ? 'Menghapus...' : 'Hapus Project'}
          </button>
        </div>

        <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
      </div>
    </div>
  );
};

export default DeleteProjectModal;
