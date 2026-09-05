  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  function logout() {
    clearSession();
    window.location.href = 'index.html';
  }

  (async function guard() {
    const session = getSession();
    if (!session || session.role !== 'student') {
      window.location.href = 'login.html';
      return;
    }
    await loadDashboard();
  })();

  /* ---------------- Custom confirm modal ----------------
     Promise-based replacement for window.confirm(), styled to match
     the site's theme. Resolves true (confirmed) or false (cancelled). */
  function showConfirmModal({ title, message } = {}) {
    const overlay = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMsg');
    const okBtn = document.getElementById('confirmModalOk');
    const cancelBtn = document.getElementById('confirmModalCancel');

    if (title) titleEl.textContent = title;
    if (message) msgEl.textContent = message;

    overlay.classList.add('show');

    return new Promise((resolve) => {
      function cleanup(result) {
        overlay.classList.remove('show');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlayClick);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onOverlayClick(e) { if (e.target === overlay) cleanup(false); }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlayClick);
    });
  }

  /* ---------------- Payment reminder ----------------
     Shows a banner when the CURRENT month's fee entry is Unpaid and
     today falls within the last 3 days of that month (inclusive). */
  function daysInMonth(year, month) { // month is 1-12
    return new Date(year, month, 0).getDate();
  }

  function buildReminder(payments) {
    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7); // YYYY-MM
    const entry = payments.find(p => p.month === currentMonthKey && p.status === 'Unpaid');
    if (!entry) return null;

    const [y, m] = currentMonthKey.split('-').map(Number);
    const total = daysInMonth(y, m);
    const daysLeft = total - now.getDate();
    if (daysLeft > 3) return null;

    return { entry, daysLeft };
  }

  function renderReminder(payments) {
    const box = document.getElementById('paymentReminder');
    const reminder = buildReminder(payments);
    if (!reminder) {
      box.style.display = 'none';
      return;
    }
    const { entry, daysLeft } = reminder;
    const daysText = daysLeft <= 0 ? 'today' : `in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`;
    box.style.display = 'flex';
    box.innerHTML = `
      <div><b>Fee reminder:</b> Your ${monthLabel(entry.month)} fee of ₹${entry.amount} is due ${daysText}.</div>
      <button class="btn btn-primary btn-sm" onclick="payNow('${entry.id}')">Pay Now</button>
    `;
  }

  /* ---------------- Pay Now ---------------- */
  async function payNow(id) {
    try {
      await payMyPayment(id);
      showToast('Payment successful — thank you!');
      loadDashboard();
    } catch (err) {
      showToast(err.message);
    }
  }

  /* ---------------- ID document ----------------
     Note: idDocument stores Cloudinary's public_id, not a real URL, and
     the file is private (type: 'authenticated') — so a plain fetch()
     from the browser can never verify it directly (no valid URL, and
     even a correct one would 403 without a signed link). We trust the
     database's record instead of trying to re-verify from the client.
     If a file is ever manually deleted from Cloudinary, that's caught
     server-side when the admin opens "View ID" (that route builds a
     signed URL and returns a clean 404 if it's gone). */

  const MISSING_DOC_MSG = '⚠️ No ID document uploaded yet. Please upload your one government-issued ID. eg: Aadhaar Card, PAN Card, Voter ID, MarkSheet.';

  // Tracks whether a document is currently on file — used to decide
  // whether to warn the student before they overwrite it.
  let hasExistingDocument = false;

  function showUploadedState(me) {
    const box = document.getElementById('idDocStatus');
    box.className = 'id-doc-status uploaded';
    const when = me.idDocumentUploadedAt ? formatDate(me.idDocumentUploadedAt.slice(0, 10)) : '';
    box.innerHTML = `<span>✅ Uploaded: <b>${me.idDocumentOriginalName || 'Document'}</b>${when ? ` on ${when}` : ''}</span>`;
    hasExistingDocument = true;
  }

  function showMissingState(msg) {
    const box = document.getElementById('idDocStatus');
    box.className = 'id-doc-status missing';
    box.innerHTML = `<span>${msg}</span>`;
    hasExistingDocument = false;
  }

  function renderIdDocStatus(me) {
    if (!me.idDocument) {
      showMissingState(MISSING_DOC_MSG);
      return;
    }
    showUploadedState(me);
  }

  async function submitIdDocument(e) {
    e.preventDefault();
    const fileInput = document.getElementById('idDocFile');
    const file = fileInput.files[0];
    if (!file) return;

    // A document already exists — confirm before replacing it.
    if (hasExistingDocument) {
      const ok = await showConfirmModal({
        title: 'Replace Document?',
        message: 'You have already uploaded an ID document. Uploading a new file will replace it. Do you want to continue?'
      });
      if (!ok) {
        fileInput.value = '';
        return;
      }
    }

    const box = document.getElementById('idDocStatus');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const prevBtnText = submitBtn.textContent;
    const prevBoxClass = box.className;
    const prevBoxHtml = box.innerHTML;

    // Uploading state — disable inputs, show a spinner-style message.
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading…';
    fileInput.disabled = true;
    box.className = 'id-doc-status checking';
    box.innerHTML = `<span>⏳ Uploading your document, please wait…</span>`;

    try {
      await uploadMyIdDocument(file);
      showToast('Document uploaded successfully.');
      fileInput.value = '';
      const me = await fetchMe();
      renderIdDocStatus(me);
    } catch (err) {
      showToast(err.message);
      // Restore whatever was shown before the upload attempt.
      box.className = prevBoxClass;
      box.innerHTML = prevBoxHtml;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = prevBtnText;
      fileInput.disabled = false;
    }
  }

  async function loadDashboard() {
    try {
      const me = await fetchMe();
      const classesRaw = await apiFetch('/classes');
      const classes = normalizeList(classesRaw);
      const cls = classes.find(c => c.id === me.classId);

      document.getElementById('profileCard').innerHTML = `
        <div class="avatar-circle">${(me.name || '?').charAt(0).toUpperCase()}</div>
        <div style="flex:1; min-width:220px;">
          <h3 style="margin-bottom:4px;">${me.name}</h3>
          <p style="margin:0;">Roll No: ${me.rollNo}</p>
        </div>
        <div class="detail-grid" style="flex:1 1 100%;">
          <div><div class="d-label">Class</div><div class="d-value">${cls ? cls.name : '—'}</div></div>
          <div><div class="d-label">Timing</div><div class="d-value">${cls ? cls.timing : '—'}</div></div>
          <div><div class="d-label">Mobile</div><div class="d-value">${me.phone || '—'}</div></div>
          <div><div class="d-label">Joined</div><div class="d-value">${formatDate(me.joinDate)}</div></div>
        </div>
      `;

      renderIdDocStatus(me);

      const payments = await getMyPayments();
      renderReminder(payments);

      const tbody = document.getElementById('myPayments');
      const sorted = [...payments].sort((a, b) => b.month.localeCompare(a.month));
      tbody.innerHTML = sorted.length
        ? sorted.map(p => `
            <tr>
              <td>${monthLabel(p.month)}</td>
              <td>₹${p.amount}</td>
              <td><span class="badge ${p.status === 'Paid' ? 'badge-paid' : 'badge-unpaid'}">${p.status}</span></td>
              <td>${p.paidDate ? formatDate(p.paidDate) : '—'}</td>
              <td>${p.status === 'Unpaid' ? `<button class="icon-btn" onclick="payNow('${p.id}')">Pay Now</button>` : ''}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="5" class="empty-state">No payment records yet.</td></tr>';
    } catch (err) {
      showToast(err.message);
    }
  }
