import { API_URL } from './config.js';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${API_URL}${path}`, { headers, ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

export const api = {
  signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  postItem: (body) => request('/items', { method: 'POST', body: JSON.stringify(body) }),
  myItems: () => request('/items/mine'),
  jobsInArea: (area) => request(`/jobs?area=${encodeURIComponent(area)}`),
  acceptJob: (itemId, body) => request(`/jobs/${itemId}/accept`, { method: 'POST', body: JSON.stringify(body) }),
  markPickedUp: (jobId) => request(`/jobs/${jobId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'picked_up' }) }),
  myJobs: () => request('/jobs/mine'),
  centers: () => request('/centers'),
  pendingDropoffs: (centerId) => request(`/centers/${centerId}/pending`),
  confirmDelivery: (centerId, jobId) => request(`/centers/${centerId}/confirm`, { method: 'POST', body: JSON.stringify({ jobId }) }),
  rewards: (userId) => request(`/rewards/${userId}`),
  dashboard: (userId) => request(`/dashboard/${userId}`),
};
