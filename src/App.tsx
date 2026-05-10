import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { api } from './api';
import './App.css';

// ─── THEME CONTEXT ───────────────────────────────────────────
const ThemeContext = createContext<{ theme: string; toggleTheme: () => void }>({
  theme: 'dark',
  toggleTheme: () => {},
});

// ─── AUTH CONTEXT ────────────────────────────────────────────
const AuthContext = createContext<{
  user: any;
  login: (token: string, user: any) => void;
  logout: () => void;
}>({ user: null, login: () => {}, logout: () => {} });

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.me().then(setUser).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token: string, userData: any) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  if (loading) return (
    <div className="splash">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  );

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <AuthContext.Provider value={{ user, login, logout }}>
        {user ? <Dashboard /> : <AuthPage />}
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}

// ─── AUTH PAGE ───────────────────────────────────────────────
function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { login } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);

  // Step tracking for register: 'admin-verify' → 'fill-form'
  const [registerStep, setRegisterStep] = useState<'admin-verify' | 'fill-form'>('admin-verify');

  const [adminCreds, setAdminCreds] = useState({ admin_id: '', admin_password: '' });
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset state when switching tabs
  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError('');
    setRegisterStep('admin-verify');
    setAdminCreds({ admin_id: '', admin_password: '' });
    setForm({ name: '', email: '', password: '', role: 'member' });
  };

  // Step 1: verify admin
  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.verifyAdmin(adminCreds.admin_id, adminCreds.admin_password);
      setRegisterStep('fill-form');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: actual registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.register({
        ...form,
        admin_id: adminCreds.admin_id,
        admin_password: adminCreds.admin_password,
      });
      login(res.token, res.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login({ email: form.email, password: form.password });
      login(res.token, res.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <button className="theme-toggle-float" onClick={toggleTheme}>
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-icon">⚡</span>
          <h1>TaskFlow</h1>
          <p>Team Task Manager</p>
        </div>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
            Login
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>
            Register
          </button>
        </div>

        {/* ── LOGIN ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="field">
              <label>Email</label>
              <input type="email" placeholder="you@example.com" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            {error && <div className="error-msg">⚠️ {error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* ── REGISTER STEP 1: Admin Verification ── */}
        {mode === 'register' && registerStep === 'admin-verify' && (
          <form onSubmit={handleAdminVerify} className="auth-form">
            <div className="admin-verify-banner">
              🔐 Admin approval required to create accounts
            </div>
            <div className="field">
              <label>Admin ID</label>
              <input
                placeholder="Enter admin ID"
                value={adminCreds.admin_id}
                onChange={e => setAdminCreds({ ...adminCreds, admin_id: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Admin Password</label>
              <input
                type="password"
                placeholder="Enter admin password"
                value={adminCreds.admin_password}
                onChange={e => setAdminCreds({ ...adminCreds, admin_password: e.target.value })}
                required
              />
            </div>
            {error && <div className="error-msg">⚠️ {error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Continue →'}
            </button>
          </form>
        )}

        {/* ── REGISTER STEP 2: Fill User Details ── */}
        {mode === 'register' && registerStep === 'fill-form' && (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="admin-verified-banner">
              ✅ Admin verified — fill in new user details
            </div>
            <div className="field">
              <label>Full Name</label>
              <input placeholder="John Doe" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" placeholder="user@example.com" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" placeholder="Min 6 characters" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <div className="error-msg">⚠️ {error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
            <button
              type="button"
              className="btn-back"
              onClick={() => { setRegisterStep('admin-verify'); setError(''); }}
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
// ─── DASHBOARD ───────────────────────────────────────────────
function Dashboard() {
  const { user, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [page, setPage] = useState<'home' | 'projects' | 'tasks'>('home');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const openProject = (project: any) => {
    setSelectedProject(project);
    setPage('tasks');
  };

  return (
    <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-icon">⚡</span>
          {sidebarOpen && <span className="logo-text">TaskFlow</span>}
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          <button className={page === 'home' ? 'active' : ''} onClick={() => setPage('home')}>
            <span>🏠</span>{sidebarOpen && <span>Dashboard</span>}
          </button>
          <button className={page === 'projects' ? 'active' : ''} onClick={() => setPage('projects')}>
            <span>📁</span>{sidebarOpen && <span>Projects</span>}
          </button>
          {selectedProject && (
            <button className={page === 'tasks' ? 'active' : ''} onClick={() => setPage('tasks')}>
              <span>✅</span>{sidebarOpen && <span>Tasks</span>}
            </button>
          )}
        </nav>

        <div className="sidebar-footer">
          <button onClick={toggleTheme}>
            <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
            {sidebarOpen && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <button onClick={logout} className="logout-btn">
            <span>🚪</span>{sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <h2>{page === 'home' ? 'Dashboard' : page === 'projects' ? 'Projects' : selectedProject?.name}</h2>
            {selectedProject && page === 'tasks' && (
              <p className="breadcrumb">
                <button onClick={() => setPage('projects')}>Projects</button> / {selectedProject.name}
              </p>
            )}
          </div>
          <div className="user-chip">
            <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div>
              <p className="user-name">{user?.name}</p>
              <p className="user-role">{user?.role}</p>
            </div>
          </div>
        </header>

        <div className="page-body">
          {page === 'home' && <HomePage />}
          {page === 'projects' && <ProjectsPage onOpenProject={openProject} />}
          {page === 'tasks' && selectedProject && <TasksPage project={selectedProject} />}
        </div>
      </main>
    </div>
  );
}

// ─── HOME PAGE ───────────────────────────────────────────────
function HomePage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.dashboard().then(setStats).catch(console.error);
  }, []);

  if (!stats) return <div className="loading">Loading dashboard...</div>;

  const cards = [
    { label: 'Projects', value: stats.total_projects, icon: '📁', color: 'blue' },
    { label: 'Total Tasks', value: stats.total_tasks, icon: '📋', color: 'purple' },
    { label: 'My Tasks', value: stats.my_tasks, icon: '👤', color: 'green' },
    { label: 'Overdue', value: stats.overdue_tasks, icon: '⚠️', color: 'red' },
  ];

  return (
    <div className="home-page">
      <div className="stat-grid">
        {cards.map(c => (
          <div key={c.label} className={`stat-card stat-${c.color}`}>
            <div className="stat-icon">{c.icon}</div>
            <div>
              <p className="stat-value">{c.value}</p>
              <p className="stat-label">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="progress-section">
        <h3>Task Overview</h3>
        <div className="progress-bars">
          {[
            { label: 'To Do', count: stats.todo, color: '#6366f1' },
            { label: 'In Progress', count: stats.in_progress, color: '#f59e0b' },
            { label: 'Done', count: stats.done, color: '#10b981' },
          ].map(s => (
            <div key={s.label} className="progress-item">
              <div className="progress-meta">
                <span>{s.label}</span>
                <span>{s.count}</span>
              </div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${stats.total_tasks ? (s.count / stats.total_tasks) * 100 : 0}%`,
                    background: s.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {stats.recent_tasks?.length > 0 && (
        <div className="recent-tasks">
          <h3>Recent Tasks</h3>
          <div className="task-list-simple">
            {stats.recent_tasks.map((t: any) => (
              <div key={t.id} className="task-row-simple">
                <span className={`status-dot status-${t.status}`} />
                <span className="task-title-sm">{t.title}</span>
                <span className={`priority-badge priority-${t.priority}`}>{t.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PROJECTS PAGE ───────────────────────────────────────────
function ProjectsPage({ onOpenProject }: { onOpenProject: (p: any) => void }) {
  const { user } = useContext(AuthContext);
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');

  const load = () => api.getProjects().then(setProjects).catch(console.error);
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.createProject(form);
      setForm({ name: '', description: '' });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this project and all its tasks?')) return;
    await api.deleteProject(id);
    load();
  };

  return (
    <div className="projects-page">
      <div className="page-header">
        <h3>{projects.length} Project{projects.length !== 1 ? 's' : ''}</h3>
        {user?.role === 'admin' && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Project'}
          </button>
        )}
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={create}>
          <input placeholder="Project name" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Description (optional)" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} />
          {error && <div className="error-msg">⚠️ {error}</div>}
          <button type="submit" className="btn-primary">Create</button>
        </form>
      )}

      <div className="project-grid">
        {projects.length === 0 && (
          <div className="empty-state">
            <p>📁</p>
            <p>{user?.role === 'admin' ? 'Create your first project!' : 'No projects assigned yet.'}</p>
          </div>
        )}
        {projects.map((p: any) => (
          <div key={p.id} className="project-card" onClick={() => onOpenProject(p)}>
            <div className="project-card-header">
              <h4>{p.name}</h4>
              {user?.role === 'admin' && (
                <button className="icon-btn danger" onClick={e => { e.stopPropagation(); remove(p.id); }}>🗑</button>
              )}
            </div>
            <p className="project-desc">{p.description || 'No description'}</p>
            <div className="project-meta">
              <span>👥 {p.member_count} members</span>
              <span>✅ {p.task_count} tasks</span>
            </div>
            <div className="project-footer">
              <span className={`status-badge status-${p.status}`}>{p.status}</span>
              <span className="owner-label">by {p.owner_name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TASK TIMER COMPONENT ────────────────────────────────
// ─── TASK TIMER COMPONENT ────────────────────────────────
function TaskTimer({ taskId, taskStatus}: { 
  taskId: string; 
  taskStatus: string;
}) {
  const [elapsed, setElapsed] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [screenPermission, setScreenPermission] = useState<'none' | 'granted' | 'denied'>('none');
  const intervalRef = useRef<any>(null);
  const screenshotIntervalRef = useRef<any>(null);
  const saveIntervalRef = useRef<any>(null);

  // ── Auto-pause when task is moved to "done" ──
  useEffect(() => {
    if (taskStatus === 'done' && running) {
      handlePause();
    }
  }, [taskStatus]);

  // ── Load timer state from server on mount ──
  useEffect(() => {
    api.getTimer(taskId).then((saved) => {
      if (saved.running && saved.startedAt) {
        const missed = Math.floor((Date.now() - saved.startedAt) / 1000);
        const resumed = (saved.elapsed || 0) + missed;
        setElapsed(resumed);
        setRunning(true);
        setStartedAt(Date.now());
      } else {
        setElapsed(saved.elapsed || 0);
        setRunning(false);
        setStartedAt(null);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [taskId]);

  // ── Tick every second ──
  useEffect(() => {
    if (!loaded) return;
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, loaded]);

  // ── Auto-save to server every 10 seconds while running ──
  useEffect(() => {
    if (!loaded) return;
    clearInterval(saveIntervalRef.current);
    if (running) {
      saveIntervalRef.current = setInterval(() => {
        setElapsed(prev => {
          api.saveTimer(taskId, { elapsed: prev, running: true, startedAt: startedAt ?? Date.now() });
          return prev;
        });
      }, 10000);
    }
    return () => clearInterval(saveIntervalRef.current);
  }, [running, startedAt, loaded]);

  // ── Screenshot every 5 min using the kept-alive stream ──
  useEffect(() => {
    if (!loaded) return;
    clearInterval(screenshotIntervalRef.current);
    if (running && screenStream) {
      screenshotIntervalRef.current = setInterval(() => {
        captureFromStream(screenStream, taskId);
      }, 5 * 60 * 1000);
    }
    return () => clearInterval(screenshotIntervalRef.current);
  }, [running, screenStream, loaded]);

  // ── Stop stream when component unmounts ──
  useEffect(() => {
    return () => {
      screenStream?.getTracks().forEach(t => t.stop());
    };
  }, [screenStream]);

  const captureFromStream = async (stream: MediaStream, tid: string) => {
    try {
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState === 'ended') return;
      const imageCapture = new (window as any).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      await api.saveScreenshot(tid, dataUrl);
    } catch (err) {
      console.warn('Screenshot capture failed:', err);
    }
  };

  const requestScreenPermission = async (): Promise<MediaStream | null> => {
    try {
      // This MUST be called from a direct user click — which handleStart is
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { mediaSource: 'screen' },
        audio: false,
      });
      // If user later stops sharing via browser UI, clean up
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        setScreenStream(null);
        setScreenPermission('denied');
      });
      setScreenStream(stream);
      setScreenPermission('granted');
      return stream;
    } catch {
      setScreenPermission('denied');
      return null;
    }
  };

  const handleStart = async () => {
    const now = Date.now();
    setStartedAt(now);
    setRunning(true);
    api.saveTimer(taskId, { elapsed, running: true, startedAt: now });

    // Request screen share on first start (direct user gesture = browser allows prompt)
    if (screenPermission === 'none') {
      const stream = await requestScreenPermission();
      // Take a first screenshot immediately on start
      if (stream) captureFromStream(stream, taskId);
    }
  };

  const handlePause = () => {
    setRunning(false);
    setElapsed(prev => {
      api.saveTimer(taskId, { elapsed: prev, running: false, startedAt: null });
      return prev;
    });
  };

  const handleReset = () => {
    setRunning(false);
    setElapsed(0);
    setStartedAt(null);
    screenStream?.getTracks().forEach(t => t.stop());
    setScreenStream(null);
    setScreenPermission('none');
    api.resetTimer(taskId);
  };

  const format = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  if (!loaded) return <div className="task-timer"><span className="timer-time">--:--:--</span></div>;

  return (
    <div className={`task-timer ${running ? 'timer-running' : elapsed > 0 ? 'timer-paused' : ''}`}>
      <div className="timer-display">
        <span className="timer-icon">{running ? '⏱' : elapsed > 0 ? '⏸' : '⏱'}</span>
        <span className="timer-time">{format(elapsed)}</span>
        {screenPermission === 'granted' && <span title="Screen recording active" style={{fontSize:'10px', color:'#10b981'}}>● REC</span>}
        {screenPermission === 'denied' && <span title="Screen share denied — screenshots disabled" style={{fontSize:'10px', color:'#f59e0b'}}>⚠ No screen</span>}
      </div>
      <div className="timer-controls">
        {!running ? (
          <button className="timer-btn start" onClick={handleStart}>
            {elapsed > 0 ? '▶ Resume' : '▶ Start'}
          </button>
        ) : (
          <button className="timer-btn pause" onClick={handlePause}>
            ⏸ Pause
          </button>
        )}
        {elapsed > 0 && (
          <button className="timer-btn reset" onClick={handleReset}>
            ↺ Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ─── TASKS PAGE ──────────────────────────────────────────────
function TasksPage({ project }: { project: any }) {
  const { user } = useContext(AuthContext);
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'members'>('tasks');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', assignee_id: '', due_date: '', priority: 'medium'
  });
  const [memberEmail, setMemberEmail] = useState('');
  const [error, setError] = useState('');
  const [filterMine, setFilterMine] = useState(false); // ✅ filter toggle
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const loadTasks = () => api.getTasks(project.id).then(setTasks).catch(console.error);
  const loadMembers = () => api.getMembers(project.id).then(setMembers).catch(console.error);

  useEffect(() => {
    loadTasks();
    loadMembers();
    api.getUsers().then(setAllUsers).catch(console.error);
  }, [project.id]);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.createTask(project.id, {
        ...taskForm,
        assignee_id: taskForm.assignee_id || null
      });
      setTaskForm({ title: '', description: '', assignee_id: '', due_date: '', priority: 'medium' });
      setShowTaskForm(false);
      loadTasks();
    } catch (err: any) { setError(err.message); }
  };

  const updateStatus = async (taskId: string, status: string) => {
    try {
      await api.updateTask(project.id, taskId, { status });
      loadTasks();
    } catch (err: any) { alert(err.message); }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    await api.deleteTask(project.id, taskId);
    loadTasks();
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.addMember(project.id, memberEmail);
      setMemberEmail('');
      setShowMemberForm(false);
      loadMembers();
    } catch (err: any) { setError(err.message); }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this member?')) return;
    await api.removeMember(project.id, memberId);
    loadMembers();
  };

  const columns = [
    { key: 'todo', label: '📋 To Do', color: '#6366f1' },
    { key: 'in_progress', label: '🔄 In Progress', color: '#f59e0b' },
    { key: 'done', label: '✅ Done', color: '#10b981' },
  ];

  // ✅ Filtered tasks: members can optionally filter to only their tasks
  const visibleTasks = filterMine
    ? tasks.filter(t => t.is_mine)
    : tasks;

  // ✅ Members can only move tasks assigned to them
  const canMoveTask = (task: any) => {
    if (user?.role === 'admin') return true;
    return task.is_mine;
  };

  return (
    <div className="tasks-page">
      <div className="tasks-tabs">
        <button className={activeTab === 'tasks' ? 'active' : ''} onClick={() => setActiveTab('tasks')}>
          ✅ Tasks
        </button>
        <button className={activeTab === 'members' ? 'active' : ''} onClick={() => setActiveTab('members')}>
          👥 Members
        </button>
      </div>

      {/* ── TASKS TAB ── */}
      {activeTab === 'tasks' && (
        <>
          <div className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3>{visibleTasks.length} Tasks</h3>
              {/* ✅ "My Tasks" filter — useful for both admin & member */}
              <button
                className={`filter-btn ${filterMine ? 'active' : ''}`}
                onClick={() => setFilterMine(!filterMine)}
              >
                👤 My Tasks {filterMine ? '✓' : ''}
              </button>
            </div>
            {user?.role === 'admin' && (
              <button className="btn-primary" onClick={() => setShowTaskForm(!showTaskForm)}>
                {showTaskForm ? 'Cancel' : '+ New Task'}
              </button>
            )}
          </div>

          {/* ✅ Task creation form — only for admins */}
          {showTaskForm && user?.role === 'admin' && (
            <form className="inline-form task-form" onSubmit={createTask}>
              <input
                placeholder="Task title *"
                value={taskForm.title}
                onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                required
              />
              <textarea
                placeholder="Description (optional)"
                value={taskForm.description}
                onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
              />
              <div className="form-row">
                {/* ✅ Assign to: shows all project members INCLUDING current user */}
                <select
                  value={taskForm.assignee_id}
                  onChange={e => setTaskForm({ ...taskForm, assignee_id: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {members.map((m: any) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name}{m.is_current_user ? ' (You)' : ''} — {m.role}
                    </option>
                  ))}
                </select>
                <select
                  value={taskForm.priority}
                  onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}
                >
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
                <input
                  type="date"
                  value={taskForm.due_date}
                  onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })}
                />
              </div>
              {error && <div className="error-msg">⚠️ {error}</div>}
              <button type="submit" className="btn-primary">Create Task</button>
            </form>
          )}

          {/* ✅ Member info banner */}
          {user?.role === 'member' && (
            <div className="info-banner">
              👋 You can update the status of tasks assigned to you. Tasks marked <strong>(Yours)</strong> are yours to move.
            </div>
          )}

          <div className="kanban-board">
            {columns.map(col => (
              <div key={col.key} className="kanban-column">
                <div className="kanban-header" style={{ borderColor: col.color }}>
                  <span>{col.label}</span>
                  <span className="col-count">
                    {visibleTasks.filter(t => t.status === col.key).length}
                  </span>
                </div>
                <div className="kanban-cards">
                  {visibleTasks.filter(t => t.status === col.key).map((t: any) => (
                    <div
                      key={t.id}
                      className={`task-card ${t.is_mine ? 'task-mine' : ''}`}
                    >
                      <div className="task-card-header">
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className={`priority-badge priority-${t.priority}`}>{t.priority}</span>
                          {/* ✅ Show "(Yours)" tag so member knows which tasks they own */}
                          {t.is_mine && (
                            <span className="mine-badge">Yours</span>
                          )}
                        </div>
                        {user?.role === 'admin' && (
                          <button className="icon-btn danger sm" onClick={() => deleteTask(t.id)}>🗑</button>
                        )}
                      </div>

                      <h4>{t.title}</h4>
                      {t.description && <p className="task-desc">{t.description}</p>}

                      <div className="task-meta">
                        <span>👤 {t.assignee_name}</span>
                        {t.due_date && (
                          <span className={
                            new Date(t.due_date) < new Date() && t.status !== 'done' ? 'overdue' : ''
                          }>
                            📅 {t.due_date}
                          </span>
                        )}
                      </div>
                      {/* ✅ Live Timer */}
                    <TaskTimer taskId={t.id} taskStatus={t.status} />

                    {/* Status action buttons */}
                    {canMoveTask(t) && (
                      <div className="status-actions">
                        {col.key !== 'todo' && (
                          <button
                            className="status-btn"
                            onClick={() => updateStatus(t.id, col.key === 'in_progress' ? 'todo' : 'in_progress')}
                          >
                            ◀ {col.key === 'in_progress' ? 'To Do' : 'In Progress'}
                          </button>
                        )}
                        {col.key !== 'done' && (
                          <button
                            className="status-btn advance"
                            onClick={() => updateStatus(t.id, col.key === 'todo' ? 'in_progress' : 'done')}
                          >
                            {col.key === 'todo' ? 'Start ▶' : 'Done ✓'}
                          </button>
                        )}
                      </div>
                    )}

                    {user?.role === 'member' && !t.is_mine && (
                      <p className="locked-hint">🔒 Assigned to {t.assignee_name}</p>
                    )}
                      

                      {/* ✅ If member but not their task — show locked hint */}
                      {user?.role === 'member' && !t.is_mine && (
                        <p className="locked-hint">🔒 Assigned to {t.assignee_name}</p>
                      )}
                    </div>
                  ))}

                  {visibleTasks.filter(t => t.status === col.key).length === 0 && (
                    <div className="empty-col">
                      {filterMine ? 'No tasks assigned to you' : 'No tasks'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── MEMBERS TAB ── */}
      {activeTab === 'members' && (
        <div className="members-section">
          <div className="page-header">
            <h3>{members.length} Members</h3>
            {user?.role === 'admin' && (
              <button className="btn-primary" onClick={() => setShowMemberForm(!showMemberForm)}>
                {showMemberForm ? 'Cancel' : '+ Add Member'}
              </button>
            )}
          </div>

          {showMemberForm && (
            <form className="inline-form" onSubmit={addMember}>
              {/* ✅ Dropdown of all registered users not already in project */}
              <div className="field">
                <label>Select User to Add</label>
                <select
                  value={memberEmail}
                  onChange={e => setMemberEmail(e.target.value)}
                  required
                >
                  <option value="">— Choose a registered user —</option>
                  {allUsers
                    .filter(u => !members.some((m: any) => m.user_id === u.id))
                    .map(u => (
                      <option key={u.id} value={u.email}>
                        {u.name} ({u.email}) — {u.role}
                      </option>
                    ))}
                </select>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text2)' }}>
                ℹ️ Only registered users who are not already members are shown.
              </p>
              {error && <div className="error-msg">⚠️ {error}</div>}
              <button type="submit" className="btn-primary" disabled={!memberEmail}>
                Add Member
              </button>
            </form>
          )}

          <div className="member-list">
            {members.map((m: any) => (
              <div key={m.id} className={`member-card ${m.is_current_user ? 'member-current' : ''}`}>
                <div className="avatar">{m.name[0]?.toUpperCase()}</div>
                <div className="member-info">
                  <p className="member-name">
                    {m.name}
                    {/* ✅ Clearly mark who the current logged in user is */}
                    {m.is_current_user && <span className="you-badge"> (You)</span>}
                  </p>
                  <p className="member-email">{m.email}</p>
                </div>
                <span className={`role-badge role-${m.role}`}>{m.role}</span>
                {user?.role === 'admin' && !m.is_current_user && (
                  <button className="icon-btn danger" onClick={() => removeMember(m.id)}>🗑</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}