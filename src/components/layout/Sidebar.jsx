import { useData, resolveUploadUrl } from '../../context/DataContext';
import { LayoutDashboard, Pin, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import goalLogo from '../../assets/goallogo.png';
import slidnoteLogo from '../../assets/slidnote.png';
import DustFlowIcon from '../ui/DustFlowIcon';
import styles from './Sidebar.module.css';

const Sidebar = ({ onNewProjectClick, onDashboardClick, onBoardClick, onDustFlowClick, onSlidNoteClick, onMyBoardClick, activePage, isOpen, onClose, isCollapsed, onToggleCollapse }) => {
  const { currentUser, projects, activeProjectId, setActiveProjectId } = useData();
  const canManageProject = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const handleNav = (cb) => {
    cb();
    onClose?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className={styles.overlay} onClick={onClose} />
      )}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''} ${isCollapsed ? styles.collapsed : ''}`}>

        {/* Logo area */}
        <div className={styles.logo} onClick={() => handleNav(onMyBoardClick)} style={{ cursor: 'pointer' }}>
          {!isCollapsed && <img src={goalLogo} alt="Gols" className={styles.logoImg} />}
        </div>

        {/* Collapse toggle button */}
        <button
          className={styles.collapseBtn}
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <nav className={styles.nav}>
          <ul className={styles.plainMenu}>
            <li
              className={activePage === 'myboard' ? styles.active : ''}
              onClick={() => handleNav(onMyBoardClick)}
              title={isCollapsed ? 'My Board' : ''}
            >
              <Pin size={18} />
              {!isCollapsed && <span>My Board</span>}
            </li>
            <li
              className={activePage === 'dashboard' ? styles.active : ''}
              onClick={() => handleNav(onDashboardClick)}
              title={isCollapsed ? 'Dashboard' : ''}
            >
              <LayoutDashboard size={18} />
              {!isCollapsed && <span>Dashboard</span>}
            </li>
          </ul>

          <div className={styles.navSection} style={{ marginTop: '16px' }}>
            {!isCollapsed && <h3 className={styles.sectionTitle}>Your Projects</h3>}
            <ul className={styles.projectList}>
              {projects.map(proj => (
                <li
                  key={proj.id}
                  className={activeProjectId === proj.id ? styles.activeProject : ''}
                  onClick={() => handleNav(() => { setActiveProjectId(proj.id); onBoardClick(); })}
                  title={isCollapsed ? proj.name : ''}
                >
                  {proj.icon
                    ? <img src={resolveUploadUrl(proj.icon)} className={styles.projectIcon} alt="" />
                    : <div className={styles.projectInitial}>{proj.name?.charAt(0).toUpperCase()}</div>
                  }
                  {!isCollapsed && <span className={styles.projectName}>{proj.name}</span>}
                </li>
              ))}
            </ul>
            {canManageProject && !isCollapsed && (
              <button onClick={() => handleNav(onNewProjectClick)} className={styles.addProjectBtn}>
                + New Project
              </button>
            )}
            {canManageProject && isCollapsed && (
              <button
                onClick={() => handleNav(onNewProjectClick)}
                className={styles.addProjectBtnIcon}
                title="New Project"
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          {/* Tools section */}
          <div className={styles.navSection}>
            {!isCollapsed && <h3 className={styles.sectionTitle}>Tools</h3>}
            <ul className={styles.plainMenu}>
              <li
                className={activePage === 'dustflow' ? styles.active : ''}
                onClick={() => handleNav(onDustFlowClick)}
                title={isCollapsed ? 'Dust Flow' : ''}
              >
                <DustFlowIcon size={18} />
                {!isCollapsed && <span>Dust Flow</span>}
              </li>
              <li
                className={activePage === 'slidnote' ? styles.active : ''}
                onClick={() => handleNav(onSlidNoteClick)}
                title={isCollapsed ? 'Slid Note' : ''}
              >
                <img src={slidnoteLogo} alt="Slid Note" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                {!isCollapsed && <span>Slid Note</span>}
              </li>
            </ul>
          </div>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
