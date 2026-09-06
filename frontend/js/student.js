// ================================================================
// Vikash Academy — Student Dashboard
// ================================================================

const QUIZ_HISTORY_LIMIT = 50;

/* ================================================================
   TOAST
================================================================ */

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;

  t.textContent = msg;
  t.classList.add("show");

  setTimeout(() => {
    t.classList.remove("show");
  }, 2200);
}

/* ================================================================
   LOGOUT
================================================================ */

function logout() {
  clearSession();
  window.location.href = "index.html";
}

/* ================================================================
   STUDENT GUARD
================================================================ */

(async function guard() {
  try {
    const session = getSession();

    if (!session || session.role !== "student" || !session.token) {
      window.location.href = "login.html";
      return;
    }

    // Verify token with backend
    await fetchMe();

    await loadDashboard();

  } catch (err) {
    console.error("Dashboard guard error:", err);

    // apiFetch handles 401 redirect
    if (err.message) {
      showToast(err.message);
    }
  }
})();

/* ================================================================
   CONFIRM MODAL
================================================================ */

function showConfirmModal({ title, message } = {}) {
  const overlay = document.getElementById("confirmModal");
  const titleEl = document.getElementById("confirmModalTitle");
  const msgEl = document.getElementById("confirmModalMsg");
  const okBtn = document.getElementById("confirmModalOk");
  const cancelBtn = document.getElementById("confirmModalCancel");

  if (!overlay || !okBtn || !cancelBtn) {
    return Promise.resolve(
      window.confirm(message || "Are you sure?")
    );
  }

  if (title) titleEl.textContent = title;
  if (message) msgEl.textContent = message;

  overlay.classList.add("show");

  return new Promise((resolve) => {

    function cleanup(result) {
      overlay.classList.remove("show");

      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);

      resolve(result);
    }

    function onOk() {
      cleanup(true);
    }

    function onCancel() {
      cleanup(false);
    }

    function onOverlayClick(e) {
      if (e.target === overlay) {
        cleanup(false);
      }
    }

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
  });
}

/* ================================================================
   PAYMENT REMINDER
================================================================ */

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function buildReminder(payments) {

  const now = new Date();

  const currentMonthKey =
    now.toISOString().slice(0, 7);

  const entry = payments.find(
    (p) =>
      p.month === currentMonthKey &&
      p.status === "Unpaid"
  );

  if (!entry) return null;

  const [y, m] =
    currentMonthKey.split("-").map(Number);

  const total =
    daysInMonth(y, m);

  const daysLeft =
    total - now.getDate();

  if (daysLeft > 3) return null;

  return {
    entry,
    daysLeft
  };
}

function renderReminder(payments) {

  const box =
    document.getElementById("paymentReminder");

  if (!box) return;

  const reminder =
    buildReminder(payments);

  if (!reminder) {
    box.style.display = "none";
    return;
  }

  const {
    entry,
    daysLeft
  } = reminder;

  const daysText =
    daysLeft <= 0
      ? "today"
      : `in ${daysLeft} day${
          daysLeft > 1 ? "s" : ""
        }`;

  box.style.display = "flex";

  box.innerHTML = `
    <div>
      <b>Fee reminder:</b>
      Your ${monthLabel(entry.month)}
      fee of ₹${entry.amount}
      is due ${daysText}.
    </div>

    <button
      class="btn btn-primary btn-sm"
      onclick="payNow('${entry.id}')"
    >
      Pay Now
    </button>
  `;
}

/* ================================================================
   PAY NOW
================================================================ */

async function payNow(id) {

  try {

    await payMyPayment(id);

    showToast(
      "Payment successful — thank you!"
    );

    await loadDashboard();

  } catch (err) {

    showToast(
      err.message ||
      "Could not process payment."
    );
  }
}

/* ================================================================
   ID DOCUMENT
================================================================ */

const MISSING_DOC_MSG =
  "⚠️ No ID document uploaded yet. Please upload your one government-issued ID. eg: Aadhaar Card, PAN Card, Voter ID, MarkSheet.";

let hasExistingDocument = false;

function showUploadedState(me) {

  const box =
    document.getElementById("idDocStatus");

  if (!box) return;

  box.className =
    "id-doc-status uploaded";

  const when =
    me.idDocumentUploadedAt
      ? formatDate(
          me.idDocumentUploadedAt.slice(0, 10)
        )
      : "";

  box.innerHTML = `
    <span>
      ✅ Uploaded:
      <b>
        ${me.idDocumentOriginalName || "Document"}
      </b>
      ${
        when
          ? ` on ${when}`
          : ""
      }
    </span>
  `;

  hasExistingDocument = true;
}

