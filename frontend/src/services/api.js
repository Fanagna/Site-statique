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

/* Variante « détaillée » utilisée par les SAUVEGARDES admin : renvoie
   { ok: true, data } ou { ok: false, error }.
   Permet de distinguer un vrai enregistrement en base d'un échec (réseau,
   serveur, base injoignable) — plus jamais d'enregistrement « fantôme »
   créé en local à l'insu de l'administrateur. */
async function apiCallDetailed(url, options = {}) {
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
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body.error || `Erreur serveur (HTTP ${res.status})` };
    }
    return { ok: true, data: body };
  } catch {
    return { ok: false, error: 'Base de données injoignable — vérifiez la connexion puis réessayez.' };
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

// Récupère l'utilisateur associé à la clé stockée ({ username, role }) ou null.
// Vérifie aussi que la clé est TOUJOURS acceptée par le serveur (session valide).
export async function fetchMe() {
  const adminKey = localStorage.getItem('arina_admin_key');
  if (!adminKey) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { 'x-admin-key': adminKey } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Serveur injoignable : on renvoie la session locale (offline-friendly)
    const stored = localStorage.getItem('arina_admin');
    try { return stored ? JSON.parse(stored) : null; } catch { return null; }
  }
}

/* ── Users / comptes (admin) ── */
export async function fetchUsers() {
  return await apiCall('/users');
}

export async function createUser(data) {
  return await apiCall('/users', { method: 'POST', body: JSON.stringify(data) });
}

export async function resetUserPassword(id, password) {
  return await apiCall(`/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) });
}

export async function deleteUser(id) {
  return await apiCall(`/users/${id}`, { method: 'DELETE' });
}

/* ── Beneficiaries ── */
export async function fetchBeneficiaries() {
  return await apiCall('/beneficiaries');
}

export async function createBeneficiary(benef) {
  return apiCallDetailed('/beneficiaries', {
    method: 'POST',
    body: JSON.stringify(benef),
  });
}

export async function updateBeneficiary(id, benef) {
  return apiCallDetailed(`/beneficiaries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(benef),
  });
}

export async function deleteBeneficiary(id) {
  return apiCallDetailed(`/beneficiaries/${id}`, { method: 'DELETE' });
}

export async function updateBeneficiaryPhoto(id, photoData) {
  return apiCallDetailed(`/beneficiaries/${id}/photo`, {
    method: 'PUT',
    body: JSON.stringify({ photo: photoData }),
  });
}

/* ── Finances ── */
export async function fetchFinances() {
  return await apiCall('/finances');
}

export async function createFinance(transaction) {
  return apiCallDetailed('/finances', {
    method: 'POST',
    body: JSON.stringify(transaction),
  });
}

export async function updateFinance(id, transaction) {
  return apiCallDetailed(`/finances/${id}`, {
    method: 'PUT',
    body: JSON.stringify(transaction),
  });
}

export async function deleteFinance(id) {
  return apiCallDetailed(`/finances/${id}`, { method: 'DELETE' });
}

/* Import Excel en masse — { rows, autoCreateDonors } → { ok, data:{ created, errors, createdDonors } } */
export async function importFinances(rows, autoCreateDonors = true) {
  return apiCallDetailed('/finances/import', {
    method: 'POST',
    body: JSON.stringify({ rows, autoCreateDonors }),
  });
}

/* ── Donateurs (partenaires financiers) ── */
export async function fetchDonors() {
  return await apiCall('/donors');
}

