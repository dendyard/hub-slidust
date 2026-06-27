import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ToastNotifications from './components/layout/ToastNotifications';
import Board from './components/board/Board';
import Dashboard from './components/dashboard/Dashboard';
import FlowList from './components/drawflow/FlowList';
import FlowEditor from './components/drawflow/FlowEditor';
import SlidNote from './components/slidnote/SlidNote';
import MyBoard from './components/myboard/MyBoard';
import TaskModal from './components/modals/TaskModal';
import UserModal from './components/modals/UserModal';
import ProjectModal from './components/modals/ProjectModal';
import OrganizationModal from './components/modals/OrganizationModal';
import Login from './pages/Login';
import { useData } from './context/DataContext';

function App() {
  const { currentUser, projects, activeProjectId, setActiveProjectId, projectMembers } = useData();
  const getPageFromUrl = () => {
    const seg = window.location.pathname.split('/')[1] || '';
    if (seg === 'myboard') return 'myboard';
    if (seg === 'slidnote') return 'slidnote';
    if (seg === 'flow') return 'dustflow';
    if (seg === 'board') return 'board';
    return 'dashboard';
  };
  const getFlowIdFromUrl = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[0] === 'flow' ? (parts[1] || null) : null;
  };
  const getSlidNoteIdFromUrl = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[0] === 'slidnote' ? (parts[1] || null) : null;
  };
  const getProjectIdFromUrl = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[0] === 'board' ? (parts[1] || null) : null;
  };

  const [activePage, setActivePage] = useState(getPageFromUrl);
  const [activeFlowId, setActiveFlowId] = useState(getFlowIdFromUrl);
  const [activeSlidNoteId, setActiveSlidNoteId] = useState(getSlidNoteIdFromUrl);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showOrgsModal, setShowOrgsModal] = useState(false);
  const [initialStatusForNew, setInitialStatusForNew] = useState(null);
  const [noAccessPopup, setNoAccessPopup] = useState(false);
  const [taskShowProjectContext, setTaskShowProjectContext] = useState(
    () => new URLSearchParams(window.location.search).get('shared') === '1'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const getTaskIdFromUrl = () => new URLSearchParams(window.location.search).get('task');
  const isSharedFromUrl = () => new URLSearchParams(window.location.search).get('shared') === '1';

  const [activeTaskId, setActiveTaskId] = useState(() => getTaskIdFromUrl());
  const [taskReadOnly, setTaskReadOnly] = useState(() => isSharedFromUrl());
  const [taskInitialData, setTaskInitialData] = useState(null);
  const prevUserRef = useRef(currentUser);

  // Save intended URL before login so we can restore it after auth
  useEffect(() => {
    if (!currentUser) {
      const path = window.location.pathname;
      const search = window.location.search;
      const isShareRedirect = path.startsWith('/share/');
      const isMeaningfulUrl = (path !== '/' && path !== '/myboard') || search;
      if (isMeaningfulUrl && !isShareRedirect) {
        sessionStorage.setItem('slidust_redirect', path + search);
      }
    }
  }, [currentUser]);

  // After fresh login (null → user): restore intended URL or go to myboard
  useEffect(() => {
    const wasNull = prevUserRef.current === null;
    prevUserRef.current = currentUser;
    if (wasNull && currentUser) {
      const saved = sessionStorage.getItem('slidust_redirect');
      sessionStorage.removeItem('slidust_redirect');
      if (saved && saved !== '/') {
        window.history.replaceState({}, '', saved);
        const seg = saved.split('/').filter(Boolean)[0] || '';
        const savedQuery = new URLSearchParams(saved.split('?')[1] || '');
        const taskParam = savedQuery.get('task');
        if (taskParam) {
          setActiveTaskId(taskParam);
          // Came from a share link → open the task card like from the dashboard
          if (savedQuery.get('shared') === '1') {
            setTaskReadOnly(true);
            setTaskShowProjectContext(true);
          }
        }
        if (seg === 'board') {
          const projId = saved.split('/').filter(Boolean)[1] || null;
          if (projId) setActiveProjectId(projId);
          setActivePage('board');
        } else if (seg === 'myboard') {
          setActivePage('myboard');
        } else if (seg === 'flow') {
          setActivePage('dustflow');
        } else if (seg === 'slidnote') {
          setActivePage('slidnote');
        } else {
          setActivePage('dashboard');
        }
      } else {
        setActivePage('myboard');
        window.history.replaceState({}, '', '/myboard');
      }
    }
  }, [currentUser]);

  // Close sidebar on resize back to desktop
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Sync URL when activePage or active IDs change (only when logged in)
  useEffect(() => {
    if (!currentUser) return;
    if (activePage === 'dashboard') {
      window.history.pushState({}, '', '/');
    } else if (activePage === 'myboard') {
      window.history.pushState({}, '', '/myboard');
    } else if (activePage === 'dustflow') {
      window.history.pushState({}, '', activeFlowId ? `/flow/${activeFlowId}` : '/flow');
    } else if (activePage === 'slidnote') {
      window.history.pushState({}, '', activeSlidNoteId ? `/slidnote/${activeSlidNoteId}` : '/slidnote');
    } else {
      window.history.pushState({}, '', activeProjectId ? `/board/${activeProjectId}` : '/board');
    }
  }, [currentUser, activePage, activeProjectId, activeFlowId, activeSlidNoteId]);

  // Sync task modal in URL as query param (overlays any page)
  useEffect(() => {
    if (activePage === 'dashboard') return;
    const url = new URL(window.location.href);
    if (activeTaskId) {
      url.searchParams.set('task', activeTaskId);
    } else {
      url.searchParams.delete('task');
    }
    window.history.pushState({}, '', url.toString());
  }, [activeTaskId, activePage]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      setActivePage(getPageFromUrl());
      setActiveFlowId(getFlowIdFromUrl());
      setActiveSlidNoteId(getSlidNoteIdFromUrl());
      setActiveTaskId(getTaskIdFromUrl());
      const projId = getProjectIdFromUrl();
      if (projId) setActiveProjectId(projId);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Dynamic page title
  useEffect(() => {
    const pageName = activePage === 'dashboard'
      ? 'Dashboard'
      : activePage === 'myboard'
      ? 'My Board'
      : activePage === 'dustflow'
      ? 'Dust Flow'
      : activePage === 'slidnote'
      ? 'Slid Note'
      : projects.find(p => p.id === activeProjectId)?.name || 'Board';
    document.title = `Slidust | ${pageName}`;
  }, [activePage, activeProjectId, projects]);

  const handleTaskClick = (taskId, status = null, aiData = null) => {
    setActiveTaskId(taskId);
    setInitialStatusForNew(status);
    setTaskReadOnly(false);
    setTaskShowProjectContext(false);
    setTaskInitialData(aiData || null);
    if (taskId && activePage !== 'myboard') setActivePage('board');
  };

  const handleDashboardTaskClick = (taskId) => {
    setActiveTaskId(taskId);
    setTaskReadOnly(true);
    setTaskShowProjectContext(true);
  };

  const handleExternalTaskClick = (taskId) => {
    setActiveTaskId(taskId);
    setInitialStatusForNew(null);
    setTaskReadOnly(false);
    setTaskShowProjectContext(true);
  };

  const handleCloseTask = () => {
    setActiveTaskId(null);
    setInitialStatusForNew(null);
    setTaskReadOnly(false);
    setTaskShowProjectContext(false);
    setTaskInitialData(null);
  };

  const handleOpenInProject = (projectId) => {
    const hasAccess =
      currentUser?.role === 'admin' ||
      currentUser?.role === 'manager' ||
      projectMembers.some(pm => pm.project_id === projectId && pm.user_id === currentUser?.id);

    if (!hasAccess) {
      handleCloseTask();
      setActivePage('dashboard');
      setNoAccessPopup(true);
      return;
    }

    setActiveProjectId(projectId);
    setActivePage('board');
    setTaskReadOnly(false);
    setTaskShowProjectContext(false);
  };

  if (!currentUser) {
    return <Login />;
  }

  const collapsedWidth = sidebarCollapsed ? '60px' : '260px';

  return (
    <div style={{ display: 'flex', ...(!isMobile && { '--sidebar-width': collapsedWidth }) }}>
      <Sidebar
        onUsersClick={() => setShowUsersModal(true)}
        onNewProjectClick={() => setShowProjectModal(true)}
        onDashboardClick={() => setActivePage('dashboard')}
        onBoardClick={() => setActivePage('board')}
        onMyBoardClick={() => setActivePage('myboard')}
        onOrganizationsClick={() => setShowOrgsModal(true)}
        onDustFlowClick={() => { setActivePage('dustflow'); setActiveFlowId(null); }}
        onSlidNoteClick={() => { setActivePage('slidnote'); setActiveSlidNoteId(null); }}
        activePage={activePage}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(v => {
          localStorage.setItem('sidebar_collapsed', String(!v));
          return !v;
        })}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Header
          onTaskClick={handleExternalTaskClick}
          activePage={activePage}
          onMenuToggle={() => setSidebarOpen(v => !v)}
          onFlowClick={(id) => { setActivePage('dustflow'); setActiveFlowId(id); }}
          onSlidNoteClick={(id) => { setActivePage('slidnote'); setActiveSlidNoteId(id); }}
        />
        <ToastNotifications onTaskClick={handleExternalTaskClick} />
        <main style={{
          marginLeft: isMobile ? 0 : collapsedWidth,
          marginTop: 'var(--header-height)',
          padding: isMobile ? '12px' : '32px',
          height: 'calc(100vh - var(--header-height))',
          overflow: 'auto',
        }}>
          {activePage === 'dashboard'
            ? <Dashboard onTaskClick={handleDashboardTaskClick} />
            : activePage === 'myboard'
            ? <MyBoard onTaskClick={handleExternalTaskClick} />
            : activePage === 'dustflow'
            ? <FlowList onOpenFlow={(id) => { setActivePage('dustflow'); setActiveFlowId(id); }} />
            : activePage === 'slidnote'
            ? (
              <SlidNote
                activeNoteId={activeSlidNoteId}
                onOpenNote={(id) => { setActivePage('slidnote'); setActiveSlidNoteId(id); }}
                onCloseNote={() => setActiveSlidNoteId(null)}
              />
            )
            : <Board onTaskClick={handleTaskClick} onTickerTaskClick={handleExternalTaskClick} />
          }
        </main>
      </div>

      {activePage === 'dustflow' && activeFlowId && (
        <FlowEditor
          flowId={activeFlowId}
          onBack={() => setActiveFlowId(null)}
        />
      )}

      {showUsersModal && <UserModal onClose={() => setShowUsersModal(false)} />}
      {showProjectModal && <ProjectModal onClose={() => setShowProjectModal(false)} />}
      {showOrgsModal && <OrganizationModal onClose={() => setShowOrgsModal(false)} />}
      {(activeTaskId || initialStatusForNew || taskInitialData) && (
        <TaskModal
          taskId={activeTaskId}
          initialStatus={initialStatusForNew}
          initialData={taskInitialData}
          onClose={handleCloseTask}
          readOnly={taskReadOnly}
          onOpenInProject={taskShowProjectContext ? handleOpenInProject : undefined}
        />
      )}

      {noAccessPopup && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          }}
          onClick={() => setNoAccessPopup(false)}
        >
          <div
            style={{
              background: 'var(--bg-surface)', borderRadius: 12,
              padding: '28px 32px', width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', margin: 0 }}>
              Access Denied
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
              You don't have access to this project. Please contact your admin or project manager to request access.
            </p>
            <button
              onClick={() => setNoAccessPopup(false)}
              style={{
                marginTop: 4, padding: '10px 0', borderRadius: 8, border: 'none',
                background: 'var(--color-primary)', color: '#fff',
                fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
