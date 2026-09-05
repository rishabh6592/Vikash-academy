/* ==========================================================
   Vikash Academy — API client
   Replaces the old localStorage-based data.js. Every read/write
   now goes to the real backend, and the server is what actually
   enforces who is allowed to do what (not just the UI).
   ========================================================== */

// Change this to your deployed backend URL when you go live,
// e.g. 'https://vikash-academy-api.onrender.com/api'
const API_BASE_URL = 'https://vikash-academy-fullstack.onrender.com/api';
fetch(`${API_BASE_URL}/health`).catch(() => {});
/* ---------------- Session ----------------
   Uses sessionStorage (not localStorage) so each browser TAB keeps
   its own independent login. Opening Admin in one tab and Student
   in another no longer overwrites each other's session. The trade-off:
   session is lost if the tab is closed (by design — safer default). */
const SESSION_KEY = 'va_session';

function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveSession(token, user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, ...user }));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

/* ---------------- Low-level request helper ---------------- */
async function apiFetch(path, options = {}) {
  const session = getSession();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (session && session.token) headers.Authorization = `Bearer ${session.token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body is fine */ }

  if (!res.ok) {
    if (res.status === 401) {
      // Token missing/expired/invalid — the server is the source of truth here,
      // so we trust its 401 over whatever the browser still has cached.
      clearSession();
      const onAdminPage = document.body.dataset.page === 'admin';
      window.location.href = onAdminPage ? 'login.html?as=admin' : 'login.html';
    }
    throw new Error((data && data.message) || 'Something went wrong. Please try again.');
  }
  return data;
}

/* ---------------- Helpers ---------------- */
function normalize(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, __v, ...rest } = doc;
  return _id ? { id: _id, ...rest } : rest;
}
function normalizeList(list) {
  return Array.isArray(list) ? list.map(normalize) : [];
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function monthLabel(monthStr) {
  if (!monthStr) return '—';
  const [y, m] = monthStr.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (isNaN(d)) return monthStr;
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/* ---------------- Auth ---------------- */
async function adminLogin(username, password) {
  const data = await apiFetch('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  saveSession(data.token, data.user);
  return data.user;
}

async function studentLogin(rollNo, password) {
  const data = await apiFetch('/auth/student/login', {
    method: 'POST',
    body: JSON.stringify({ rollNo, password })
  });
  saveSession(data.token, data.user);
  return data.user;
}

async function fetchMe() {
  return normalize(await apiFetch('/auth/me'));
}

/* ---------------- Combined read — mirrors the old getDB() shape
   so the rest of the dashboard code barely has to change.
   Students/payments only load when an admin session is active. ---------------- */
async function getDB() {
  const session = getSession();
  const isAdmin = session && session.role === 'admin';

  const [classesRaw, holidaysRaw, studentsRaw, paymentsRaw] = await Promise.all([
    apiFetch('/classes'),
    apiFetch('/holidays'),
    isAdmin ? apiFetch('/students') : Promise.resolve([]),
    isAdmin ? apiFetch('/payments') : Promise.resolve([])
  ]);

  return {
    classes: normalizeList(classesRaw),
    students: normalizeList(studentsRaw),
    holidays: normalizeList(holidaysRaw),
    payments: normalizeList(paymentsRaw)
  };
}

/* ---------------- Classes ---------------- */
const addClass = (data) => apiFetch('/classes', { method: 'POST', body: JSON.stringify(data) });
const updateClass = (id, data) => apiFetch(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
const deleteClassApi = (id) => apiFetch(`/classes/${id}`, { method: 'DELETE' });

/* ---------------- Students ---------------- */
const addStudent = (data) => apiFetch('/students', { method: 'POST', body: JSON.stringify(data) });
const updateStudent = (id, data) => apiFetch(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) });
const deleteStudentApi = (id) => apiFetch(`/students/${id}`, { method: 'DELETE' });

/* ---------------- Holidays ---------------- */
const addHoliday = (data) => apiFetch('/holidays', { method: 'POST', body: JSON.stringify(data) });
const deleteHolidayApi = (id) => apiFetch(`/holidays/${id}`, { method: 'DELETE' });

/* ---------------- Payments ---------------- */
const addPayment = (data) => apiFetch('/payments', { method: 'POST', body: JSON.stringify(data) });
const togglePaymentApi = (id) => apiFetch(`/payments/${id}/toggle`, { method: 'PUT' });
const deletePaymentApi = (id) => apiFetch(`/payments/${id}`, { method: 'DELETE' });
const getMyPayments = async () => normalizeList(await apiFetch('/payments/me'));
// Student pays their own pending fee entry (see paymentRoutes.js for what this does server-side)
const payMyPayment = (id) => apiFetch(`/payments/${id}/pay`, { method: 'PUT' });

/* ---------------- Notifications (admin bell icon) ---------------- */
const getNotifications = async () => normalizeList(await apiFetch('/notifications'));
const getUnreadNotificationCount = async () => (await apiFetch('/notifications/unread-count')).count;
const markNotificationRead = (id) => apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
const markAllNotificationsRead = () => apiFetch('/notifications/read-all', { method: 'PUT' });
const clearAllNotificationsApi = () => apiFetch('/notifications/clear-all', { method: 'DELETE' });

/* ---------------- ID document upload/view ----------------
   These two don't go through apiFetch because file upload needs
   multipart/form-data (browser sets its own boundary — we must NOT set
   Content-Type manually), and viewing needs the raw file bytes (a blob),
   not a parsed JSON body. */

// Student — upload/replace their own ID document
async function uploadMyIdDocument(file) {
  const session = getSession();
  const formData = new FormData();
  formData.append('idDocument', file);

  const res = await fetch(`${API_BASE_URL}/students/me/id-document`, {
    method: 'POST',
    headers: session && session.token ? { Authorization: `Bearer ${session.token}` } : {},
    body: formData
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body is fine */ }

  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      window.location.href = 'login.html';
    }
    throw new Error((data && data.message) || 'Could not upload document.');
  }
  return data;
}

// Admin — fetch a student's uploaded ID document as a blob, to open/download it
async function fetchStudentIdDocument(studentId) {
  const session = getSession();
  const res = await fetch(`${API_BASE_URL}/students/${studentId}/id-document`, {
    headers: session && session.token ? { Authorization: `Bearer ${session.token}` } : {}
  });

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body is fine */ }
    if (res.status === 401) {
      clearSession();
      window.location.href = 'login.html?as=admin';
    }
    throw new Error((data && data.message) || 'Could not load document.');
  }
  return res.blob();
}