function showMissingState(msg) {

  const box =
    document.getElementById("idDocStatus");

  if (!box) return;

  box.className =
    "id-doc-status missing";

  box.innerHTML =
    `<span>${msg}</span>`;

  hasExistingDocument = false;
}

function renderIdDocStatus(me) {

  if (!me.idDocument) {
    showMissingState(
      MISSING_DOC_MSG
    );

    return;
  }

  showUploadedState(me);
}

async function submitIdDocument(e) {

  e.preventDefault();

  const fileInput =
    document.getElementById("idDocFile");

  const file =
    fileInput?.files?.[0];

  if (!file) return;

  if (hasExistingDocument) {

    const ok =
      await showConfirmModal({
        title: "Replace Document?",
        message:
          "You have already uploaded an ID document. Uploading a new file will replace it. Do you want to continue?"
      });

    if (!ok) {
      fileInput.value = "";
      return;
    }
  }

  const box =
    document.getElementById("idDocStatus");

  const submitBtn =
    e.target.querySelector(
      'button[type="submit"]'
    );

  const prevBtnText =
    submitBtn.textContent;

  const prevBoxClass =
    box.className;

  const prevBoxHtml =
    box.innerHTML;

  submitBtn.disabled = true;
  submitBtn.textContent =
    "Uploading…";

  fileInput.disabled = true;

  box.className =
    "id-doc-status checking";

  box.innerHTML = `
    <span>
      ⏳ Uploading your document,
      please wait…
    </span>
  `;

  try {

    await uploadMyIdDocument(file);

    showToast(
      "Document uploaded successfully."
    );

    fileInput.value = "";

    const me =
      await fetchMe();

    renderIdDocStatus(me);

  } catch (err) {

    showToast(
      err.message ||
      "Could not upload document."
    );

    box.className =
      prevBoxClass;

    box.innerHTML =
      prevBoxHtml;

  } finally {

    submitBtn.disabled = false;

    submitBtn.textContent =
      prevBtnText;

    fileInput.disabled = false;
  }
}

/* ================================================================
   QUIZ RESULT PANEL
================================================================ */

function createQuizPanel() {

  // Don't create twice
  if (
    document.getElementById(
      "quizResultsPanel"
    )
  ) {
    return;
  }

  const paymentsPanel =
    document
      .getElementById("myPayments")
      ?.closest(".panel");

  if (!paymentsPanel) return;

  const panel =
    document.createElement("div");

  panel.className = "panel";

  panel.id =
    "quizResultsPanel";

  panel.innerHTML = `

    <div class="panel-head"
         style="
           display:flex;
           align-items:center;
           justify-content:space-between;
           gap:12px;
           flex-wrap:wrap;
         ">

      <h3 style="margin:0;">
        🏆 My Quiz Results
      </h3>

      <button
        class="btn btn-outline btn-sm"
        id="refreshQuizResultsBtn"
        type="button"
      >
        Refresh
      </button>

    </div>

    <div
      id="quizSummary"
      style="
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:12px;
        margin-bottom:18px;
      "
    ></div>

    <div class="table-wrap">

      <table>

        <thead>
          <tr>
            <th>Subject</th>
            <th>Score</th>
            <th>Percentage</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody id="myQuizResults">

          <tr>
            <td
              colspan="4"
              class="empty-state"
            >
              Loading…
            </td>
          </tr>

        </tbody>

      </table>

    </div>
  `;

  paymentsPanel.insertAdjacentElement(
    "afterend",
    panel
  );

  document
    .getElementById(
      "refreshQuizResultsBtn"
    )
    .addEventListener(
      "click",
      loadQuizResults
    );

  addQuizStyles();
}

/* ================================================================
   QUIZ STYLES
================================================================ */

