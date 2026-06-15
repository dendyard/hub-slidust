import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const API_BASE = import.meta.env.VITE_API_BASE;

// Base for public share links, e.g. https://s.slidust.xyz/share — set via
// VITE_SHARE_BASE in production. Falls back to the backend (API_BASE minus /api)
// so local dev works without extra config.
export const SHARE_BASE =
  import.meta.env.VITE_SHARE_BASE || `${API_BASE.replace(/\/api\/?$/, '')}/share`;

// Resolve a stored upload path to a full URL.
// Handles both relative paths (new) and absolute URLs (legacy data in DB).
export const resolveUploadUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE}/${path}`;
};

export const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('pm_auth_token');
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('pm_auth_token');
    localStorage.removeItem('pm_auth_user');
    window.location.href = window.location.pathname;
  }
  return res;
};

const parseTasks = (data) =>
  (Array.isArray(data) ? data : []).map(t => ({
    ...t,
    priority: t.priority ?? 'Low',   // guard against legacy NULL rows in DB
    subtasks: (t.subtasks || []).map(s => ({ ...s, isDone: Number(s.isDone) }))
  }));

const normalizeFlowList = (response) => {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object') return [];

  const candidates = [
    response.flows,
    response.data,
    response.items,
    response.results,
  ];

  const list = candidates.find(Array.isArray);
  return Array.isArray(list)
    ? list.map(flow => ({
        visibility: 'public',
        editor_ids: [],
        ...flow,
        editor_ids: Array.isArray(flow?.editor_ids) ? flow.editor_ids : [],
      }))
    : [];
};

export const DataProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('pm_auth_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]); // [{project_id, user_id}]
  const [tasks, setTasks] = useState([]);
  const [workflows, setWorkflows] = useState([]); // [{id, project_id, name, color, position}]
  const [positions, setPositions] = useState([]); // [{id, name}]
  const [departments, setDepartments] = useState([]); // [{id, name}]
  const [notifications, setNotifications] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [flows, setFlows] = useState([]);
  const [notes, setNotes] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [organizationMembers, setOrganizationMembers] = useState([]);

  // Track which projects' tasks are already loaded to avoid redundant fetches
  const loadedProjectIdsRef = useRef(new Set());
  const allTasksLoadedRef   = useRef(false);

  // Synchronize currentUser with localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('pm_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('pm_auth_user');
    }
  }, [currentUser]);


  // Load tasks for a single project (lazy — only fetches if not already loaded)
  const fetchProjectTasks = useCallback(async (projectId) => {
    if (!projectId || loadedProjectIdsRef.current.has(projectId)) return;
    loadedProjectIdsRef.current.add(projectId);
    try {
      const res  = await authFetch(`${API_BASE}/tasks?project_id=${projectId}`);
      const data = await res.json();
      const parsed = parseTasks(data);
      setTasks(prev => [...prev.filter(t => t.projectId !== projectId), ...parsed]);
    } catch {
      loadedProjectIdsRef.current.delete(projectId); // allow retry on error
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load tasks for ALL projects — used by Dashboard and MyBoard
  const fetchAllTasks = useCallback(async () => {
    if (allTasksLoadedRef.current) return;
    allTasksLoadedRef.current = true;
    try {
      const res  = await authFetch(`${API_BASE}/tasks`);
      const data = await res.json();
      const parsed = parseTasks(data);
      setTasks(parsed);
      parsed.forEach(t => { if (t.projectId) loadedProjectIdsRef.current.add(t.projectId); });
    } catch {
      allTasksLoadedRef.current = false; // allow retry on error
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load Initial Data from API — re-runs when user logs in or out
  useEffect(() => {
    // Reset load-tracking refs so new user gets a fresh fetch
    loadedProjectIdsRef.current = new Set();
    allTasksLoadedRef.current   = false;

    const fetchData = async () => {
      if (!currentUser) { setIsLoading(false); return; }
      setIsLoading(true);
      try {
        // Phase 1: load all metadata (no tasks yet — much faster initial response)
        const [usersRes, projRes, projMembersRes, workflowsRes, positionsRes, depsRes, flowsRes, orgsRes, orgMembersRes] = await Promise.all([
          authFetch(`${API_BASE}/users`).then(r => r.json()),
          authFetch(`${API_BASE}/projects`).then(r => r.json()),
          authFetch(`${API_BASE}/project_members`).then(r => r.json()),
          authFetch(`${API_BASE}/workflows`).then(r => r.json()),
          authFetch(`${API_BASE}/positions`).then(r => r.json()),
          authFetch(`${API_BASE}/departments`).then(r => r.json()).catch(() => []),
          authFetch(`${API_BASE}/flows`).then(r => r.json()).catch(() => []),
          authFetch(`${API_BASE}/organizations`).then(r => r.json()).catch(() => []),
          authFetch(`${API_BASE}/organization_members`).then(r => r.json()).catch(() => []),
        ]);

        setUsers(Array.isArray(usersRes) ? usersRes : []);
        setProjects(Array.isArray(projRes) ? projRes : []);
        setProjectMembers(Array.isArray(projMembersRes) ? projMembersRes : []);
        setWorkflows(Array.isArray(workflowsRes) ? workflowsRes : []);
        setPositions(Array.isArray(positionsRes) ? positionsRes : []);
        setDepartments(Array.isArray(depsRes) ? depsRes : []);
        setFlows(normalizeFlowList(flowsRes));
        setOrganizations(Array.isArray(orgsRes) ? orgsRes : []);
        setOrganizationMembers(Array.isArray(orgMembersRes) ? orgMembersRes : []);

        // Determine active project from URL or first visible project
        const allProjects    = Array.isArray(projRes) ? projRes : [];
        const allProjMembers = Array.isArray(projMembersRes) ? projMembersRes : [];
        const activeOrgId    = currentUser?.active_organization_id ?? null;

        const roleFiltered = currentUser?.role === 'admin' || currentUser?.role === 'manager'
          ? allProjects
          : allProjects.filter(p => allProjMembers.some(pm => pm.project_id === p.id && pm.user_id === currentUser?.id));

        const allOrgMembers = Array.isArray(orgMembersRes) ? orgMembersRes : [];
        const userOrgIds    = allOrgMembers
          .filter(m => m.user_id === currentUser?.id)
          .map(m => m.organization_id);

        const userVisibleProjects = activeOrgId
          ? roleFiltered.filter(p => p.organization_id === activeOrgId)
          : userOrgIds.length > 0
            ? roleFiltered.filter(p => userOrgIds.includes(p.organization_id))
            : roleFiltered;

        let targetProjectId = null;
        if (userVisibleProjects.length > 0) {
          const urlProjectId = window.location.pathname.split('/').filter(Boolean)[1];
          targetProjectId    = urlProjectId && userVisibleProjects.some(p => p.id === urlProjectId)
            ? urlProjectId
            : userVisibleProjects[0].id;
          setActiveProjectId(targetProjectId);
        }

        // Phase 2: load all tasks so Dashboard shows complete data on first login
        allTasksLoadedRef.current = true;
        const tasksRes  = await authFetch(`${API_BASE}/tasks`);
        const tasksData = await tasksRes.json();
        const parsed    = parseTasks(tasksData);
        setTasks(parsed);
        parsed.forEach(t => { if (t.projectId) loadedProjectIdsRef.current.add(t.projectId); });
      } catch (e) {
        console.error("Failed to load data from API. Please ensure MAMP is running at localhost:8888 and setup.php has been executed.", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // When user switches to a different project, lazy-load its tasks if not yet fetched
  useEffect(() => {
    if (activeProjectId) fetchProjectTasks(activeProjectId);
  }, [activeProjectId, fetchProjectTasks]);

  const pollTasks = useCallback(() => {
    if (document.visibilityState !== 'visible' || !activeProjectId) return;
    // If all tasks are already in state (user visited Dashboard/MyBoard),
    // fetch all and replace to avoid any merge-related duplication.
    // Otherwise fetch only the active project and merge.
    if (allTasksLoadedRef.current) {
      authFetch(`${API_BASE}/tasks`)
        .then(r => r.json())
        .then(data => {
          if (!Array.isArray(data)) return;
          setTasks(parseTasks(data));
        })
        .catch(() => {});
    } else {
      authFetch(`${API_BASE}/tasks?project_id=${activeProjectId}`)
        .then(r => r.json())
        .then(data => {
          if (!Array.isArray(data)) return;
          const parsed = parseTasks(data);
          setTasks(prev => {
            const others = prev.filter(t => t.projectId !== activeProjectId);
            return [...others, ...parsed];
          });
        })
        .catch(() => {});
    }
  }, [activeProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll notifications + tasks — paused when tab is hidden, refreshed on visibility restore
  useEffect(() => {
    if (!currentUser?.id) { setNotifications([]); return; }

    const fetchNotifs = () => {
      if (document.visibilityState !== 'visible') return;
      authFetch(`${API_BASE}/notifications?user_id=${currentUser.id}`)
        .then(r => r.json())
        .then(data => setNotifications(Array.isArray(data) ? data : []))
        .catch(() => {});
    };

    // Refresh immediately when tab becomes visible again
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifs();
        pollTasks();
      }
    };

    fetchNotifs();
    pollTasks();

    const notifInterval = setInterval(fetchNotifs, 30000); // every 30s
    const taskInterval  = setInterval(pollTasks,   30000); // every 30s
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(notifInterval);
      clearInterval(taskInterval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentUser?.id, pollTasks]);

  // Reorder tasks within a column or move to another column, placing at insertIndex
  const reorderTasks = async (taskId, targetStatus, insertIndex) => {
    const movingTask = tasks.find(t => t.id === taskId);
    if (!movingTask) return;

    const isStatusChange = movingTask.status !== targetStatus;

    // Sorted tasks already in the target column
    const columnTasks = tasks
      .filter(t => t.projectId === activeProjectId && t.status === targetStatus)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    // Remove the moving task if it was already in this column
    const withoutMoving = columnTasks.filter(t => t.id !== taskId);

    // Insert at clamped index
    const idx = Math.max(0, Math.min(insertIndex, withoutMoving.length));
    withoutMoving.splice(idx, 0, { ...movingTask, status: targetStatus });

    const reorder = withoutMoving.map((t, i) => ({ id: t.id, position: i }));

    // Optimistic update
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) return { ...t, status: targetStatus, position: reorder.find(r => r.id === taskId)?.position ?? 0 };
      const r = reorder.find(r => r.id === t.id);
      return r ? { ...t, position: r.position } : t;
    }));

    await authFetch(`${API_BASE}/tasks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reorder',
        reorder,
        ...(isStatusChange ? { taskId, status: targetStatus, moved_by: currentUser?.id ?? null } : {})
      })
    });
  };

  const addTask = async (newTask) => {
    // Generate a temporary ID so UI updates instantly
    const tempId = `t${Date.now()}`;
    const columnTasks = tasks.filter(t => t.projectId === newTask.projectId && t.status === newTask.status);
    const maxPosition = columnTasks.reduce((max, t) => Math.max(max, t.position ?? 0), -1);
    const taskWithTempId = { ...newTask, id: tempId, subtasks: newTask.subtasks || [], position: maxPosition + 1, created_at: new Date().toISOString() };

    setTasks(prev => [...prev, taskWithTempId]);

    const res = await authFetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...taskWithTempId, assignee: taskWithTempId.assignee || null, assigned_by: currentUser?.id })
    });

    const data = await res.json();
    if (data.id && data.id !== tempId) {
      // Optional: Replace tempId with actual db assigned ID if the database re-generates it.
      // Currently, our API respects the ID sent from frontend (uniqid provided or tempId).
    }
    return taskWithTempId;
  };

  const updateTask = async (updatedTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    await authFetch(`${API_BASE}/tasks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updatedTask, assignee: updatedTask.assignee || null, assigned_by: currentUser?.id })
    });
  };

  const deleteTask = async (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    await authFetch(`${API_BASE}/tasks?id=${taskId}`, { method: 'DELETE' });
  };

  // Update task fields locally only (no API call) — used to sync counts (comments, attachments) without refetch
  const patchTask = (taskId, patches) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patches } : t));
  };

  // ---- Workflow Methods ----
  const getProjectWorkflow = (projectId) => {
    return workflows
      .filter(w => w.project_id === projectId)
      .sort((a, b) => a.position - b.position);
  };

  const addWorkflowStage = async (projectId, name, color, type = 'BACKLOG') => {
    try {
      const res = await authFetch(`${API_BASE}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name, color, type })
      });
      const data = await res.json();
      if (data && data.id) {
        setWorkflows(prev => [...prev, data]);
      }
      return data;
    } catch (e) { return { error: 'Server error' }; }
  };

  const updateWorkflowStage = async (id, updates) => {
    try {
      const res = await authFetch(`${API_BASE}/workflows`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      });
      const data = await res.json();
      if (data.success) {
        setWorkflows(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
      }
      return data;
    } catch (e) { return { error: 'Server error' }; }
  };

  const deleteWorkflowStage = async (id) => {
    try {
      const res = await authFetch(`${API_BASE}/workflows?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setWorkflows(prev => prev.filter(w => w.id !== id));
      }
      return data;
    } catch (e) { return { error: 'Server error' }; }
  };

  const reorderWorkflowStages = async (_projectId, orderedIds) => {
    const reorder = orderedIds.map((id, index) => ({ id, position: index }));
    setWorkflows(prev => prev.map(w => {
      const found = reorder.find(r => r.id === w.id);
      return found ? { ...w, position: found.position } : w;
    }));
    await authFetch(`${API_BASE}/workflows`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reorder })
    });
  };

  const addProject = async (newProject) => {
    const tempId = `p${Date.now()}`;

    const userOrgId = currentUser?.active_organization_id
      || organizationMembers.find(m => m.user_id === currentUser?.id)?.organization_id
      || null;

    const proj = { ...newProject, id: tempId, owner_id: currentUser?.id ?? null, organization_id: userOrgId };
    setProjects(prev => [...prev, proj]);

    await authFetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proj)
    });

    // Fetch the default workflow stages the backend auto-created and sync local state
    try {
      const wfRes = await authFetch(`${API_BASE}/workflows?project_id=${tempId}`);
      const wfData = await wfRes.json();
      if (Array.isArray(wfData)) {
        setWorkflows(prev => [
          ...prev.filter(w => w.project_id !== tempId), // remove any stale local entries
          ...wfData,
        ]);
      }
    } catch (_) { }

    return proj;
  };

  const updateProject = async (projectId, updates) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } : p));
    await authFetch(`${API_BASE}/projects`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: projectId, ...updates })
    });
  };

  const deleteProject = async (projectId) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setTasks(prev => prev.filter(t => t.projectId !== projectId));
    setWorkflows(prev => prev.filter(w => w.project_id !== projectId));
    await authFetch(`${API_BASE}/projects?id=${projectId}`, { method: 'DELETE' });
  };

  const updateUserAvatar = (userId, avatarUrl) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, avatar: avatarUrl } : u));
    if (currentUser?.id === userId) {
      setCurrentUser(prev => ({ ...prev, avatar: avatarUrl }));
    }
  };

  const addUser = async (newUser) => {
    const tempId = `u${Date.now()}`;
    const userToSave = { ...newUser, id: tempId, avatar: newUser.avatar ?? null };
    setUsers(prev => [...prev, userToSave]);

    await authFetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userToSave)
    });
    return tempId;
  };

  const handleLogin = async (username, password) => {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success && data.user) {
        // Store token but do NOT set currentUser yet when multiple orgs exist
        if (data.token) localStorage.setItem('pm_auth_token', data.token);

        // Fetch organizations the user belongs to
        let userOrgs = [];
        try {
          const [orgsRes, orgMembersRes] = await Promise.all([
            fetch(`${API_BASE}/organizations`, { headers: { Authorization: `Bearer ${data.token}` } }).then(r => r.json()),
            fetch(`${API_BASE}/organization_members`, { headers: { Authorization: `Bearer ${data.token}` } }).then(r => r.json()),
          ]);
          const allOrgs = Array.isArray(orgsRes) ? orgsRes : [];
          const allMembers = Array.isArray(orgMembersRes) ? orgMembersRes : [];
          userOrgs = allOrgs.filter(org =>
            allMembers.some(m => m.organization_id === org.id && m.user_id === data.user.id)
          );
        } catch (_) {}

        if (userOrgs.length > 1) {
          // Return org list so Login can show a picker
          return { success: true, needOrgSelect: true, user: data.user, token: data.token, organizations: userOrgs };
        }

        // Single or no org — finalize login immediately
        const selectedOrgId = userOrgs.length === 1 ? userOrgs[0].id : null;
        setCurrentUser({ ...data.user, active_organization_id: selectedOrgId });
        return { success: true, needOrgSelect: false };
      }
      return { success: false };
    } catch (e) {
      console.error(e);
      return { success: false };
    }
  };

  // Called after user picks an org from the picker
  const finalizeLogin = (user, orgId) => {
    setCurrentUser({ ...user, active_organization_id: orgId });
  };

  const handleLogout = () => {
    localStorage.removeItem('pm_auth_token');
    setCurrentUser(null);
    setUsers([]);
    setProjects([]);
    setProjectMembers([]);
    setTasks([]);
    setWorkflows([]);
    setPositions([]);
    setDepartments([]);
    setNotifications([]);
    setFlows([]);
    setNotes([]);
    setActiveProjectId(null);
  };

  const updateUserProfile = async (requesterId, targetUserId, data) => {
    try {
      const res = await authFetch(`${API_BASE}/users`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_profile',
          requesterId,
          targetUserId,
          ...data
        })
      });
      const resData = await res.json();
      if (resData.success) {
        // Update local state
        setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, ...data } : u));
      }
      return resData;
    } catch (e) {
      return { error: 'Server error' };
    }
  };

  const toggleProjectMemberAPI = async (projectId, userId, action) => { // action = 'add' or 'remove'
    try {
      const res = await authFetch(`${API_BASE}/project_members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, user_id: userId, action })
      });
      const data = await res.json();
      if (data.success) {
        if (action === 'add') {
          setProjectMembers(prev => [...prev, { project_id: projectId, user_id: userId }]);
        } else {
          setProjectMembers(prev => prev.filter(pm => !(pm.project_id === projectId && pm.user_id === userId)));
        }
      }
      return data;
    } catch (e) {
      return { error: 'Server error' };
    }
  };

  const resetUserPassword = async (requesterId, targetUserId, newPassword) => {
    try {
      const res = await authFetch(`${API_BASE}/users`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          requesterId,
          targetUserId,
          newPassword
        })
      });
      const data = await res.json();
      return data;
    } catch (e) {
      return { error: 'Failed to contact server.' };
    }
  };

  // ── Notifications ───────────────────────────────────────────────
  const markNotificationRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await authFetch(`${API_BASE}/notifications`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  const markAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    if (currentUser?.id) {
      await authFetch(`${API_BASE}/notifications`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id }),
      });
    }
  };

  const clearNotifications = async () => {
    setNotifications([]);
    if (currentUser?.id) {
      await authFetch(`${API_BASE}/notifications?user_id=${currentUser.id}`, { method: 'DELETE' });
    }
  };
  // ────────────────────────────────────────────────────────────────

  // ── Flows CRUD ─────────────────────────────────────────────────
  const createFlow = async (name) => {
    const id     = `fl${Date.now()}`;
    const orgId  = currentUser?.active_organization_id || null;
    const flow   = { id, name, owner_id: currentUser.id, organization_id: orgId, visibility: 'public', editor_ids: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setFlows(prev => [flow, ...prev]);
    await authFetch(`${API_BASE}/flows`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flow),
    });
    return flow;
  };

  const updateFlow = async (id, changes) => {
    const nextChanges = typeof changes === 'string' ? { name: changes } : (changes || {});
    setFlows(prev => prev.map(f => f.id === id ? { ...f, ...nextChanges, updated_at: new Date().toISOString() } : f));
    await authFetch(`${API_BASE}/flows`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...nextChanges }),
    });
  };

  const saveFlowData = async (id, flowData) => {
    setFlows(prev => prev.map(f => f.id === id ? { ...f, updated_at: new Date().toISOString() } : f));
    await authFetch(`${API_BASE}/flows`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, flow_data: flowData }),
    });
  };

  const loadFlowData = async (id) => {
    const res = await authFetch(`${API_BASE}/flows?id=${id}`);
    const data = await res.json();
    return data?.flow_data || { nodes: [], edges: [] };
  };

  const deleteFlow = async (id) => {
    setFlows(prev => prev.filter(f => f.id !== id));
    await authFetch(`${API_BASE}/flows?id=${id}`, { method: 'DELETE' });
  };

  const canEditFlow = useCallback((flow, user = currentUser) => {
    if (!flow || !user?.id) return false;
    return flow.owner_id === user.id || (Array.isArray(flow.editor_ids) && flow.editor_ids.includes(user.id));
  }, [currentUser]);
  // ───────────────────────────────────────────────────────────────

  // ── Position CRUD ──────────────────────────────────────────────
  const addPosition = async (name) => {
    const id = `pos${Date.now()}`;
    const pos = { id, name };
    setPositions(prev => [...prev, pos].sort((a, b) => a.name.localeCompare(b.name)));
    await authFetch(`${API_BASE}/positions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pos),
    });
    return pos;
  };

  const updatePosition = async (id, name) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, name } : p).sort((a, b) => a.name.localeCompare(b.name)));
    await authFetch(`${API_BASE}/positions`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
  };

  const deletePosition = async (id) => {
    setPositions(prev => prev.filter(p => p.id !== id));
    setUsers(prev => prev.map(u => u.position_id === id ? { ...u, position_id: null } : u));
    await authFetch(`${API_BASE}/positions?id=${id}`, { method: 'DELETE' });
  };
  // ───────────────────────────────────────────────────────────────

  // ── Department CRUD ────────────────────────────────────────────
  const addDepartment = async (name) => {
    const id = `dep${Date.now()}`;
    const dep = { id, name };
    setDepartments(prev => [...prev, dep].sort((a, b) => a.name.localeCompare(b.name)));
    await authFetch(`${API_BASE}/departments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dep),
    });
    return dep;
  };

  const updateDepartment = async (id, name) => {
    setDepartments(prev => prev.map(d => d.id === id ? { ...d, name } : d).sort((a, b) => a.name.localeCompare(b.name)));
    await authFetch(`${API_BASE}/departments`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
  };

  const deleteDepartment = async (id) => {
    setDepartments(prev => prev.filter(d => d.id !== id));
    setUsers(prev => prev.map(u => u.department_id === id ? { ...u, department_id: null } : u));
    await authFetch(`${API_BASE}/departments?id=${id}`, { method: 'DELETE' });
  };
  // ───────────────────────────────────────────────────────────────

  // ── Notes CRUD ────────────────────────────────────────────────
  const fetchNotes = async (projectId) => {
    if (!projectId) return;
    const res = await authFetch(`${API_BASE}/notes?project_id=${projectId}`);
    const data = await res.json();
    setNotes(prev => {
      const otherProjects = prev.filter(n => n.project_id !== projectId);
      return [...otherProjects, ...(Array.isArray(data) ? data : [])];
    });
  };

  const addNote = async (projectId, createdBy) => {
    const tempId = `note_tmp_${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic = { id: tempId, project_id: projectId, title: '', content: '', created_by: createdBy, created_at: now, updated_at: now };
    setNotes(prev => [optimistic, ...prev]);
    const res = await authFetch(`${API_BASE}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, title: '', content: '', created_by: createdBy }),
    });
    const data = await res.json();
    setNotes(prev => prev.map(n => n.id === tempId ? { ...n, id: data.id } : n));
    return data.id || tempId;
  };

  const updateNote = async (id, changes) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...changes, updated_at: new Date().toISOString() } : n));
    await authFetch(`${API_BASE}/notes`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...changes }),
    });
  };

  const deleteNote = async (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    await authFetch(`${API_BASE}/notes?id=${id}`, { method: 'DELETE' });
  };
  // ── Organizations ───────────────────────────────────────────────

  const addOrganization = async (name) => {
    const id = `org_${Date.now()}`;
    const res = await authFetch(`${API_BASE}/organizations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
    const data = await res.json();
    if (data.id) setOrganizations(prev => [...prev, { ...data, created_by_name: currentUser?.name }]);
    return data;
  };

  const updateOrganization = async (id, name) => {
    setOrganizations(prev => prev.map(o => o.id === id ? { ...o, name } : o));
    await authFetch(`${API_BASE}/organizations`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
  };

  const deleteOrganization = async (id) => {
    setOrganizations(prev => prev.filter(o => o.id !== id));
    setOrganizationMembers(prev => prev.filter(m => m.organization_id !== id));
    setProjects(prev => prev.map(p => p.organization_id === id ? { ...p, organization_id: null } : p));
    await authFetch(`${API_BASE}/organizations?id=${id}`, { method: 'DELETE' });
  };

  const toggleOrganizationMember = async (orgId, userId, action) => {
    const res = await authFetch(`${API_BASE}/organization_members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: orgId, user_id: userId, action }),
    });
    const data = await res.json();
    if (!data.error) {
      if (action === 'add') setOrganizationMembers(prev => [...prev, { organization_id: orgId, user_id: userId }]);
      else setOrganizationMembers(prev => prev.filter(m => !(m.organization_id === orgId && m.user_id === userId)));
    }
    return data;
  };

  const toggleOrganizationProject = async (orgId, projectId, action) => {
    const res = await authFetch(`${API_BASE}/organization_projects`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: orgId, project_id: projectId, action }),
    });
    const data = await res.json();
    if (!data.error) {
      setProjects(prev => prev.map(p =>
        p.id === projectId
          ? { ...p, organization_id: action === 'assign' ? orgId : null }
          : p
      ));
    }
    return data;
  };

  // ───────────────────────────────────────────────────────────────

  // ── Org-scoped derived state ─────────────────────────────────────
  const activeOrgId = currentUser?.active_organization_id ?? null;

  // 1. Projects: role filter first, then org filter
  const visibleProjects = !Array.isArray(projects) ? [] : (() => {
    const roleFiltered = currentUser?.role === 'admin' || currentUser?.role === 'manager'
      ? projects
      : projects.filter(p => projectMembers.some(pm => pm.project_id === p.id && pm.user_id === currentUser?.id));

    if (activeOrgId) return roleFiltered.filter(p => p.organization_id === activeOrgId);

    // No active org: restrict to projects belonging to orgs the user is a member of
    const userOrgIds = organizationMembers
      .filter(m => m.user_id === currentUser?.id)
      .map(m => m.organization_id);

    return userOrgIds.length > 0
      ? roleFiltered.filter(p => userOrgIds.includes(p.organization_id))
      : roleFiltered;
  })();

  const visibleProjectIds = new Set(visibleProjects.map(p => p.id));

  // 2. Tasks: only those belonging to visible projects
  const visibleTasks = tasks.filter(t => visibleProjectIds.has(t.projectId));

  // 3. Workflows: only those belonging to visible projects
  const visibleWorkflows = workflows.filter(w => visibleProjectIds.has(w.project_id));

  const visibleFlows = flows.filter(flow => {
    // Org filter: when an active org is set, only show flows from that org.
    // Flows with no organization_id are legacy/global — always visible.
    if (activeOrgId && flow.organization_id && flow.organization_id !== activeOrgId) return false;

    // Visibility filter
    return (flow.visibility || 'public') !== 'private'
      || flow.owner_id === currentUser?.id
      || (Array.isArray(flow.editor_ids) && flow.editor_ids.includes(currentUser?.id));
  });

  const value = {
    currentUser,
    handleLogin,
    finalizeLogin,
    resetUserPassword,
    updateUserProfile,
    toggleProjectMemberAPI,
    handleLogout,
    users,
    projects:   visibleProjects,
    projectMembers,
    tasks:      visibleTasks,
    workflows:  visibleWorkflows,
    getProjectWorkflow,
    addWorkflowStage,
    updateWorkflowStage,
    deleteWorkflowStage,
    reorderWorkflowStages,
    activeProjectId,
    setActiveProjectId,
    reorderTasks,
    addTask,
    updateTask,
    deleteTask,
    patchTask,
    pollTasks,
    fetchProjectTasks,
    fetchAllTasks,
    addProject,
    updateProject,
    deleteProject,
    addUser,
    updateUserAvatar,
    setUsers,
    setProjects,
    positions,
    addPosition,
    updatePosition,
    deletePosition,
    departments,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    flows: visibleFlows,
    canEditFlow,
    createFlow,
    updateFlow,
    saveFlowData,
    loadFlowData,
    deleteFlow,
    notes,
    fetchNotes,
    addNote,
    updateNote,
    deleteNote,
    organizations,
    organizationMembers,
    addOrganization,
    updateOrganization,
    deleteOrganization,
    toggleOrganizationMember,
    toggleOrganizationProject,
  };

  return (
    <DataContext.Provider value={value}>
      {!currentUser || !isLoading ? children : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <img src="/loading.gif" alt="" style={{ width: '80px', height: '80px' }} />
        </div>
      )}
    </DataContext.Provider>
  );
};
