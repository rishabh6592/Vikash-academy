// =====================================================================
// CONFIG — Backend local par chal raha hai isliye localhost use ho raha hai
// =====================================================================
// const API_BASE = "http://localhost:5000/api";
const API_BASE = "https://vikash-academy-fullstack.onrender.com/api";

// ---------- State ----------
let selectedSubject = null;
let selectedCount = 5;
let sessionToken = null;
let quizQuestions = [];
let currentIndex = 0;
let selectedOptionIndex = null;
let userAnswers = [];
let authToken = null; // set after successful student login
let currentName = null;
let timerInterval = null;
let timeLeft = 15;
const TIME_PER_QUESTION = 15;

// ---------- Helpers ----------
function show(screenId) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
}

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

// ---------- Screen 1: Load subjects ----------
async function loadSubjects() {
  try {
    const res = await fetch(`${API_BASE}/quiz/subjects`);
    const data = await res.json();
    const grid = document.getElementById("subjectGrid");
    grid.innerHTML = "";
    data.subjects.forEach((subject) => {
      const btn = document.createElement("button");
      btn.className = "subject-card";
      btn.textContent = subject;
      btn.addEventListener("click", () => {
        document.querySelectorAll(".subject-card").forEach((c) => c.classList.remove("selected"));
        btn.classList.add("selected");
        selectedSubject = subject;
        document.getElementById("startBtn").disabled = false;
      });
      grid.appendChild(btn);
    });
  } catch (err) {
    document.getElementById("subjectGrid").innerHTML =
      `<p style="color:#C0392B">Could not reach the quiz server. Check API_BASE in quiz.js.</p>`;
  }
}
loadSubjects();

document.querySelectorAll(".count-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".count-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedCount = parseInt(btn.dataset.count);
  });
});

document.getElementById("startBtn").addEventListener("click", () => {
  if (!selectedSubject) return;
  show("screen-auth");
});

// ---------- Screen 2: Auth choice ----------
document.getElementById("chooseRegistered").addEventListener("click", () => {
  document.getElementById("loginError").textContent = "";
  show("screen-login");
});
document.getElementById("chooseGuest").addEventListener("click", () => show("screen-guest"));
document.getElementById("backToSelect").addEventListener("click", () => show("screen-select"));
document.getElementById("backToAuthFromLogin").addEventListener("click", () => show("screen-auth"));
document.getElementById("backToAuthFromGuest").addEventListener("click", () => show("screen-auth"));

// ---------- Screen 2A: Login ----------
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const rollNo = document.getElementById("rollNoInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();
  const errorEl = document.getElementById("loginError");
  errorEl.textContent = "";

  try {
    const res = await fetch(`${API_BASE}/auth/student/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollNo, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.message || "Login failed";
      return;
    }
    authToken = data.token;
    currentName = data.user.name;
    await beginQuiz();
  } catch (err) {
    errorEl.textContent = "Could not reach the server. Try again.";
  }
});

// ---------- Screen 2B: Guest ----------
document.getElementById("guestForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  authToken = null;
  currentName = document.getElementById("guestNameInput").value.trim();
  await beginQuiz();
});

// ---------- Begin quiz ----------
async function beginQuiz() {
  const res = await fetch(
    `${API_BASE}/quiz/questions?subject=${encodeURIComponent(selectedSubject)}&count=${selectedCount}`
  );
  const data = await res.json();
  sessionToken = data.sessionToken;
  quizQuestions = data.questions;
  currentIndex = 0;
  userAnswers = [];
  show("screen-quiz");
  renderQuestion();
}

// ---------- Render a question ----------
function renderQuestion() {
  selectedOptionIndex = null;
  const q = quizQuestions[currentIndex];
  document.getElementById("progressText").textContent = `Question ${currentIndex + 1}/${quizQuestions.length}`;
  document.getElementById("progressFill").style.width = `${(currentIndex / quizQuestions.length) * 100}%`;
  document.getElementById("questionText").textContent = q.q;

  const optionsList = document.getElementById("optionsList");
  optionsList.innerHTML = "";
  q.options.forEach((optionText, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn no-select";
    btn.textContent = optionText;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".option-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedOptionIndex = idx;
      document.getElementById("nextBtn").disabled = false;
    });
    optionsList.appendChild(btn);
  });

  document.getElementById("nextBtn").disabled = true;
  document.getElementById("nextBtn").textContent =
    currentIndex === quizQuestions.length - 1 ? "Finish" : "Next";

  startTimer();
}

// ---------- Timer per question ----------
function startTimer() {
  clearInterval(timerInterval);
  timeLeft = TIME_PER_QUESTION;
  document.getElementById("timerText").textContent = `${timeLeft}s`;
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById("timerText").textContent = `${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      goNext();
    }
  }, 1000);
}

// ---------- Next / Finish ----------
document.getElementById("nextBtn").addEventListener("click", goNext);

function goNext() {
  clearInterval(timerInterval);
  const q = quizQuestions[currentIndex];
  userAnswers.push({ id: q.id, selectedIndex: selectedOptionIndex });

  if (currentIndex < quizQuestions.length - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    submitQuiz();
  }
}

// ---------- Submit quiz ----------
async function submitQuiz() {
  document.getElementById("progressFill").style.width = "100%";
  const res = await fetch(`${API_BASE}/quiz/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      sessionToken,
      guestName: authToken ? null : currentName,
      answers: userAnswers,
    }),
  });
  const data = await res.json();
  showResult(data);
}

// ---------- Result screen ----------
function showResult(data) {
  const { score, total } = data;
  const pct = Math.round((score / total) * 100);

  document.getElementById("scoreNumber").textContent = `${score}/${total}`;

  const headline = document.getElementById("resultHeadline");
  if (pct >= 80) headline.textContent = "Zabardast! 🎉";
  else if (pct >= 50) headline.textContent = "Achha kiya!";
  else headline.textContent = "Practice karte raho!";

  document.getElementById("resultNote").textContent = authToken
    ? `Saved to your dashboard, ${currentName}.`
    : `Playing as guest — score wasn't saved. Login to track your progress.`;

  const reviewList = document.getElementById("reviewList");
  reviewList.innerHTML = "";
  quizQuestions.forEach((q, i) => {
    const reviewData = data.review.find((r) => r.id === q.id);
    const div = document.createElement("div");
    div.className = `review-item ${reviewData.correct ? "correct" : "wrong"}`;
    div.textContent = `${i + 1}. ${q.q} — ${reviewData.correct ? "Correct ✓" : "Incorrect ✗"}`;
    reviewList.appendChild(div);
  });

  show("screen-result");
}

// ---------- Play again ----------
document.getElementById("playAgainBtn").addEventListener("click", () => {
  document.querySelectorAll(".subject-card").forEach((c) => c.classList.remove("selected"));
  selectedSubject = null;
  document.getElementById("startBtn").disabled = true;
  show("screen-select");
});

// =====================================================================
// ANTI-COPY MEASURES
// =====================================================================
document.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (
    (e.ctrlKey && (key === "c" || key === "x" || key === "u")) ||
    key === "f12" ||
    (e.ctrlKey && e.shiftKey && (key === "i" || key === "j"))
  ) {
    e.preventDefault();
  }
});

document.addEventListener("copy", (e) => e.preventDefault());