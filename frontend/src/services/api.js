// Automatically use same origin (works for Vercel + local dev)
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';

// Helper: try API, fall back to null (caller handles fallback)
async function apiCall(url, options = {}) {
  try {
    const adminKey = localStorage.getItem('arina_admin_key');
    const res = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(adminKey ? { 'x-admin-key': adminKey } : {}),
        ...options.headers,
      },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

/* ── Auth ── */
export async function apiLogin(username, password) {
  const data = await apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return data;
}

/* ── Beneficiaries ── */
export async function fetchBeneficiaries() {
  return await apiCall('/beneficiaries');
}

export async function createBeneficiary(benef) {
  return await apiCall('/beneficiaries', {
    method: 'POST',
    body: JSON.stringify(benef),
  });
}

export async function updateBeneficiary(id, benef) {
  return await apiCall(`/beneficiaries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(benef),
  });
}

export async function deleteBeneficiary(id) {
  return await apiCall(`/beneficiaries/${id}`, { method: 'DELETE' });
}

export async function updateBeneficiaryPhoto(id, photoData) {
  return await apiCall(`/beneficiaries/${id}/photo`, {
    method: 'PUT',
    body: JSON.stringify({ photo: photoData }),
  });
}

/* ── Finances ── */
export async function fetchFinances() {
  return await apiCall('/finances');
}

export async function createFinance(transaction) {
  return await apiCall('/finances', {
    method: 'POST',
    body: JSON.stringify(transaction),
  });
}

export async function deleteFinance(id) {
  return await apiCall(`/finances/${id}`, { method: 'DELETE' });
}

/* ── News ── */
export async function fetchNews() {
  return await apiCall('/news');
}

export async function createNews(data) {
  return await apiCall('/news', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateNews(id, data) {
  return await apiCall(`/news/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteNews(id) {
  return await apiCall(`/news/${id}`, { method: 'DELETE' });
}

/* ── Contacts (admin) ── */
export async function fetchContacts() {
  return await apiCall('/contacts');
}

export async function deleteContact(id) {
  return await apiCall(`/contacts/${id}`, { method: 'DELETE' });
}

/* ── Volunteers (public submit + admin list) ── */
export async function submitVolunteer(data) {
  return await apiCall('/volunteers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchVolunteers() {
  return await apiCall('/volunteers');
}

export async function deleteVolunteer(id) {
  return await apiCall(`/volunteers/${id}`, { method: 'DELETE' });
}

/* ── Newsletter (admin) ── */
export async function fetchNewsletterSubscribers() {
  return await apiCall('/newsletter/subscribers');
}

export async function deleteNewsletterSubscriber(id) {
  return await apiCall(`/newsletter/${id}`, { method: 'DELETE' });
}

/* ── Activity feed (admin) ── */
export async function fetchActivity() {
  return await apiCall('/activity');
}
