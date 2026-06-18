/* =====================================================
   NURTURE — app logic
   Vanilla JS, no build step. Everything persists via
   localStorage so data never leaves this browser.
   ===================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------
     1. THE 18-QUESTION MASTER DATA SET
     --------------------------------------------------- */
  const QUESTIONS = [
    { id: "q1", topic: "pregnancy", q: "Is my baby okay?",
      sub: ["Normal heartbeats", "fetal movement slowdowns", "dangerous pains", "early maternal guilt"],
      a: "Unfamiliar sensations are mostly normal. Significant changes in fetal movement later on, bleeding, fluid leaks, or sharp pains merit an immediate medical check." },
    { id: "q2", topic: "pregnancy", q: "Is what I'm feeling normal?",
      sub: ["Total exhaustion", "all-day nausea", "heavy emotional sensitivity", "body structural shifts"],
      a: "Fatigue, appetite swings, and sleep disruptions are completely universal. Symptoms vary wildly across mothers." },
    { id: "q3", topic: "pregnancy", q: "Did I hurt my baby before I knew I was pregnant?",
      sub: ["One-off alcohol use", "prescription medications", "accidental food ingestion"],
      a: "Isolated early exposures rarely cause automatic damage. Healthcare teams focus on cumulative timing and dose, not judgment or guilt." },
    { id: "q4", topic: "pregnancy", q: "What can't I eat?",
      sub: ["Daily coffee limits", "raw sushi", "unpasteurized soft cheeses", "specific herbal infusions"],
      a: "Focus centers on food safety and infection safety; lines change by method of prep, not absolute restriction." },
    { id: "q5", topic: "pregnancy", q: "Will I lose the pregnancy?",
      sub: ["Early spotting", "mild cramping", "lack of consistent morning sickness", "prior family losses"],
      a: "Mild symptoms can perfectly exist in healthy gestations. Symptom tracking on internet forums rarely displays the full clinical reality." },
    { id: "q6", topic: "pregnancy", q: "How painful is birth?",
      sub: ["Emotional survival capability", "coping limits", "unexpected operational changes"],
      a: "Birth anxieties are entirely standard. Pre-planning, supportive birth environments, and education drastically temper tension." },
    { id: "q7", topic: "pregnancy", q: "Will I be a good mother?",
      sub: ["Absence of an instant emotional bond", "feeling unready", "outward social pressures"],
      a: "Emotional bonding processes often don't occur instantly during gestation; slow attachment profiles do not predict poor parenting." },
    { id: "q8", topic: "pregnancy", q: "Why don't I feel happy all the time?",
      sub: ["Unprompted mood drops", "heavy stress"],
      a: "Varied or mixed emotions are common. Persistent feelings of hopelessness or panic warrant prompt, caring support." },
    { id: "q9", topic: "pregnancy", q: "Can I still exercise / travel / have sex?",
      sub: [],
      a: "Healthy pregnancies smoothly continue daily routines with minor positional modifications. Personal medical status determines absolute rules." },
    { id: "q10", topic: "pregnancy", q: "When should I call the doctor?",
      sub: ["Bleeding", "minimized baby kicks", "persistent severe headaches", "high fevers", "sudden fluid leaking"],
      a: "Uncertainty itself is a fully valid justification to reach out." },

    { id: "q11", topic: "postpartum", q: "Is my baby eating enough?",
      sub: ["Latching struggles", "volumetric formula counts", "cluster feeding patterns", "slow growth worries"],
      a: "Feeding worry is universal. Long-term weight tracking curves matter far more than single daily feedings." },
    { id: "q12", topic: "postpartum", q: "Why is my baby crying?",
      sub: ["Inherent pain", "pure hunger cues", "hidden sicknesses", "structural errors"],
      a: "Most regular triggers stem from raw hunger, sleep needs, sensory overstimulation, or physical contact needs. Assess persistent crying professionally." },
    { id: "q13", topic: "postpartum", q: "Why am I not myself after birth?",
      sub: ["Spontaneous crying fits", "postpartum rage", "emotional detachment", "deep exhaustion"],
      a: "Acute short-term hormonal/emotional shifts are incredibly normal. Long-term depression or self-harm thoughts require structured professional support." },
    { id: "q14", topic: "postpartum", q: "Why am I so exhausted?",
      sub: [],
      a: "Chronic sleep deprivation fundamentally degrades short-term memory, coping skills, and emotional stability. Utilizing local support systems is vital." },
    { id: "q15", topic: "postpartum", q: "Is this normal after birth?",
      sub: ["Post-birth bleeding cycles", "healing stitches", "breast engorgement"],
      a: "Complete internal physical restoration demands weeks, not days. Spikes in fever or sudden heavy bleeding demand evaluation." },
    { id: "q16", topic: "postpartum", q: "Why don't I feel instantly bonded?",
      sub: [],
      a: "Instant maternal attachment is not a universal rule. Deep bonding naturally cultivates over time through continuous day-to-day care." },
    { id: "q17", topic: "postpartum", q: "Am I ruining my baby?",
      sub: ["Habitual contact naps", "quick responses to crying", "lack of rigid sleep routines"],
      a: "New parents easily misinterpret natural infant dependency as a bad habit. Responsive care does not spoil a newborn." },
    { id: "q18", topic: "postpartum", q: "When does life feel normal again?",
      sub: ["Mourning a past personal identity", "shifting relationship balances", "loss of predictable daily schedules"],
      a: "There is no fixed calendar; personal adaptation curves are highly distinct." }
  ];

  /* ---------------------------------------------------
     2. STORAGE HELPERS (the "true offline" layer)
     --------------------------------------------------- */
  const STORE_KEY = "nurture_state_v1";

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      return defaultState();
    }
  }

  function defaultState() {
    return {
      name: "there",
      checklist: { feed: false, water: false, rest: false },
      today: { dayKey: todayKey(), water: 0, feedings: 0, mood: null, sleep: 0 },
      history: [],
      village: {
        members: [
          { id: "m1", name: "James", role: "Partner" },
          { id: "m2", name: "Mom", role: "Family" }
        ],
        tasks: [
          { id: "t1", label: "Pick up groceries", assignee: "James", done: false },
          { id: "t2", label: "Night feed (12am)", assignee: "James", done: true }
        ]
      },
      care: {
        contacts: [{ id: "c1", name: "Emergency Services", role: "Emergency", phone: "112" }],
        appointments: [],
        diary: []
      }
    };
  }

  function saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function checkForNewDay() {
    const key = todayKey();
    if (state.today.dayKey !== key) {
      state.history.unshift({
        date: state.today.dayKey,
        water: state.today.water,
        feedings: state.today.feedings,
        mood: state.today.mood,
        sleep: state.today.sleep
      });
      state.today = { dayKey: key, water: 0, feedings: 0, mood: null, sleep: 0 };
      state.checklist = { feed: false, water: false, rest: false };
      saveState();
    }
  }

  let state = loadState();
  checkForNewDay();

  /* ---------------------------------------------------
     3. VIEW SWITCHING — marketing <-> app
     --------------------------------------------------- */
  const marketingView = document.getElementById("marketing-view");
  const appView = document.getElementById("app-view");

  function showApp() {
    marketingView.hidden = true;
    appView.hidden = false;
    window.scrollTo(0, 0);
    renderAll();
  }

  function showMarketing() {
    appView.hidden = true;
    marketingView.hidden = false;
    window.scrollTo(0, 0);
  }

  document.getElementById("nav-launch-app").addEventListener("click", (e) => { e.preventDefault(); showApp(); });
  document.getElementById("hero-launch-app").addEventListener("click", (e) => { e.preventDefault(); showApp(); });
  document.getElementById("app-exit").addEventListener("click", (e) => { e.preventDefault(); showMarketing(); });

  /* ---------------------------------------------------
     4. APP TAB NAVIGATION
     --------------------------------------------------- */
  const navItems = document.querySelectorAll(".app-nav__item");
  const panels = document.querySelectorAll(".app-panel");

  function openPanel(name) {
    navItems.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.tab === name));
    panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === name));
    window.scrollTo(0, 0);
  }

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => openPanel(btn.dataset.tab));
  });

  document.querySelectorAll("[data-open-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openPanel(btn.dataset.openPanel);
      const preset = btn.dataset.presetTag;
      if (preset === "mind") filterQuestionsByWord("feeling");
      if (preset === "body") filterQuestionsByWord("exhausted");
    });
  });

  /* ---------------------------------------------------
     5. QUESTION HUB — render, search, accordion
        (shared logic for marketing page + Companion tab)
     --------------------------------------------------- */
  function questionCardHTML(item, headingTag) {
    const subList = item.sub.length
      ? `<ul>${item.sub.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
      : "";
    return `
      <div class="qa-card" data-qid="${item.id}">
        <button class="qa-card__question" aria-expanded="false">
          <${headingTag}>${escapeHtml(item.q)}</${headingTag}>
          <span class="qa-card__chevron" aria-hidden="true">▾</span>
        </button>
        <div class="qa-card__answer">
          ${subList}
          <p>${escapeHtml(item.a)}</p>
        </div>
      </div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderQuestionGroup(containerId, topic, query, headingTag) {
    const container = document.getElementById(containerId);
    if (!container) return 0;
    const matches = QUESTIONS.filter((item) => item.topic === topic && matchesQuery(item, query));
    container.innerHTML = matches.map((item) => questionCardHTML(item, headingTag)).join("");
    return matches.length;
  }

  function matchesQuery(item, query) {
    if (!query) return true;
    const haystack = (item.q + " " + item.sub.join(" ") + " " + item.a).toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function wireAccordion(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".qa-card__question");
      if (!btn) return;
      const card = btn.closest(".qa-card");
      const isOpen = card.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(isOpen));
    });
  }

  function renderHub(searchInputId, listIdPregnancy, listIdPostpartum, countId, emptyId, headingTag) {
    const query = document.getElementById(searchInputId).value.trim();
    const countA = renderQuestionGroup(listIdPregnancy, "pregnancy", query, headingTag);
    const countB = renderQuestionGroup(listIdPostpartum, "postpartum", query, headingTag);
    const total = countA + countB;
    const countEl = document.getElementById(countId);
    const emptyEl = document.getElementById(emptyId);
    if (countEl) countEl.textContent = query ? `${total} question${total === 1 ? "" : "s"} match "${query}"` : "";
    if (emptyEl) emptyEl.hidden = total !== 0;

    // Show the "search trusted sources" fallback only when there's an
    // actual query with zero local matches.
    const trustedId = emptyId === "hub-empty" ? "hub-trusted-search" : "app-trusted-search";
    const trustedPanel = document.getElementById(trustedId);
    if (trustedPanel) {
      const showFallback = !!query && total === 0;
      trustedPanel.hidden = !showFallback;
      if (showFallback) {
        trustedPanel.dataset.pendingQuery = query;
        // Reset any previous results when the search term changes.
        const resultsEl = trustedPanel.querySelector(".trusted-results");
        if (resultsEl) resultsEl.innerHTML = "";
        const btn = trustedPanel.querySelector("button");
        if (btn) btn.textContent = `Search trusted medical sources for "${query}"`;
      }
    }
  }

  /* ---------------------------------------------------
     5b. TRUSTED-SOURCE WEB SEARCH (calls /api/search)
     --------------------------------------------------- */
  async function runTrustedSearch(panelId) {
    const panel = document.getElementById(panelId);
    const resultsEl = panel.querySelector(".trusted-results");
    const query = panel.dataset.pendingQuery || "";
    if (!query) return;

    resultsEl.innerHTML = `<p class="trusted-search__status">Searching trusted sources&hellip;</p>`;

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!response.ok) {
        resultsEl.innerHTML = `<p class="trusted-card__error">${escapeHtml(data.error || "Search failed. Please try again.")}</p>`;
        return;
      }

      if (!data.best && (!data.results || data.results.length === 0)) {
        resultsEl.innerHTML = `<p class="trusted-search__status">No trusted sources matched that search. Try different words, or ask your midwife or doctor directly.</p>`;
        return;
      }

      const tierLabel = (tier) => (tier === "clinical" ? "Medically reviewed" : "Trusted community source");
      const excerptLabel = (source) =>
        source === "article"
          ? "Relevant excerpt pulled directly from the article"
          : "Search summary (full excerpt unavailable for this page)";

      const bestHtml = data.best ? `
        <div class="trusted-card trusted-card--best">
          <span class="trusted-card__best-flag">Best answer</span>
          <span class="trusted-card__source">${escapeHtml(tierLabel(data.best.tier))} · ${escapeHtml(data.best.source)}</span>
          <h4>${escapeHtml(data.best.title)}</h4>
          <p>${escapeHtml(data.best.snippet)}</p>
          <p class="trusted-card__excerpt-label">${escapeHtml(excerptLabel(data.best.excerptSource))}</p>
          <a class="trusted-card__link" href="${escapeHtml(data.best.link)}" target="_blank" rel="noopener noreferrer">Read the full article on ${escapeHtml(data.best.source)} →</a>
        </div>` : "";

      const restHtml = (data.results || []).map((r) => `
        <div class="trusted-card">
          <span class="trusted-card__source">${escapeHtml(tierLabel(r.tier))} · ${escapeHtml(r.source)}</span>
          <h4>${escapeHtml(r.title)}</h4>
          <p>${escapeHtml(r.snippet)}</p>
          <a class="trusted-card__link" href="${escapeHtml(r.link)}" target="_blank" rel="noopener noreferrer">Read the full article on ${escapeHtml(r.source)} →</a>
        </div>`).join("");

      const restLabel = (data.results || []).length
        ? `<p class="trusted-search__more-label">More from trusted sources</p>` : "";

      resultsEl.innerHTML = bestHtml + restLabel + restHtml + `
        <p class="trusted-search__disclosure">Results come from trusted medical and pregnancy organizations. We never store or share what you search.</p>`;
    } catch (err) {
      resultsEl.innerHTML = `<p class="trusted-card__error">Something went wrong reaching the search service. Please try again.</p>`;
    }
  }

  document.getElementById("hub-trusted-search-btn").addEventListener("click", () => runTrustedSearch("hub-trusted-search"));
  document.getElementById("app-trusted-search-btn").addEventListener("click", () => runTrustedSearch("app-trusted-search"));

  // Marketing page hub
  wireAccordion("hub-list-pregnancy");
  wireAccordion("hub-list-postpartum");
  document.getElementById("hub-search-input").addEventListener("input", () => {
    renderHub("hub-search-input", "hub-list-pregnancy", "hub-list-postpartum", "hub-results-count", "hub-empty", "h3");
  });
  renderHub("hub-search-input", "hub-list-pregnancy", "hub-list-postpartum", "hub-results-count", "hub-empty", "h3");

  // App Companion tab hub
  wireAccordion("app-list-pregnancy");
  wireAccordion("app-list-postpartum");
  document.getElementById("app-search-input").addEventListener("input", () => {
    renderHub("app-search-input", "app-list-pregnancy", "app-list-postpartum", "app-results-count", "app-empty", "h2");
  });

  function filterQuestionsByWord(word) {
    const input = document.getElementById("app-search-input");
    input.value = word;
    renderHub("app-search-input", "app-list-pregnancy", "app-list-postpartum", "app-results-count", "app-empty", "h2");
  }

  // Suggested question chips inside Companion tab
  const CHIP_WORDS = ["crying", "exhausted", "bonding", "feeding", "birth fear", "mood"];
  const chipRow = document.getElementById("app-question-chips");
  chipRow.innerHTML = CHIP_WORDS.map((w) => `<button class="chip" type="button">${escapeHtml(w)}</button>`).join("");
  chipRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    filterQuestionsByWord(btn.textContent);
  });

  /* ---------------------------------------------------
     6. ASK WIDGETS (hero + home) -> jump to Companion hub
     --------------------------------------------------- */
  function wireAskForm(formId, inputId, toApp) {
    const form = document.getElementById(formId);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = document.getElementById(inputId).value.trim();
      if (toApp) {
        showApp();
      }
      openPanel("companion");
      filterQuestionsByWord(value);
    });
  }
  wireAskForm("hero-ask-form", "hero-ask-input", true);
  wireAskForm("home-ask-form", "home-ask-input", false);

  /* ---------------------------------------------------
     7. HOME TAB — greeting + checklist
     --------------------------------------------------- */
  function renderHome() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    document.getElementById("home-greeting").textContent = `${greeting}, ${state.name}`;

    document.querySelectorAll("#home-checklist input[type=checkbox]").forEach((box) => {
      const id = box.dataset.checkId;
      box.checked = !!state.checklist[id];
      box.onchange = () => {
        state.checklist[id] = box.checked;
        saveState();
      };
    });
  }

  /* ---------------------------------------------------
     8. PULSE TAB — stats + 7-day bar chart
     --------------------------------------------------- */
  function renderPulse() {
    checkForNewDay();
    const recent = state.history.slice(0, 6);
    const sleepVals = [state.today.sleep, ...recent.map((d) => d.sleep)];
    const waterVals = [state.today.water, ...recent.map((d) => d.water)];
    const feedTotal = state.today.feedings + recent.reduce((sum, d) => sum + d.feedings, 0);
    const moodVals = [state.today.mood, ...recent.map((d) => d.mood)].filter((m) => m !== null && m !== undefined);

    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    document.getElementById("stat-avg-mood").textContent = moodVals.length ? avg(moodVals).toFixed(1) + " / 5" : "—";
    document.getElementById("stat-avg-sleep").textContent = avg(sleepVals).toFixed(1) + "h";
    document.getElementById("stat-avg-water").textContent = avg(waterVals).toFixed(1) + " cups";
    document.getElementById("stat-feedings").textContent = String(feedTotal);

    const moodHistory = [];
    const recentOldestFirst = recent.slice(0, 6).reverse();
    recentOldestFirst.forEach((d) => moodHistory.push(d.mood ?? 3));
    while (moodHistory.length < 6) moodHistory.unshift(3);
    moodHistory.push(state.today.mood ?? 3);

    const dayLabels = ["6d ago", "5d", "4d", "3d", "2d", "Yest.", "Today"];
    const chart = document.getElementById("mood-bar-chart");
    chart.innerHTML = moodHistory.map((val, i) => {
      const clamped = Math.max(1, Math.min(5, val));
      const pct = (clamped / 5) * 100;
      return `
        <div class="bar-chart__col">
          <div class="bar-chart__bar" style="height:${pct}%"></div>
          <span class="bar-chart__day">${dayLabels[i]}</span>
        </div>`;
    }).join("");
  }

  /* ---------------------------------------------------
     9. VILLAGE TAB
     --------------------------------------------------- */
  function renderVillage() {
    const memberList = document.getElementById("village-members");
    memberList.innerHTML = state.village.members.map((m) => `
      <li data-id="${m.id}">
        <span><span class="item-title">${escapeHtml(m.name)}</span><span class="item-sub"> · ${escapeHtml(m.role)}</span></span>
        <button class="item-remove" data-remove-member="${m.id}" aria-label="Remove ${escapeHtml(m.name)}">✕</button>
      </li>`).join("") || `<li><span class="item-sub">No one added yet.</span></li>`;

    const taskList = document.getElementById("village-tasks");
    taskList.innerHTML = state.village.tasks.map((t) => `
      <li data-id="${t.id}">
        <input type="checkbox" data-toggle-task="${t.id}" ${t.done ? "checked" : ""} />
        <span class="task-text ${t.done ? "is-done" : ""}">
          ${escapeHtml(t.label)}
          <span class="task-assignee">${escapeHtml(t.assignee)}</span>
        </span>
        <button class="item-remove" data-remove-task="${t.id}" aria-label="Remove task">✕</button>
      </li>`).join("") || `<li><span class="item-sub">No shared tasks yet.</span></li>`;

    memberList.querySelectorAll("[data-remove-member]").forEach((btn) => {
      btn.onclick = () => {
        state.village.members = state.village.members.filter((m) => m.id !== btn.dataset.removeMember);
        saveState(); renderVillage();
      };
    });
    taskList.querySelectorAll("[data-toggle-task]").forEach((box) => {
      box.onchange = () => {
        const t = state.village.tasks.find((t) => t.id === box.dataset.toggleTask);
        if (t) { t.done = box.checked; saveState(); renderVillage(); }
      };
    });
    taskList.querySelectorAll("[data-remove-task]").forEach((btn) => {
      btn.onclick = () => {
        state.village.tasks = state.village.tasks.filter((t) => t.id !== btn.dataset.removeTask);
        saveState(); renderVillage();
      };
    });
  }

  /* ---------------------------------------------------
     10. CARE TAB — contacts, appointments, diary
     --------------------------------------------------- */
  function renderCare() {
    const contactList = document.getElementById("care-contacts");
    contactList.innerHTML = state.care.contacts.map((c) => `
      <li data-id="${c.id}">
        <span><span class="item-title">${escapeHtml(c.name)}</span><span class="item-sub"> · ${escapeHtml(c.role)} · ${escapeHtml(c.phone)}</span></span>
        <span>
          <a class="icon-btn" style="text-decoration:none;" href="tel:${escapeHtml(c.phone)}" aria-label="Call ${escapeHtml(c.name)}">📞</a>
          <button class="item-remove" data-remove-contact="${c.id}" aria-label="Remove contact">✕</button>
        </span>
      </li>`).join("") || `<li><span class="item-sub">No contacts yet.</span></li>`;

    const apptList = document.getElementById("care-appointments");
    apptList.innerHTML = state.care.appointments.map((a) => `
      <li data-id="${a.id}">
        <span><span class="item-title">${escapeHtml(a.title)}</span><span class="item-sub"> · ${escapeHtml(a.date)} ${escapeHtml(a.time)}</span></span>
        <button class="item-remove" data-remove-appt="${a.id}" aria-label="Remove appointment">✕</button>
      </li>`).join("") || `<li><span class="item-sub">No appointments yet.</span></li>`;

    const diaryList = document.getElementById("care-diary");
    diaryList.innerHTML = state.care.diary.map((d) => `
      <li data-id="${d.id}">
        <span><span class="item-title">${escapeHtml(d.title)}</span><span class="item-sub"> · ${escapeHtml(d.date)}</span></span>
        <button class="item-remove" data-remove-diary="${d.id}" aria-label="Delete entry">✕</button>
      </li>`).join("") || `<li><span class="item-sub">No entries yet — tap + to write one.</span></li>`;

    contactList.querySelectorAll("[data-remove-contact]").forEach((btn) => {
      btn.onclick = () => {
        state.care.contacts = state.care.contacts.filter((c) => c.id !== btn.dataset.removeContact);
        saveState(); renderCare();
      };
    });
    apptList.querySelectorAll("[data-remove-appt]").forEach((btn) => {
      btn.onclick = () => {
        state.care.appointments = state.care.appointments.filter((a) => a.id !== btn.dataset.removeAppt);
        saveState(); renderCare();
      };
    });
    diaryList.querySelectorAll("[data-remove-diary]").forEach((btn) => {
      btn.onclick = () => {
        state.care.diary = state.care.diary.filter((d) => d.id !== btn.dataset.removeDiary);
        saveState(); renderCare();
      };
    });
  }

  /* ---------------------------------------------------
     11. LOGS TAB — counters + history
     --------------------------------------------------- */
  function renderLogs() {
    checkForNewDay();
    document.getElementById("water-count").textContent = String(state.today.water);
    document.getElementById("feeding-count").textContent = String(state.today.feedings);

    const history = document.getElementById("logs-history");
    history.innerHTML = state.history.map((d) => `
      <div class="history-card">
        <span class="history-card__date">${escapeHtml(d.date)}</span>
        <span class="history-card__stats">💧 ${d.water} · 🍼 ${d.feedings} · 😴 ${d.sleep}h</span>
      </div>`).join("") || `<p class="muted-text">No history yet — it builds up automatically each day.</p>`;
  }

  document.getElementById("water-increment").addEventListener("click", () => {
    checkForNewDay();
    state.today.water += 1;
    saveState();
    renderLogs();
    renderPulse();
  });
  document.getElementById("feeding-increment").addEventListener("click", () => {
    checkForNewDay();
    state.today.feedings += 1;
    saveState();
    renderLogs();
    renderPulse();
  });

  /* ---------------------------------------------------
     12. SHARED MODAL — used for all "+" add actions
     --------------------------------------------------- */
  const overlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const modalForm = document.getElementById("modal-form");

  function openModal(title, fieldsHtml, onSubmit) {
    modalTitle.textContent = title;
    modalForm.innerHTML = fieldsHtml + `
      <div class="modal__actions">
        <button type="button" class="modal__cancel" id="modal-cancel-btn">Cancel</button>
        <button type="submit" class="modal__submit">Add</button>
      </div>`;
    overlay.hidden = false;
    document.getElementById("modal-cancel-btn").onclick = closeModal;
    modalForm.onsubmit = (e) => {
      e.preventDefault();
      onSubmit(new FormData(modalForm));
      closeModal();
    };
    const firstInput = modalForm.querySelector("input, textarea");
    if (firstInput) firstInput.focus();
  }

  function closeModal() {
    overlay.hidden = true;
    modalForm.innerHTML = "";
  }

  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

  document.getElementById("add-member-btn").addEventListener("click", () => {
    openModal("Add to your village", `
      <label for="f-name">Name</label>
      <input type="text" id="f-name" name="name" required />
      <label for="f-role">Role</label>
      <select id="f-role" name="role">
        <option>Partner</option><option>Family</option><option>Friend</option>
      </select>`, (data) => {
      state.village.members.push({ id: "m" + Date.now(), name: data.get("name"), role: data.get("role") });
      saveState(); renderVillage();
    });
  });

  document.getElementById("add-task-btn").addEventListener("click", () => {
    const options = state.village.members.map((m) => `<option>${escapeHtml(m.name)}</option>`).join("");
    openModal("New shared task", `
      <label for="f-label">Task</label>
      <input type="text" id="f-label" name="label" required placeholder="e.g. Pick up prescription" />
      <label for="f-assignee">Assign to</label>
      <select id="f-assignee" name="assignee">${options}</select>`, (data) => {
      state.village.tasks.push({ id: "t" + Date.now(), label: data.get("label"), assignee: data.get("assignee"), done: false });
      saveState(); renderVillage();
    });
  });

  document.getElementById("add-contact-btn").addEventListener("click", () => {
    openModal("Add speed dial contact", `
      <label for="f-cname">Name</label>
      <input type="text" id="f-cname" name="name" required />
      <label for="f-crole">Role</label>
      <input type="text" id="f-crole" name="role" placeholder="e.g. Midwife, GP" />
      <label for="f-cphone">Phone number</label>
      <input type="tel" id="f-cphone" name="phone" required />`, (data) => {
      state.care.contacts.push({ id: "c" + Date.now(), name: data.get("name"), role: data.get("role") || "Contact", phone: data.get("phone") });
      saveState(); renderCare();
    });
  });

  document.getElementById("add-appointment-btn").addEventListener("click", () => {
    openModal("Add appointment", `
      <label for="f-atitle">What's it for?</label>
      <input type="text" id="f-atitle" name="title" required placeholder="e.g. 6-week checkup" />
      <label for="f-adate">Date</label>
      <input type="text" id="f-adate" name="date" placeholder="e.g. Tue, 24 Jun" />
      <label for="f-atime">Time</label>
      <input type="text" id="f-atime" name="time" placeholder="e.g. 10:30 AM" />`, (data) => {
      state.care.appointments.push({ id: "a" + Date.now(), title: data.get("title"), date: data.get("date"), time: data.get("time") });
      saveState(); renderCare();
    });
  });

  document.getElementById("new-diary-btn").addEventListener("click", () => {
    openModal("New diary entry", `
      <label for="f-dcontent">What's on your mind?</label>
      <textarea id="f-dcontent" name="content" required placeholder="Today was..."></textarea>`, (data) => {
      const content = data.get("content").trim();
      if (!content) return;
      const title = content.split(/\s+/).slice(0, 3).join(" ");
      const date = new Date().toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      state.care.diary.unshift({ id: "d" + Date.now(), title, content, date });
      saveState(); renderCare();
    });
  });

  /* ---------------------------------------------------
     13. INITIAL RENDER
     --------------------------------------------------- */
  function renderAll() {
    renderHome();
    renderPulse();
    renderVillage();
    renderCare();
    renderLogs();
  }

  renderAll();
})();
