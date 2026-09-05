/* ==========================================================
   Vikash Academy — Admin Dashboard Logic (real backend version)
   ========================================================== */

/* ---- Guard: only a session with a valid admin token can view this page ----
   Unlike the old localStorage check, this actually asks the server to
   verify the token. A tampered/fake localStorage entry won't get past it. */
(async function guard() {
  const session = getSession();
  if (!session || session.role !== 'admin') {
    window.location.href = 'login.html?as=admin';
    return;
  }
  try {
    await fetchMe(); // throws + redirects (via apiFetch's 401 handling) if token is bad/expired
  } catch (err) {
    // apiFetch already redirects on 401; this catch just stops further execution on other errors
  }
})();

function logout() {
  clearSession();
  window.location.href = 'index.html';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function showError(msg) {
  showToast(msg);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

/* ---------------- Section navigation ---------------- */
const sectionTitles = {
  overview: 'Overview',
  students: 'Students',
  classes: 'Class Timing',
  holidays: 'Holidays',
  payments: 'Payments'
};

function showSection(name) {
  Object.keys(sectionTitles).forEach(key => {
    document.getElementById('sec-' + key).style.display = key === name ? 'block' : 'none';
  });
  document.querySelectorAll('.side-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.section === name);
  });
  document.getElementById('pageTitle').textContent = sectionTitles[name];
  document.getElementById('sidebar').classList.remove('open');
  renderAll();
}

document.querySelectorAll('.side-links a').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(a.dataset.section);
  });
});

/* ---------------- Helper: sort classes numerically ----------------
   "Class 9" should come before "Class 10" — plain text sort would put
   "Class 10" before "Class 9". This pulls the number out of the name
   and sorts on that instead. Classes with no number keep original order. */
function sortClassesByNumber(classes) {
  return [...classes].sort((a, b) => {
    const numA = parseInt((a.name.match(/\d+/) || [])[0], 10);
    const numB = parseInt((b.name.match(/\d+/) || [])[0], 10);
    if (isNaN(numA) && isNaN(numB)) return 0;
    if (isNaN(numA)) return 1;
    if (isNaN(numB)) return -1;
    return numA - numB;
  });
}

/* ---------------- Notifications (bell icon) ---------------- */
function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  const isOpening = !panel.classList.contains('open');
  panel.classList.toggle('open');
  if (isOpening) loadNotifications();
}

// Close the dropdown when clicking anywhere outside it
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.notif-wrap');
  const panel = document.getElementById('notifPanel');
  if (wrap && panel && !wrap.contains(e.target)) {
    panel.classList.remove('open');
  }
});

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

