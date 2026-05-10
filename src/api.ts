const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('token');
}

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

async function request(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export const api = {
  // Auth
  verifyAdmin: (admin_id: string, admin_password: string) =>
    request('POST', '/auth/verify-admin', { admin_id, admin_password }),
  register: (body: any) => request('POST', '/auth/register', body),
  login: (body: any) => request('POST', '/auth/login', body),
  me: () => request('GET', '/auth/me'),

  // Dashboard
  dashboard: () => request('GET', '/dashboard'),

  // Projects
  getProjects: () => request('GET', '/projects'),
  createProject: (body: any) => request('POST', '/projects', body),
  deleteProject: (id: string) => request('DELETE', `/projects/${id}`),

  // Members
  getMembers: (projectId: string) => request('GET', `/projects/${projectId}/members`),
  addMember: (projectId: string, email: string) =>
    request('POST', `/projects/${projectId}/members`, { email }),
  removeMember: (projectId: string, memberId: string) =>
    request('DELETE', `/projects/${projectId}/members/${memberId}`),

  // Tasks
  getTasks: (projectId: string) => request('GET', `/projects/${projectId}/tasks`),
  createTask: (projectId: string, body: any) =>
    request('POST', `/projects/${projectId}/tasks`, body),
  updateTask: (projectId: string, taskId: string, body: any) =>
    request('PATCH', `/projects/${projectId}/tasks/${taskId}`, body),
  deleteTask: (projectId: string, taskId: string) =>
    request('DELETE', `/projects/${projectId}/tasks/${taskId}`),

  // Users
  getUsers: () => request('GET', '/users'),

  // Timer (server-persisted)
  getTimer: (taskId: string) => request('GET', `/tasks/${taskId}/timer`),
  saveTimer: (taskId: string, body: { elapsed: number; running: boolean; startedAt: number | null }) =>
    request('POST', `/tasks/${taskId}/timer`, body),
  resetTimer: (taskId: string) => request('POST', `/tasks/${taskId}/timer/reset`),

  // Screenshots
  saveScreenshot: (taskId: string, image: string) =>
    request('POST', `/tasks/${taskId}/screenshots`, { image }),
  listScreenshots: (taskId: string) => request('GET', `/tasks/${taskId}/screenshots`),
};