export async function createDonor(data) {
  return apiCallDetailed('/donors', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDonor(id, data) {
  return apiCallDetailed(`/donors/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteDonor(id) {
  return apiCallDetailed(`/donors/${id}`, { method: 'DELETE' });
}

/* ── News ── */
export async function fetchNews() {
  // cache-buster : force le rechargement des dernières actualités modifiées par l'admin
  return await apiCall(`/news?_t=${Date.now()}`);
}

export async function createNews(data) {
  return apiCallDetailed('/news', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateNews(id, data) {
  return apiCallDetailed(`/news/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteNews(id) {
  return apiCallDetailed(`/news/${id}`, { method: 'DELETE' });
}

export async function incrementNewsViews(id) {
  return await apiCall(`/news/${id}/view`, { method: 'POST' });
}

/* ── Dons (promesses de don — page Soutenir + admin) ── */

// Soumet une promesse de don. Renvoie { ok: true, data } ou { ok: false, error } :
// le succès ne s'affiche QUE si la promesse a réellement été enregistrée en base.
export async function submitDonation(data) {
  try {
    const res = await fetch(`${API_BASE}/donations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || 'Une erreur est survenue, veuillez réessayer.' };
    return { ok: true, data: body };
  } catch {
    return { ok: false, error: 'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.' };
  }
}

// Toutes les promesses de don (admin — président / comptable)
export async function fetchDonations() {
  return await apiCall('/donations');
}

export async function updateDonation(id, data) {
  return apiCallDetailed(`/donations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteDonation(id) {
  return apiCallDetailed(`/donations/${id}`, { method: 'DELETE' });
}

/* ── Transparence (page publique) ── */
export async function fetchTransparency(year) {
  return await apiCall(`/transparency${year ? `?year=${year}` : ''}`);
}

/* ── Stats réelles (page d'accueil) ── */
export async function fetchStats() {
  return await apiCall('/stats');
}

/* ── Contacts (admin) ── */
export async function fetchContacts() {
  return await apiCall('/contacts');
}

export async function deleteContact(id) {
  return apiCallDetailed(`/contacts/${id}`, { method: 'DELETE' });
}

/* Soumission du formulaire de contact — succès uniquement si réellement enregistré */
export async function submitContact(data) {
  try {
    const res = await fetch(`${API_BASE}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || 'Une erreur est survenue, veuillez réessayer.' };
    return { ok: true, data: body };
  } catch {
    return { ok: false, error: 'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.' };
  }
}

/* ── Volunteers (public submit + admin list) ── */

// Demande une URL d'upload signée (Vercel Blob) pour envoyer le fichier directement,
// sans passer par la limite de 4,5 Mo des fonctions serverless.
export async function getVolunteerUploadUrl(filename, type, size) {
  try {
    const params = new URLSearchParams({ filename, type, size: String(size) });
    const res = await fetch(`${API_BASE}/volunteers/upload-url?${params}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Soumet la candidature. Renvoie { ok: true, data } ou { ok: false, error } pour que
// le formulaire n'affiche le succès QUE si l'envoi a réellement abouti.
export async function submitVolunteer(data) {
  try {
    const res = await fetch(`${API_BASE}/volunteers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || 'Une erreur est survenue, veuillez réessayer.' };
    return { ok: true, data: body };
  } catch {
    return { ok: false, error: 'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.' };
  }
}

export async function fetchVolunteers() {
  return await apiCall('/volunteers');
}

export async function deleteVolunteer(id) {
  return apiCallDetailed(`/volunteers/${id}`, { method: 'DELETE' });
}

// Récupère une pièce jointe stockée en base64 (candidatures antérieures à Blob)
export async function getVolunteerAttachment(id, kind = 'file') {
  return await apiCall(`/volunteers/${id}/attachment?kind=${kind}`);
}

/* ── Testimonials (soumission publique + modération admin) ── */

// Soumet un témoignage depuis la page publique. Renvoie { ok: true, data } ou
// { ok: false, error } pour que le formulaire n'affiche le succès QUE si l'envoi
// a réellement abouti (même règle que les candidatures bénévoles).
export async function submitTestimonial(data) {
  try {
    const res = await fetch(`${API_BASE}/testimonials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || 'Une erreur est survenue, veuillez réessayer.' };
    return { ok: true, data: body };
  } catch {
    return { ok: false, error: 'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.' };
  }
}

// Témoignages PUBLIÉS (page publique) — lecture seule, sans clé admin.
// Cache-buster : les témoignages fraîchement publiés par l'admin apparaissent au refresh.
export async function fetchPublishedTestimonials() {
  return await apiCall(`/testimonials/published?_t=${Date.now()}`);
}

// Tous les témoignages (admin — en attente + publiés)
export async function fetchTestimonials() {
  return await apiCall('/testimonials');
}

export async function updateTestimonial(id, data) {
  return apiCallDetailed(`/testimonials/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTestimonial(id) {
  return apiCallDetailed(`/testimonials/${id}`, { method: 'DELETE' });
}

/* ── Activity feed (admin) ── */
export async function fetchActivity() {
  return await apiCall('/activity');
}