async function refreshNotifBadge() {
  try {
    const count = await getUnreadNotificationCount();
    const badge = document.getElementById('notifBadge');
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch (err) {
    // Silent — this runs on a background poll, no need to spam toasts.
  }
}

async function loadNotifications() {
  const list = document.getElementById('notifList');
  try {
    const notifications = await getNotifications();
    list.innerHTML = notifications.length
      ? notifications.map(n => `
          <li class="notif-item ${n.read ? '' : 'unread'}" onclick="markOneRead('${n.id}')">
            <div class="notif-msg">${n.message}</div>
            <div class="notif-time">${timeAgo(n.createdAt)}</div>
          </li>
        `).join('')
      : '<li class="empty-state">No notifications yet.</li>';
  } catch (err) {
    list.innerHTML = '<li class="empty-state">Could not load notifications.</li>';
  }
}

async function markOneRead(id) {
  try {
    await markNotificationRead(id);
    loadNotifications();
    refreshNotifBadge();
  } catch (err) {
    // ignore — not critical if a single mark-as-read fails
  }
}

async function markAllRead() {
  try {
    await markAllNotificationsRead();
    loadNotifications();
    refreshNotifBadge();
  } catch (err) {
    showError(err.message);
  }
}

async function clearAllNotifications() {
  if (!confirm('Clear all notifications? This cannot be undone.')) return;
  try {
    await clearAllNotificationsApi();
    document.getElementById('notifPanel').classList.remove('open');
    loadNotifications();
    refreshNotifBadge();
    showToast('Notifications cleared.');
  } catch (err) {
    showError(err.message);
  }
}

/* ---------------- Render: Overview ---------------- */
async function renderOverview() {
  const db = await getDB();
  const totalStudents = db.students.length;
  const totalClasses = db.classes.length;
  const pending = db.payments.filter(p => p.status === 'Unpaid');
  const upcoming = [...db.holidays]
    .filter(h => new Date(h.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  document.getElementById('statGrid').innerHTML = `
    <div class="stat-card"><div class="num">${totalStudents}</div><div class="label">Total Students</div></div>
    <div class="stat-card"><div class="num">${totalClasses}</div><div class="label">Total Classes</div></div>
    <div class="stat-card"><div class="num">${pending.length}</div><div class="label">Pending Payments</div></div>
    <div class="stat-card"><div class="num">${upcoming.length}</div><div class="label">Upcoming Holidays</div></div>
  `;

  const ovHolidays = document.getElementById('ovHolidays');
  ovHolidays.innerHTML = upcoming.length
    ? upcoming.slice(0, 4).map(h => `
        <li class="notice-item">
          <span class="notice-date">${formatDate(h.date)}</span>
          <span>${h.reason}</span>
        </li>`).join('')
    : '<li class="empty-state">No upcoming holidays.</li>';

  const ovPending = document.getElementById('ovPending');
  ovPending.innerHTML = pending.length
    ? pending.slice(0, 6).map(p => {
        const st = db.students.find(s => s.id === p.studentId);
        const cl = db.classes.find(c => c.id === p.classId);
        return `<tr>
          <td>${st ? st.name : '—'}</td>
          <td>${cl ? cl.name : '—'}</td>
          <td>${monthLabel(p.month)}</td>
          <td>₹${p.amount}</td>
          <td><span class="badge badge-unpaid">Unpaid</span></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" class="empty-state">No pending payments.</td></tr>';
}

/* ---------------- Render: Students ---------------- */
async function fillClassFilterOptions(db) {
  const filter = document.getElementById('studentClassFilter');
  const current = filter.value;
  const sortedClasses = sortClassesByNumber(db.classes);
  filter.innerHTML = '<option value="">All Classes</option>' +
    sortedClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  filter.value = current;
}

async function renderStudents() {
  const db = await getDB();
  await fillClassFilterOptions(db);
  const filterVal = document.getElementById('studentClassFilter').value;
  const list = filterVal ? db.students.filter(s => s.classId === filterVal) : db.students;
  const tbody = document.getElementById('studentTable');

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No students added yet.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(s => {
    const cl = db.classes.find(c => c.id === s.classId);
    return `<tr>
      <td>${s.rollNo}</td>
      <td>${s.name}</td>
      <td>${cl ? cl.name : '—'}</td>
      <td>${s.phone}</td>
      <td>${formatDate(s.joinDate)}</td>
      <td class="row-actions">
        ${s.idDocument
          ? `<button class="icon-btn" onclick="viewIdDocument('${s.id}')">View ID</button>`
          : `<span class="badge badge-unpaid">No ID</span>`}
        <button class="icon-btn" onclick="openStudentModal('${s.id}')">Edit</button>
        <button class="icon-btn danger" onclick="deleteStudent('${s.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

// Opens a student's uploaded ID document in a new tab. Fetched with the
// admin's auth token attached (see api.js), then shown via a temporary
// blob URL — this can't be a plain <a href> link because the file route
// is protected and requires the Authorization header.
async function viewIdDocument(studentId) {
  try {
    const blob = await fetchStudentIdDocument(studentId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    showError(err.message);
  }
}

async function openStudentModal(studentId) {
  const db = await getDB();
  const classSel = document.getElementById('sf_classId');
  const sortedClasses = sortClassesByNumber(db.classes);
  classSel.innerHTML = sortedClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  document.getElementById('studentForm').reset();
  if (studentId) {
    const s = db.students.find(st => st.id === studentId);
    document.getElementById('studentModalTitle').textContent = 'Edit Student';
    document.getElementById('sf_id').value = s.id;
    document.getElementById('sf_name').value = s.name;
    document.getElementById('sf_rollNo').value = s.rollNo;
    document.getElementById('sf_classId').value = s.classId;
    document.getElementById('sf_fatherName').value = s.fatherName || '';
    document.getElementById('sf_phone').value = s.phone;
    document.getElementById('sf_password').value = ''; // never re-show a stored password
    document.getElementById('sf_password').placeholder = 'Leave blank to keep current password';
    document.getElementById('sf_password').required = false;
    document.getElementById('sf_address').value = s.address || '';
    document.getElementById('sf_joinDate').value = s.joinDate;
  } else {
    document.getElementById('studentModalTitle').textContent = 'Add Student';
    document.getElementById('sf_id').value = '';
    document.getElementById('sf_password').placeholder = '';
    document.getElementById('sf_password').required = true;
    document.getElementById('sf_joinDate').value = new Date().toISOString().slice(0, 10);
  }
  openModal('studentModal');
}

async function saveStudent(e) {
  e.preventDefault();
  const id = document.getElementById('sf_id').value;
  const data = {
    name: document.getElementById('sf_name').value.trim(),
    rollNo: document.getElementById('sf_rollNo').value.trim(),
    classId: document.getElementById('sf_classId').value,
    fatherName: document.getElementById('sf_fatherName').value.trim(),
    phone: document.getElementById('sf_phone').value.trim(),
    address: document.getElementById('sf_address').value.trim(),
    joinDate: document.getElementById('sf_joinDate').value
  };
  const password = document.getElementById('sf_password').value.trim();
  if (password) data.password = password;

  try {
    if (id) {
      await updateStudent(id, data);
      showToast('Student details updated.');
    } else {
      if (!password) { showError('Password is required for a new student.'); return; }
      await addStudent(data);
      showToast('New student added.');
    }
    closeModal('studentModal');
    renderAll();
  } catch (err) {
    showError(err.message);
  }
}

async function deleteStudent(id) {
  if (!confirm('Are you sure you want to delete this student? Their payment records will also be removed.')) return;
  try {
    await deleteStudentApi(id);
    showToast('Student deleted.');
    renderAll();
  } catch (err) {
    showError(err.message);
  }
}

/* ---------------- Render: Classes / Timing ---------------- */
async function renderClassesTable() {
  const db = await getDB();
  const tbody = document.getElementById('classTable');
  if (db.classes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No classes added yet.</td></tr>';
    return;
  }
  const sortedClasses = sortClassesByNumber(db.classes);
  tbody.innerHTML = sortedClasses.map(c => `
    <tr>
      <td><b>${c.name}</b></td>
      <td><input type="text" value="${c.timing}" onchange="updateClassField('${c.id}','timing',this.value)"></td>
      <td><input type="text" value="${c.days}" onchange="updateClassField('${c.id}','days',this.value)"></td>
      <td><input type="number" value="${c.fee}" onchange="updateClassField('${c.id}','fee',this.value)"></td>
      <td class="row-actions">
        <button class="icon-btn" onclick="openClassModal('${c.id}')">Edit</button>
        <button class="icon-btn danger" onclick="deleteClass('${c.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function updateClassField(classId, field, value) {
  try {
    const payload = { [field]: field === 'fee' ? (parseInt(value, 10) || 0) : value };
    await updateClass(classId, payload);
    showToast('Class updated.');
  } catch (err) {
    showError(err.message);
    renderClassesTable(); // revert the input to the real server value
  }
}

async function openClassModal(classId) {
  document.getElementById('classForm').reset();
  if (classId) {
    const db = await getDB();
    const c = db.classes.find(cl => cl.id === classId);
    document.getElementById('classModalTitle').textContent = 'Edit Class';
    document.getElementById('cf_id').value = c.id;
    document.getElementById('cf_name').value = c.name;
    document.getElementById('cf_timing').value = c.timing;
    document.getElementById('cf_days').value = c.days;
    document.getElementById('cf_fee').value = c.fee;
  } else {
    document.getElementById('classModalTitle').textContent = 'Add Class';
    document.getElementById('cf_id').value = '';
  }
  openModal('classModal');
}

async function saveClass(e) {
  e.preventDefault();
  const id = document.getElementById('cf_id').value;
  const data = {
    name: document.getElementById('cf_name').value.trim(),
    timing: document.getElementById('cf_timing').value.trim(),
    days: document.getElementById('cf_days').value.trim(),
    fee: parseInt(document.getElementById('cf_fee').value, 10) || 0
  };

  try {
    if (id) {
      await updateClass(id, data);
      showToast('Class updated.');
    } else {
      await addClass(data);
      showToast('New class added.');
    }
    closeModal('classModal');
    renderAll();
  } catch (err) {
    showError(err.message);
  }
}

async function deleteClass(id) {
  if (!confirm('Are you sure you want to delete this class?')) return;
  try {
    await deleteClassApi(id);
    showToast('Class deleted.');
    renderAll();
  } catch (err) {
    showError(err.message); // server blocks this if students are still enrolled
  }
}

/* ---------------- Render: Holidays ---------------- */
async function renderHolidaysTable() {
  const db = await getDB();
  const tbody = document.getElementById('holidayTable');
  const sorted = [...db.holidays].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No holidays listed yet.</td></tr>';
    return;
  }
  tbody.innerHTML = sorted.map(h => `
    <tr>
      <td>${formatDate(h.date)}</td>
      <td>${h.reason}</td>
      <td class="row-actions">
        <button class="icon-btn danger" onclick="deleteHoliday('${h.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function openHolidayModal() {
  document.getElementById('holidayForm').reset();
  openModal('holidayModal');
}

async function saveHoliday(e) {
  e.preventDefault();
  try {
    await addHoliday({
      date: document.getElementById('hf_date').value,
      reason: document.getElementById('hf_reason').value.trim()
    });
    closeModal('holidayModal');
    showToast('Holiday added.');
    renderAll();
  } catch (err) {
    showError(err.message);
  }
}

async function deleteHoliday(id) {
  if (!confirm('Are you sure you want to remove this holiday?')) return;
  try {
    await deleteHolidayApi(id);
    showToast('Holiday removed.');
    renderAll();
  } catch (err) {
    showError(err.message);
  }
}

/* ---------------- Render: Payments ---------------- */
async function fillPaymentClassFilter(db) {
  const filter = document.getElementById('paymentClassFilter');
  const current = filter.value;
  const sortedClasses = sortClassesByNumber(db.classes);
  filter.innerHTML = sortedClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  if (current) filter.value = current;
}

async function renderPayments() {
  const db = await getDB();
  await fillPaymentClassFilter(db);
  const classId = document.getElementById('paymentClassFilter').value || (db.classes[0] && db.classes[0].id);
  const classPayments = db.payments.filter(p => p.classId === classId);

  const totalCollected = classPayments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPending = classPayments.filter(p => p.status === 'Unpaid').reduce((sum, p) => sum + Number(p.amount), 0);
  const cls = db.classes.find(c => c.id === classId);

  document.getElementById('paymentStatGrid').innerHTML = `
    <div class="stat-card"><div class="num">${cls ? cls.name : '—'}</div><div class="label">Selected Class</div></div>
    <div class="stat-card"><div class="num">₹${totalCollected}</div><div class="label">Amount Collected</div></div>
    <div class="stat-card"><div class="num">₹${totalPending}</div><div class="label">Amount Pending</div></div>
  `;

  const tbody = document.getElementById('paymentTable');
  if (classPayments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No payment entries for this class.</td></tr>';
    return;
  }
  const sorted = [...classPayments].sort((a, b) => b.month.localeCompare(a.month));
  tbody.innerHTML = sorted.map(p => {
    const st = db.students.find(s => s.id === p.studentId);
    return `<tr>
      <td>${st ? st.name : '—'}</td>
      <td>${monthLabel(p.month)}</td>
      <td>₹${p.amount}</td>
      <td><span class="badge ${p.status === 'Paid' ? 'badge-paid' : 'badge-unpaid'}">${p.status === 'Paid' ? 'Paid' : 'Unpaid'}</span></td>
      <td>${p.paidDate ? formatDate(p.paidDate) : '—'}</td>
      <td class="row-actions">
        <button class="icon-btn" onclick="togglePaymentStatus('${p.id}')">${p.status === 'Paid' ? 'Mark Unpaid' : 'Mark Paid'}</button>
        <button class="icon-btn danger" onclick="deletePayment('${p.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

async function togglePaymentStatus(id) {
  try {
    await togglePaymentApi(id);
    showToast('Payment status updated.');
    renderAll();
  } catch (err) {
    showError(err.message);
  }
}

async function deletePayment(id) {
  if (!confirm('Are you sure you want to delete this payment entry?')) return;
  try {
    await deletePaymentApi(id);
    showToast('Payment entry deleted.');
    renderAll();
  } catch (err) {
    showError(err.message);
  }
}

async function openPaymentModal() {
  const db = await getDB();
  const sel = document.getElementById('pf_studentId');
  sel.innerHTML = db.students.map(s => {
    const cl = db.classes.find(c => c.id === s.classId);
    return `<option value="${s.id}">${s.name} — ${cl ? cl.name : ''}</option>`;
  }).join('');
  document.getElementById('paymentForm').reset();
  document.getElementById('pf_month').value = new Date().toISOString().slice(0, 7);
  openModal('paymentModal');
}

async function savePayment(e) {
  e.preventDefault();
  try {
    await addPayment({
      studentId: document.getElementById('pf_studentId').value,
      month: document.getElementById('pf_month').value,
      amount: parseInt(document.getElementById('pf_amount').value, 10) || 0,
      status: document.getElementById('pf_status').value
    });
    closeModal('paymentModal');
    showToast('Payment entry added.');
    renderAll();
  } catch (err) {
    showError(err.message);
  }
}

/* ---------------- Master render ---------------- */
async function renderAll() {
  await Promise.all([
    renderOverview(),
    renderStudents(),
    renderClassesTable(),
    renderHolidaysTable(),
    renderPayments()
  ]);
}

renderAll();

/* ---------------- Notification polling ----------------
   Checks for new notifications every 20 seconds so the bell badge
   stays current even if the admin doesn't touch anything. */
refreshNotifBadge();
setInterval(refreshNotifBadge, 20000);