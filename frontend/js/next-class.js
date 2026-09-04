async function nextClass() {
  const card = document.getElementById("nextClassCard");

  try {
    const data = normalizeList(await apiFetch("/classes"));

    data.sort(
      (a, b) =>
        (parseInt((a.name || "").match(/\d+/)) || 0) -
        (parseInt((b.name || "").match(/\d+/)) || 0)
    );

    if (!data.length) return;

    let i = 0;

    const show = () => {
      const c = data[i];

      card.classList.remove("slide-in");
      void card.offsetWidth;
      card.classList.add("slide-in");

      card.innerHTML = `
        <div class="next-class-top">
          <span class="next-class-badge">UP NEXT</span>
          <span class="next-class-dot"></span>
        </div>

        <div class="next-class-title">
          <h4>${c.name}</h4>
          <span>📚</span>
        </div>

        <div class="next-class-time">
          <span>🕐</span>
          <div>
            <small>Class Timing</small>
            <strong>${c.timing}</strong>
          </div>
        </div>

        <div class="next-class-bottom">
          <span>📅 Everyday </span>
          <span class="next-class-arrow">→</span>
        </div>
      `;
    };

    show();

    setInterval(() => {
      i = (i + 1) % data.length;
      show();
    }, 5000);

  } catch (e) {
    card.innerHTML = `
      <h4>Next Class</h4>
      <p>Class details unavailable</p>
    `;
  }
}

nextClass();