function addQuizStyles() {

  if (
    document.getElementById(
      "quizDashboardStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "quizDashboardStyles";

  style.textContent = `

    .quiz-stat {
      padding:14px 16px;
      border:1px solid var(--line);
      border-radius:10px;
      background:var(--bg-alt,#FAF7F0);
    }

    .quiz-stat-label {
      font-size:.75rem;
      color:var(--ink-soft);
      margin-bottom:4px;
    }

    .quiz-stat-value {
      font-size:1.25rem;
      font-weight:700;
      color:var(--green-700,#14532d);
    }

    .quiz-score-good {
      color:#16803c;
      font-weight:700;
    }

    .quiz-score-normal {
      color:#a66a00;
      font-weight:700;
    }

    .quiz-score-low {
      color:#c0392b;
      font-weight:700;
    }

    @media(max-width:640px) {

      #quizSummary {
        grid-template-columns:1fr !important;
      }

      #quizResultsPanel table {
        min-width:520px;
      }
    }
  `;

  document.head.appendChild(style);
}

/* ================================================================
   SAFE HTML
================================================================ */

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ================================================================
   QUIZ DATE
================================================================ */

function formatQuizDate(date) {

  if (!date) return "—";

  const d =
    new Date(date);

  if (isNaN(d.getTime())) {
    return "—";
  }

  return d.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  );
}

/* ================================================================
   QUIZ SCORE CLASS
================================================================ */

function getQuizScoreClass(pct) {

  if (pct >= 80) {
    return "quiz-score-good";
  }

  if (pct >= 50) {
    return "quiz-score-normal";
  }

  return "quiz-score-low";
}

/* ================================================================
   LOAD QUIZ RESULTS
================================================================ */

async function loadQuizResults() {

  createQuizPanel();

  const tbody =
    document.getElementById(
      "myQuizResults"
    );

  const summary =
    document.getElementById(
      "quizSummary"
    );

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td
        colspan="4"
        class="empty-state"
      >
        Loading quiz results…
      </td>
    </tr>
  `;

  try {

    const data =
      await apiFetch(
        "/quiz/history"
      );

    const history =
      Array.isArray(data?.history)
        ? data.history
        : [];

    /* ------------------------------------------------------------
       Summary
    ------------------------------------------------------------ */

    if (summary) {

      if (!history.length) {

        summary.innerHTML = "";

      } else {

        const totalAttempts =
          history.length;

        const totalScore =
          history.reduce(
            (sum, q) =>
              sum +
              Number(q.score || 0),
            0
          );

        const totalQuestions =
          history.reduce(
            (sum, q) =>
              sum +
              Number(q.total || 0),
            0
          );

        const average =
          totalQuestions
            ? Math.round(
                (totalScore /
                  totalQuestions) *
                  100
              )
            : 0;

        const best =
          Math.max(
            ...history.map((q) => {

              const total =
                Number(q.total || 0);

              return total
                ? Math.round(
                    (Number(q.score || 0) /
                      total) *
                      100
                  )
                : 0;
            })
          );

        summary.innerHTML = `

          <div class="quiz-stat">

            <div class="quiz-stat-label">
              Total Attempts
            </div>

            <div class="quiz-stat-value">
              ${totalAttempts}
            </div>

          </div>

          <div class="quiz-stat">

            <div class="quiz-stat-label">
              Average Score
            </div>

            <div class="quiz-stat-value">
              ${average}%
            </div>

          </div>

          <div class="quiz-stat">

            <div class="quiz-stat-label">
              Best Score
            </div>

            <div class="quiz-stat-value">
              ${best}%
            </div>

          </div>
        `;
      }
    }

    /* ------------------------------------------------------------
       Empty
    ------------------------------------------------------------ */

    if (!history.length) {

      tbody.innerHTML = `
        <tr>
          <td
            colspan="4"
            class="empty-state"
          >
            No quiz attempts yet.
            <br>
            <a
              href="quiz.html"
              style="
                color:var(--green-700,#14532d);
                font-weight:600;
              "
            >
              Play your first quiz →
            </a>
          </td>
        </tr>
      `;

      return;
    }

    /* ------------------------------------------------------------
       Results
    ------------------------------------------------------------ */

    tbody.innerHTML =
      history
        .slice(0, QUIZ_HISTORY_LIMIT)
        .map((attempt) => {

          const score =
            Number(attempt.score || 0);

          const total =
            Number(attempt.total || 0);

          const pct =
            total
              ? Math.round(
                  (score / total) * 100
                )
              : 0;

          const scoreClass =
            getQuizScoreClass(pct);

          return `
            <tr>

              <td>
                <b>
                  ${escapeHtml(
                    attempt.subject ||
                    "Quiz"
                  )}
                </b>
              </td>

              <td>
                ${score}/${total}
              </td>

              <td>
                <span
                  class="${scoreClass}"
                >
                  ${pct}%
                </span>
              </td>

              <td>
                ${formatQuizDate(
                  attempt.createdAt
                )}
              </td>

            </tr>
          `;

        })
        .join("");

  } catch (err) {

    console.error(
      "Quiz history error:",
      err
    );

    tbody.innerHTML = `
      <tr>
        <td
          colspan="4"
          class="empty-state"
        >
          Could not load quiz results.
        </td>
      </tr>
    `;
  }
}

/* ================================================================
   LOAD DASHBOARD
================================================================ */

async function loadDashboard() {

  try {

    /* ------------------------------------------------------------
       Student profile
    ------------------------------------------------------------ */

    const me =
      await fetchMe();

    /* ------------------------------------------------------------
       Classes
    ------------------------------------------------------------ */

    const classesRaw =
      await apiFetch("/classes");

    const classes =
      normalizeList(classesRaw);

    const cls =
      classes.find(
        (c) =>
          c.id === me.classId
      );

    const profileCard =
      document.getElementById(
        "profileCard"
      );

    if (profileCard) {

      profileCard.innerHTML = `

        <div class="avatar-circle">
          ${escapeHtml(
            (me.name || "?")
              .charAt(0)
              .toUpperCase()
          )}
        </div>

        <div
          style="
            flex:1;
            min-width:220px;
          "
        >

          <h3
            style="
              margin-bottom:4px;
            "
          >
            ${escapeHtml(
              me.name
            )}
          </h3>

          <p style="margin:0;">
            Roll No:
            ${escapeHtml(
              me.rollNo
            )}
          </p>

        </div>

        <div
          class="detail-grid"
          style="
            flex:1 1 100%;
          "
        >

          <div>
            <div class="d-label">
              Class
            </div>

            <div class="d-value">
              ${
                cls
                  ? escapeHtml(cls.name)
                  : "—"
              }
            </div>
          </div>

          <div>
            <div class="d-label">
              Timing
            </div>

            <div class="d-value">
              ${
                cls
                  ? escapeHtml(cls.timing)
                  : "—"
              }
            </div>
          </div>

          <div>
            <div class="d-label">
              Mobile
            </div>

            <div class="d-value">
              ${escapeHtml(
                me.phone || "—"
              )}
            </div>
          </div>

          <div>
            <div class="d-label">
              Joined
            </div>

            <div class="d-value">
              ${formatDate(
                me.joinDate
              )}
            </div>
          </div>

        </div>
      `;
    }

    /* ------------------------------------------------------------
       ID document
    ------------------------------------------------------------ */

    renderIdDocStatus(me);

    /* ------------------------------------------------------------
       Payments
    ------------------------------------------------------------ */

    const payments =
      await getMyPayments();

    renderReminder(payments);

    const tbody =
      document.getElementById(
        "myPayments"
      );

    if (tbody) {

      const sorted =
        [...payments].sort(
          (a, b) =>
            String(b.month).localeCompare(
              String(a.month)
            )
        );

      tbody.innerHTML =
        sorted.length

          ? sorted
              .map(
                (p) => `

                  <tr>

                    <td>
                      ${monthLabel(
                        p.month
                      )}
                    </td>

                    <td>
                      ₹${escapeHtml(
                        p.amount
                      )}
                    </td>

                    <td>

                      <span
                        class="badge ${
                          p.status === "Paid"
                            ? "badge-paid"
                            : "badge-unpaid"
                        }"
                      >
                        ${escapeHtml(
                          p.status
                        )}
                      </span>

                    </td>

                    <td>
                      ${
                        p.paidDate
                          ? formatDate(
                              p.paidDate
                            )
                          : "—"
                      }
                    </td>

                    <td>
                      ${
                        p.status === "Unpaid"
                          ? `
                            <button
                              class="icon-btn"
                              onclick="payNow('${p.id}')"
                            >
                              Pay Now
                            </button>
                          `
                          : ""
                      }
                    </td>

                  </tr>

                `
              )
              .join("")

          : `
              <tr>
                <td
                  colspan="5"
                  class="empty-state"
                >
                  No payment records yet.
                </td>
              </tr>
            `;
    }

    /* ------------------------------------------------------------
       QUIZ RESULTS
    ------------------------------------------------------------ */

    await loadQuizResults();

  } catch (err) {

    console.error(
      "Dashboard loading error:",
      err
    );

    showToast(
      err.message ||
      "Could not load dashboard."
    );

  }
}