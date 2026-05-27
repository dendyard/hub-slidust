import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useData, resolveUploadUrl } from '../../context/DataContext';
import { Bell, LogOut, Settings2, User, Users, Building2, ChevronDown, CheckCheck, Trash2, Menu, Search } from 'lucide-react';
import styles from './Header.module.css';
import DustFlowIcon from '../ui/DustFlowIcon';
import ProjectSettingsModal from '../modals/ProjectSettingsModal';
import EditUserModal from '../modals/EditUserModal';
import UserModal from '../modals/UserModal';
import OrganizationModal from '../modals/OrganizationModal';
import UserAvatar, { getAvatarColor } from '../ui/UserAvatar';
import GlobalSearch from './GlobalSearch';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return 'Baru saja';
  if (m < 60) return `${m} menit lalu`;
  if (h < 24) return `${h} jam lalu`;
  return `${d} hari lalu`;
};

const Header = ({ onTaskClick, activePage, onMenuToggle, onFlowClick, onSlidNoteClick }) => {
  const {
    projects, activeProjectId, currentUser, handleLogout,
    notifications, markNotificationRead, markAllNotificationsRead, clearNotifications,
    organizations, organizationMembers,
  } = useData();

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Resolve the active organization name from the user's active_organization_id
  const activeOrgName = (() => {
    const orgId = currentUser?.active_organization_id
      ?? organizationMembers.find(m => m.user_id === currentUser?.id)?.organization_id;
    return organizations.find(o => o.id === orgId)?.name ?? null;
  })();

  const [showSettings,   setShowSettings]   = useState(false);
  const [showDropdown,   setShowDropdown]   = useState(false);
  const [showProfile,    setShowProfile]    = useState(false);
  const [showMembers,    setShowMembers]    = useState(false);
  const [showOrgs,       setShowOrgs]       = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showSearch,     setShowSearch]     = useState(false);

  const dropdownRef = useRef(null);
  const notifRef    = useRef(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
      if (notifRef.current && !notifRef.current.contains(e.target))
        setShowNotifPanel(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cmd+K / Ctrl+K to open global search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleNotifClick = (notif) => {
    markNotificationRead(notif.id);
    setShowNotifPanel(false);
    if (onTaskClick) onTaskClick(notif.task_id);
  };

  return (
    <header className={styles.header}>
      {/* Hamburger — mobile only */}
      <button className={styles.hamburger} onClick={onMenuToggle} aria-label="Open menu">
        <Menu size={22} />
      </button>

      <div className={styles.projectContext}>
        {activePage === 'dustflow' && (
          <>
            <DustFlowIcon size={22} />
            <h1>Dust Flow</h1>
          </>
        )}
        {activePage === 'board' && (<>
          {activeProject && (
            activeProject.icon
              ? <img src={resolveUploadUrl(activeProject.icon)} className={styles.projectHeaderIcon} alt="" />
              : <div className={styles.projectHeaderInitial} style={{ backgroundColor: getAvatarColor(activeProject.name) }}>
                  {activeProject.name.charAt(0).toUpperCase()}
                </div>
          )}
          <h1>{activeProject ? activeProject.name : 'Select a Project'}</h1>
          {activeProject && (
            <button className={styles.settingsBtn} onClick={() => setShowSettings(true)} title="Project Settings">
              <Settings2 size={15} />
            </button>
          )}
        </>)}
      </div>

      {showSettings && createPortal(<ProjectSettingsModal onClose={() => setShowSettings(false)} />, document.body)}
      {showProfile  && createPortal(<EditUserModal user={currentUser} onClose={() => setShowProfile(false)} />, document.body)}
      {showMembers  && createPortal(<UserModal onClose={() => setShowMembers(false)} />, document.body)}
      {showOrgs     && createPortal(<OrganizationModal onClose={() => setShowOrgs(false)} />, document.body)}
      {showSearch   && (
        <GlobalSearch
          onClose={() => setShowSearch(false)}
          onTaskClick={(id) => { setShowSearch(false); if (onTaskClick) onTaskClick(id); }}
          onFlowClick={(id) => { setShowSearch(false); if (onFlowClick) onFlowClick(id); }}
          onNoteClick={(id) => { setShowSearch(false); if (onSlidNoteClick) onSlidNoteClick(id); }}
        />
      )}

      <div className={styles.actions}>
        {/* ── Global Search ── */}
        <button
          className={`${styles.iconBtn} ${showSearch ? styles.iconBtnActive : ''}`}
          onClick={() => setShowSearch(p => !p)}
          title="Search (⌘K)"
        >
          <Search size={20} />
        </button>

        {/* ── Bell ── */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            className={`${styles.iconBtn} ${showNotifPanel ? styles.iconBtnActive : ''}`}
            onClick={() => setShowNotifPanel(p => !p)}
            title="Notifikasi"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className={styles.notificationBadge}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifPanel && (
            <div className={styles.notifPanel}>
              {/* Panel header */}
              <div className={styles.notifHeader}>
                <span className={styles.notifTitle}>Notifikasi</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {unreadCount > 0 && (
                    <button className={styles.notifAction} title="Tandai semua dibaca"
                      onClick={markAllNotificationsRead}>
                      <CheckCheck size={14} />
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button className={styles.notifAction} title="Hapus semua"
                      onClick={clearNotifications}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className={styles.notifList}>
                {notifications.length === 0 && (
                  <div className={styles.notifEmpty}>
                    <Bell size={28} strokeWidth={1.2} />
                    <span>Belum ada notifikasi</span>
                  </div>
                )}
                {notifications.map(n => (
                  <button
                    key={n.id}
                    className={`${styles.notifItem} ${!n.is_read ? styles.notifUnread : ''}`}
                    onClick={() => handleNotifClick(n)}
                  >
                    <div className={styles.notifDot} style={{ opacity: n.is_read ? 0 : 1 }} />
                    <div className={styles.notifBody}>
                      <p className={styles.notifText}>
                        {n.type === 'mention'
                          ? n.assigned_by_name
                            ? <><strong>{n.assigned_by_name}</strong> menyebut kamu di komentar</>
                            : <>Kamu disebut di komentar</>
                          : n.type === 'reply'
                            ? n.assigned_by_name
                              ? <><strong>{n.assigned_by_name}</strong> membalas komentar kamu</>
                              : <>Seseorang membalas komentar kamu</>
                            : n.assigned_by_name
                              ? <><strong>{n.assigned_by_name}</strong> menugaskan task ke kamu</>
                              : <>Kamu ditugaskan ke task</>
                        }
                      </p>
                      <p className={styles.notifTaskTitle}>{n.task_title}</p>
                      {(n.type === 'mention' || n.type === 'reply') && n.excerpt && (
                        <p className={styles.notifExcerpt}>&ldquo;{n.excerpt}&rdquo;</p>
                      )}
                      <span className={styles.notifTime}>{formatTime(n.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Profile dropdown ── */}
        <div className={styles.profileWrapper} ref={dropdownRef}>
          <div className={styles.profile} onClick={() => setShowDropdown(p => !p)}>
            <UserAvatar user={currentUser} size={34} style={{ border: '2px solid var(--border-color)' }} />
            <div className={`${styles.profileInfo} ${styles.profileInfoDesktop}`}>
              <span className={styles.name}>{currentUser?.name || 'User'}</span>
              {activeOrgName
                ? <span className={styles.orgName}>{activeOrgName}</span>
                : <span className={styles.orgName} style={{ textTransform: 'capitalize' }}>{currentUser?.role || 'member'}</span>
              }
            </div>
            <ChevronDown size={14} className={`${styles.chevron} ${styles.chevronDesktop} ${showDropdown ? styles.chevronOpen : ''}`} />
          </div>

          {showDropdown && (
            <div className={styles.dropdown}>
              <button className={styles.dropdownItem} onClick={() => { setShowDropdown(false); setShowProfile(true); }}>
                <User size={14} /> Profile
              </button>
              <button className={styles.dropdownItem} onClick={() => { setShowDropdown(false); setShowMembers(true); }}>
                <Users size={14} /> Members
              </button>
              {currentUser?.role === 'admin' && (
                <button className={styles.dropdownItem} onClick={() => { setShowDropdown(false); setShowOrgs(true); }}>
                  <Building2 size={14} /> Organizations
                </button>
              )}
              <div className={styles.dropdownDivider} />
              <button className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`} onClick={handleLogout}>
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
