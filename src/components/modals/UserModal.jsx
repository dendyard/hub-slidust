import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { X, Edit3, UserPlus, Settings2, Search } from 'lucide-react';
import styles from './Modal.module.css';
import EditUserModal from './EditUserModal';
import AddUserModal from './AddUserModal';
import PositionModal from './PositionModal';
import DepartmentModal from './DepartmentModal';
import UserAvatar from '../ui/UserAvatar';

const roleBadgeStyle = (role) => {
  const map = {
    admin:   { background: '#ef444420', color: '#ef4444' },
    manager: { background: '#f59e0b20', color: '#f59e0b' },
    member:  { background: '#6366f120', color: '#6366f1' },
    viewer:  { background: '#94a3b820', color: '#94a3b8' },
  };
  return map[role] || map.viewer;
};

const UserModal = ({ onClose }) => {
  const { currentUser, users, positions } = useData();
  const [editingUser,    setEditingUser]    = useState(null);
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [showPosModal,   setShowPosModal]   = useState(false);
  const [showDepModal,   setShowDepModal]   = useState(false);
  const [search,         setSearch]         = useState('');

  const isAdmin          = currentUser.role === 'admin';
  const isAdminOrManager = isAdmin || currentUser.role === 'manager';

  // Non-admin users cannot see admin accounts
  const baseUsers = isAdmin
    ? users
    : users.filter(u => u.role !== 'admin');

  const visibleUsers = search.trim()
    ? baseUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : baseUsers;

  // Admin: edit anyone; Manager: edit non-admin users; Member/Viewer: edit only self
  const canEditUser = (targetRole, targetId) => {
    if (isAdmin) return true;
    if (currentUser.role === 'manager') return targetRole !== 'admin';
    return currentUser.id === targetId;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      {editingUser && (
        <EditUserModal
          user={users.find(u => u.id === editingUser.id) ?? editingUser}
          onClose={() => setEditingUser(null)}
        />
      )}
      {showAddModal && (
        <AddUserModal onClose={() => setShowAddModal(false)} />
      )}
      {showPosModal && (
        <PositionModal onClose={() => setShowPosModal(false)} />
      )}
      {showDepModal && (
        <DepartmentModal onClose={() => setShowDepModal(false)} />
      )}

      <div className={styles.modalMd} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2>Members ({visibleUsers.length})</h2>
          <div className={styles.headerActions}>
            {isAdminOrManager && (
              <>
                <button className={`${styles.saveBtn} ${styles.saveBtnSm}`} onClick={() => setShowAddModal(true)}>
                  <UserPlus size={14} /> Add Member
                </button>
                <button className={`${styles.saveBtn} ${styles.saveBtnSm} ${styles.saveBtnGhost}`} onClick={() => setShowPosModal(true)}>
                  <Settings2 size={14} /> Positions
                </button>
                <button className={`${styles.saveBtn} ${styles.saveBtnSm} ${styles.saveBtnGhost}`} onClick={() => setShowDepModal(true)}>
                  <Settings2 size={14} /> Departments
                </button>
              </>
            )}
            <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
          </div>
        </div>

        {/* Member List */}
        <div className={styles.body}>
          <div className={styles.userSearchWrap}>
            <Search size={14} className={styles.userSearchIcon} />
            <input
              type="text"
              placeholder="Search member..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.userSearchInput}
              autoComplete="off"
            />
          </div>
          <div className={styles.userList}>
            {visibleUsers.map(user => {
              const isActive = Boolean(Number(user.is_active ?? 1));
              const badge    = roleBadgeStyle(user.role);
              const pos      = positions.find(p => p.id === user.position_id);

              return (
                <div key={user.id} className={styles.userItem} style={{ opacity: isActive ? 1 : 0.5 }}>
                  <div className={styles.userInfo}>
                    <UserAvatar user={user} size={36} style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div className={styles.userName}>
                        {user.name}
                        {user.id === currentUser.id && (
                          <span className={styles.youTag}> (You)</span>
                        )}
                        {!isActive && (
                          <span className={styles.deactivatedTag}>Deactivated</span>
                        )}
                      </div>
                      <div className={styles.userRole}>
                        {user.username && <span>@{user.username}</span>}
                        {pos && <span>· {pos.name}</span>}
                        <span className={styles.roleBadge} style={{ background: badge.background, color: badge.color }}>
                          {user.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  {canEditUser(user.role, user.id) && (
                    <button className={styles.editUserBtn} onClick={() => setEditingUser(user)}>
                      <Edit3 size={14} /> Edit
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserModal;
