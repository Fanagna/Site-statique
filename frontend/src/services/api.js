// Automatically use same origin (works for Vercel + local dev)
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';

// Helper: try API, fall back to null (caller handles fallback)
async function apiCall(url, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
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

export async function deleteNews(id) {
  return await apiCall(`/news/${id}`, { method: 'DELETE' });
}
