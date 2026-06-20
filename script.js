/* =====================================================
   NURTURE — app logic v2
   Stage-aware: everything adapts to pregnant vs postpartum.
   All data persists via localStorage — stays on device.
   ===================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------
     1. STAGE-AWARE CONTENT DEFINITIONS
     --------------------------------------------------- */

  // Checklist suggestions shown by stage — user picks which to add.
  const CHECKLIST_SUGGESTIONS = {
    pregnant: [
      "Take prenatal vitamin",
      "Drink 8 glasses of water",
      "Do 10 minutes of gentle walking",
      "Eat a nutritious meal",
      "Rest for 20 minutes",
      "Do pelvic floor exercises",
      "Call or text someone you love",
      "Track baby movements",
      "Take bump photo",
      "Pack hospital bag item"
    ],
    postpartum: [
      "Feed baby",
      "Take pain medication if needed",
      "Rest while baby sleeps",
      "Drink a full glass of water",
      "Eat something nourishing",
      "Take a shower",
      "Get outside for 5 minutes",
      "Ask for help with one task",
      "Check your wound/stitches",
      "Take postnatal vitamin"
    ]
  };

  // Mood options — same for both stages
  // Matches the Android app's mood system exactly — 6 named emotions
  // rather than a generic 1-5 scale, so mood check-ins feel identical
  // on phone and web. "score" mirrors MoodType.score in Models.kt,
  // used for Pulse trend averages.
  const MOODS = [
    { value: "HAPPY", emoji: "😊", label: "Happy", score: 5 },
    { value: "CALM", emoji: "😌", label: "Calm", score: 4 },
    { value: "TIRED", emoji: "😔", label: "Tired", score: 3 },
    { value: "ANXIOUS", emoji: "😰", label: "Anxious", score: 2 },
    { value: "SAD", emoji: "😢", label: "Sad", score: 2 },
    { value: "OVERWHELMED", emoji: "😵", label: "Overwhelmed", score: 1 }
  ];

  // Search context appended per stage so results are relevant
  const SEARCH_CONTEXT = {
    pregnant: "pregnancy pregnant",
    postpartum: "postpartum newborn baby after birth"
  };

  // 18 questions tagged by stage
  const QUESTIONS = [
    { id: "q1", stage: "pregnant", q: "Is my baby okay?",
      sub: ["Normal heartbeats", "fetal movement slowdowns", "dangerous pains", "early maternal guilt"],
      a: "Unfamiliar sensations are mostly normal. Significant changes in fetal movement, bleeding, fluid leaks, or sharp pains merit an immediate medical check." },
    { id: "q2", stage: "pregnant", q: "Is what I'm feeling normal?",
      sub: ["Total exhaustion", "all-day nausea", "heavy emotional sensitivity", "body structural shifts"],
      a: "Fatigue, appetite swings, and sleep disruptions are completely universal. Symptoms vary wildly across mothers." },
    { id: "q3", stage: "pregnant", q: "Did I hurt my baby before I knew I was pregnant?",
      sub: ["One-off alcohol use", "prescription medications", "accidental food ingestion"],
      a: "Isolated early exposures rarely cause automatic damage. Healthcare teams focus on cumulative timing and dose, not judgment or guilt." },
    { id: "q4", stage: "pregnant", q: "What can't I eat during pregnancy?",
      sub: ["Daily coffee limits", "raw sushi", "unpasteurized soft cheeses", "herbal teas"],
      a: "Focus centers on food safety and infection risk. Lines change by method of preparation, not absolute restriction." },
    { id: "q5", stage: "pregnant", q: "Will I lose the pregnancy?",
      sub: ["Early spotting", "mild cramping", "lack of morning sickness", "prior losses"],
      a: "Mild symptoms can exist in healthy gestations. Symptom tracking on internet forums rarely displays the full clinical reality." },
    { id: "q6", stage: "pregnant", q: "How painful is birth?",
      sub: ["Emotional survival capability", "coping limits", "unexpected changes during labour"],
      a: "Birth anxieties are entirely standard. Pre-planning, supportive environments, and education drastically temper tension." },
    { id: "q7", stage: "pregnant", q: "Will I be a good mother?",
      sub: ["No instant emotional bond yet", "feeling unready", "social pressures"],
      a: "Emotional bonding often doesn't occur instantly during pregnancy. Slow attachment does not predict poor parenting." },
    { id: "q8", stage: "pregnant", q: "Why don't I feel happy all the time?",
      sub: ["Unprompted mood drops", "heavy stress", "mixed feelings about the pregnancy"],
      a: "Varied or mixed emotions are common. Persistent feelings of hopelessness or panic warrant prompt, caring support." },
    { id: "q9", stage: "pregnant", q: "Can I still exercise, travel and have sex?",
      sub: ["Safe exercise types", "flying while pregnant", "intimacy during pregnancy"],
      a: "Healthy pregnancies can continue daily routines with minor modifications. Personal medical status determines specific rules." },
    { id: "q10", stage: "pregnant", q: "When should I call the doctor during pregnancy?",
      sub: ["Bleeding", "reduced baby kicks", "severe headaches", "high fever", "sudden fluid leaking"],
      a: "Uncertainty itself is a fully valid reason to reach out. Always call if something feels wrong." },
    { id: "q11", stage: "postpartum", q: "Is my baby eating enough?",
      sub: ["Latching struggles", "formula amounts", "cluster feeding", "slow weight gain"],
      a: "Feeding worry is universal. Long-term weight tracking curves matter far more than single daily feeding counts." },
    { id: "q12", stage: "postpartum", q: "Why is my baby crying so much?",
      sub: ["Pain vs hunger cues", "colic", "overstimulation", "overtiredness"],
      a: "Most crying stems from hunger, sleep needs, sensory overstimulation, or need for contact. Assess persistent or unusual crying with a professional." },
    { id: "q13", stage: "postpartum", q: "Why am I not myself after birth?",
      sub: ["Spontaneous crying", "postpartum rage", "emotional detachment", "deep exhaustion"],
      a: "Short-term hormonal and emotional shifts after birth are normal. Long-term depression or self-harm thoughts require structured professional support." },
    { id: "q14", stage: "postpartum", q: "Why am I so exhausted after having my baby?",
      sub: ["Sleep deprivation effects", "physical recovery", "emotional load"],
      a: "Chronic sleep deprivation degrades memory, coping, and emotional stability. Accepting and asking for help is essential, not optional." },
    { id: "q15", stage: "postpartum", q: "Is this normal after birth?",
      sub: ["Postpartum bleeding", "healing stitches", "breast engorgement", "night sweats"],
      a: "Complete physical restoration takes weeks, not days. Spikes in fever or sudden heavy bleeding demand immediate evaluation." },
    { id: "q16", stage: "postpartum", q: "Why don't I feel instantly bonded with my baby?",
      sub: ["No immediate rush of love", "feeling detached", "guilt about not bonding"],
      a: "Instant attachment is not universal. Deep bonding naturally builds over time through daily care — it does not mean anything is wrong." },
    { id: "q17", stage: "postpartum", q: "Am I spoiling my baby?",
      sub: ["Contact naps", "responding quickly to crying", "no strict sleep schedule yet"],
      a: "Responsive care does not spoil a newborn. Natural infant dependency in the early weeks is exactly what healthy development looks like." },
    { id: "q18", stage: "postpartum", q: "When does life feel normal again after birth?",
      sub: ["Identity shift", "relationship changes", "loss of routine and independence"],
      a: "There is no fixed timeline — every mother's adjustment curve is different. Be gentle with yourself in the comparison." }
  ];

  /* ---------------------------------------------------
     2. STORAGE HELPERS
     --------------------------------------------------- */
  const STORE_KEY = "nurture_state_v2";

  // Separate, lightweight key — remembers which access code this
  // browser last used, purely as a typing convenience for the login
  // form. This is NOT a credential and NEVER grants access on its
  // own; the password still has to be entered and verified server-side
  // every time the app is unlocked in a fresh page load.
  const REMEMBERED_CODE_KEY = "nurture_remembered_code";

  function getRememberedCode() {
    try { return localStorage.getItem(REMEMBERED_CODE_KEY) || ""; }
    catch (e) { return ""; }
  }

  function setRememberedCode(code) {
    try { localStorage.setItem(REMEMBERED_CODE_KEY, code); }
    catch (e) { /* ignore */ }
  }

  // Per-tab-session only — true once the password has been verified
  // THIS load of the page. Deliberately not persisted to localStorage,
  // so every fresh visit/reload requires password verification again,
  // even though the code itself may be remembered for convenience.
  let isUnlocked = false;

  function defaultState() {
    return {
      stage: null,
      name: "",
      onboarded: false,
      accessCode: null,        // set only after successful password verification
      checklist: [],
      today: {
        dayKey: todayKey(),
        sleep: 0,
        energy: null,
        mood: null,
        // Pregnant
        kicks: 0,
        symptoms: [],
        // Postpartum
        feedingStatus: null,
        nappyWet: 0,
        nappyDirty: 0,
        pain: null
      },
      history: [],
      village: { members: [], tasks: [] },
      care: {
        contacts: [{ id: "c1", name: "Emergency Services", role: "Emergency", phone: "112" }],
        appointments: [],
        diary: []
      }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      const saved   = JSON.parse(raw);
      const fresh   = defaultState();
      // Deep merge: top-level keys from saved override defaults,
      // but nested objects (today, village, care) are merged field
      // by field so any NEW fields added in code updates get their
      // default values rather than coming through as undefined.
      return {
        ...fresh,
        ...saved,
        today:   { ...fresh.today,   ...(saved.today   || {}) },
        village: {
          members: saved.village?.members || fresh.village.members,
          tasks:   saved.village?.tasks   || fresh.village.tasks
        },
        care: {
          contacts:     saved.care?.contacts     || fresh.care.contacts,
          appointments: saved.care?.appointments || fresh.care.appointments,
          diary:        saved.care?.diary        || fresh.care.diary
        }
      };
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    // Also sync to Firebase in the background if user has a code
    syncToFirebase();
  }

  /* ---------------------------------------------------
     FIREBASE SYNC LAYER
     Reads from Firestore on open, writes on every save.
     Falls back silently if offline or not configured.
     --------------------------------------------------- */

  function getFirebase() {
    return window._nurture_firebase || null;
  }

  async function syncToFirebase() {
    const fb   = getFirebase();
    const code = state.accessCode;
    // Only sync once unlocked this session — never push/pull real
    // data through the client SDK before password verification.
    if (!fb || !code || !isUnlocked) return;
    try {
      const { db, doc, setDoc, serverTimestamp } = fb;
      await setDoc(doc(db, "users", code), {
        ...state,
        lastSynced: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      // Silent — offline or quota exceeded, localStorage still has the data
    }
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function checkForNewDay() {
    const key = todayKey();
    if (state.today.dayKey !== key) {
      state.history.unshift({
        date: state.today.dayKey,
        sleep: state.today.sleep,
        energy: state.today.energy,
        mood: state.today.mood,
        kicks: state.today.kicks,
        symptoms: state.today.symptoms,
        feedingStatus: state.today.feedingStatus,
        nappyWet: state.today.nappyWet,
        nappyDirty: state.today.nappyDirty,
        pain: state.today.pain
      });
      state.today = {
        dayKey: key,
        sleep: 0,
        energy: null,
        mood: null,
        kicks: 0,
        symptoms: [],
        feedingStatus: null,
        nappyWet: 0,
        nappyDirty: 0,
        pain: null
      };
      state.checklist = state.checklist.map((item) => ({ ...item, done: false }));
      saveState();
    }
  }

  let state = loadState();
  checkForNewDay();

  /* ---------------------------------------------------
     3. VIEW SWITCHING — marketing / onboarding / app
     --------------------------------------------------- */
  const marketingView = document.getElementById("marketing-view");
  const appView       = document.getElementById("app-view");
  const onboardView   = document.getElementById("onboard-view");
  const loginView     = document.getElementById("login-view");
  const registerView  = document.getElementById("register-view");
  const authOverlay   = document.getElementById("auth-overlay");

  function hideAllViews() {
    marketingView.hidden = true;
    appView.hidden       = true;
    onboardView.hidden   = true;
    loginView.hidden     = true;
    registerView.hidden  = true;
  }

  function showMarketing() {
    hideAllViews();
    marketingView.hidden = false;
    window.scrollTo(0, 0);
  }

  function showRegister() {
    hideAllViews();
    registerView.hidden = false;
    window.scrollTo(0, 0);
  }

  // Shows the standalone full-page login (used from the marketing
  // page's "Login" link/button, and from "Register" -> existing user).
  function showLogin() {
    hideAllViews();
    loginView.hidden = false;
    window.scrollTo(0, 0);
    document.getElementById("login-error").hidden = true;
    const codeInput = document.getElementById("login-code");
    codeInput.value = getRememberedCode();
    document.getElementById("login-password").value = "";
  }

  function showOnboarding() {
    hideAllViews();
    onboardView.hidden = false;
    window.scrollTo(0, 0);
    renderOnboarding();
  }

  // Shows the app shell. If not yet unlocked this page-load, the
  // password overlay renders on top and the real data is NOT fetched
  // or rendered underneath — only a blurred skeleton placeholder.
  function showApp() {
    hideAllViews();
    appView.hidden = false;
    window.scrollTo(0, 0);

    if (!isUnlocked && state.accessCode) {
      // Returning browser with a known account, but this fresh
      // page-load hasn't been password-verified yet — show the
      // blurred app behind a login overlay instead of real data.
      appView.classList.add("app-locked");
      renderAuthOverlay();
    } else {
      appView.classList.remove("app-locked");
      authOverlay.hidden = true;
      applyStageToApp();
      renderAll();
    }
  }

  function renderAuthOverlay() {
    authOverlay.hidden = false;
    document.getElementById("auth-overlay-error").hidden = true;
    const codeInput = document.getElementById("auth-overlay-code");
    codeInput.value = state.accessCode || getRememberedCode();
    document.getElementById("auth-overlay-password").value = "";
  }

  async function attemptUnlock(code, password, errorElId, onSuccess) {
    const errorEl = document.getElementById(errorElId);
    errorEl.hidden = true;
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code, password })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        errorEl.textContent = data.error || "Couldn't verify those details. Please try again.";
        errorEl.hidden = false;
        return false;
      }
      // Merge the verified cloud data into local state — same
      // shape/merge logic as loginWithCode used previously.
      const fresh = defaultState();
      const cloud = data.userData || {};
      state = {
        ...fresh,
        ...cloud,
        today:   { ...fresh.today,   ...(cloud.today   || {}) },
        village: {
          members: cloud.village?.members || fresh.village.members,
          tasks:   cloud.village?.tasks   || fresh.village.tasks
        },
        care: {
          contacts:     cloud.care?.contacts     || fresh.care.contacts,
          appointments: cloud.care?.appointments || fresh.care.appointments,
          diary:        cloud.care?.diary        || fresh.care.diary
        },
        accessCode: code.toUpperCase().trim(),
        onboarded: true
      };
      isUnlocked = true;
      setRememberedCode(state.accessCode);
      saveState();
      onSuccess();
      return true;
    } catch (err) {
      errorEl.textContent = "Couldn't reach the server. Please check your connection and try again.";
      errorEl.hidden = false;
      return false;
    }
  }

  function launchApp() {
    if (state.onboarded && state.accessCode) {
      // Returning browser with a linked account — go straight to the
      // app shell, which will show the password overlay if this fresh
      // page-load hasn't been unlocked yet.
      showApp();
    } else {
      // Genuinely new to this browser — full landing-page-first flow.
      showLogin();
    }
  }

  document.getElementById("nav-launch-app").addEventListener("click", (e) => { e.preventDefault(); launchApp(); });
  document.getElementById("hero-launch-app").addEventListener("click", (e) => { e.preventDefault(); launchApp(); });
  document.getElementById("app-exit").addEventListener("click", (e) => {
    e.preventDefault();
    isUnlocked = false;
    showMarketing();
  });

  // Standalone login page (marketing -> Login)
  document.getElementById("login-submit").addEventListener("click", async () => {
    const code     = document.getElementById("login-code").value.trim().toUpperCase();
    const password = document.getElementById("login-password").value;
    const btn      = document.getElementById("login-submit");
    if (!code || !password) {
      const errorEl = document.getElementById("login-error");
      errorEl.textContent = "Enter both your access code and password.";
      errorEl.hidden = false;
      return;
    }
    btn.textContent = "Verifying…";
    btn.disabled = true;
    await attemptUnlock(code, password, "login-error", () => showApp());
    btn.textContent = "Log in →";
    btn.disabled = false;
  });

  // Auth overlay (blurred app, returning browser)
  document.getElementById("auth-overlay-submit").addEventListener("click", async () => {
    const code     = document.getElementById("auth-overlay-code").value.trim().toUpperCase();
    const password = document.getElementById("auth-overlay-password").value;
    const btn      = document.getElementById("auth-overlay-submit");
    if (!code || !password) {
      const errorEl = document.getElementById("auth-overlay-error");
      errorEl.textContent = "Enter both your access code and password.";
      errorEl.hidden = false;
      return;
    }
    btn.textContent = "Verifying…";
    btn.disabled = true;
    await attemptUnlock(code, password, "auth-overlay-error", () => {
      appView.classList.remove("app-locked");
      authOverlay.hidden = true;
      applyStageToApp();
      renderAll();
    });
    btn.textContent = "Unlock →";
    btn.disabled = false;
  });

  // Uppercase the code as it's typed, on both login forms
  ["login-code", "auth-overlay-code"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  });

  document.getElementById("auth-overlay-different")?.addEventListener("click", () => {
    setRememberedCode("");
    state.accessCode = null;
    state.onboarded = false;
    saveState();
    showLogin();
  });

  // Register / Login navigation links
  document.getElementById("goto-register")?.addEventListener("click", (e) => {
    e.preventDefault();
    showRegister();
  });
  document.getElementById("goto-login")?.addEventListener("click", (e) => {
    e.preventDefault();
    showLogin();
  });
  document.getElementById("nav-register")?.addEventListener("click", (e) => {
    e.preventDefault();
    showRegister();
  });
  document.getElementById("nav-login")?.addEventListener("click", (e) => {
    e.preventDefault();
    showLogin();
  });

  /* ---------------------------------------------------
     4. ONBOARDING — name + stage selection
     --------------------------------------------------- */
  function renderOnboarding() {
    const container = document.getElementById("onboard-content");
    container.innerHTML = `
      <div class="onboard-card">
        <span class="onboard-emoji">🌿</span>
        <h1>Welcome to Nurture</h1>
        <p>A quiet, private companion for your pregnancy and beyond. Let's set things up in about 30 seconds.</p>

        <label for="ob-name">What should we call you?</label>
        <input type="text" id="ob-name" placeholder="Your first name" autocomplete="given-name" value="${escapeHtml(state.name)}" />

        <label>Where are you right now?</label>
        <div class="stage-buttons">
          <button class="stage-btn ${state.stage === 'pregnant' ? 'is-selected' : ''}"
                  data-stage="pregnant">
            <span class="stage-btn__emoji">🤰</span>
            <span class="stage-btn__label">I'm pregnant</span>
          </button>
          <button class="stage-btn ${state.stage === 'postpartum' ? 'is-selected' : ''}"
                  data-stage="postpartum">
            <span class="stage-btn__emoji">👶</span>
            <span class="stage-btn__label">I've had my baby</span>
          </button>
        </div>

        <button class="btn btn--primary btn--full" id="ob-continue" ${!state.stage ? 'disabled' : ''}>
          Continue →
        </button>
      </div>`;

    container.querySelectorAll(".stage-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".stage-btn").forEach((b) => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        state.stage = btn.dataset.stage;
        document.getElementById("ob-continue").disabled = false;
      });
    });

    document.getElementById("ob-continue").addEventListener("click", () => {
      const name = document.getElementById("ob-name").value.trim();
      if (!state.stage) return;
      state.name = name || "there";
      state.onboarded = true;
      saveState();
      showApp();
    });
  }

  /* ---------------------------------------------------
     5. STAGE TRANSITION — "I've had my baby"
     --------------------------------------------------- */
  function transitionToPostpartum() {
    if (state.stage === "postpartum") return;
    state.stage = "postpartum";
    // Clear pregnancy checklist items and reset to blank for postpartum
    state.checklist = [];
    saveState();
    applyStageToApp();
    renderAll();
    openPanel("home");
  }

  /* ---------------------------------------------------
     6. APPLY STAGE TO APP — show/hide stage-specific elements
     --------------------------------------------------- */
  function applyStageToApp() {
    const isPregnant   = state.stage === "pregnant";
    const isPostpartum = state.stage === "postpartum";

    // Pregnant-only elements
    document.querySelectorAll("[data-stage-show='pregnant']").forEach((el) => {
      el.hidden = !isPregnant;
    });
    // Postpartum-only elements
    document.querySelectorAll("[data-stage-show='postpartum']").forEach((el) => {
      el.hidden = !isPostpartum;
    });

    // Update app header greeting stage label
    const stageLabel = document.getElementById("app-stage-label");
    if (stageLabel) {
      stageLabel.textContent = isPregnant ? "Pregnancy" : "New Mum";
    }
  }

  /* ---------------------------------------------------
     7. APP TAB NAVIGATION
     --------------------------------------------------- */
  const navItems = document.querySelectorAll(".app-nav__item");
  const panels   = document.querySelectorAll(".app-panel");

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
    });
  });

  /* ---------------------------------------------------
     8. HOME TAB
     --------------------------------------------------- */
  function renderHome() {
    const isPregnant = state.stage === "pregnant";
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    document.getElementById("home-greeting").textContent = `${greeting}, ${state.name} 🌿`;

    // Mood selector
    const moodRow = document.getElementById("mood-row");
    moodRow.innerHTML = MOODS.map((m) => `
      <button class="mood-btn ${state.today.mood === m.value ? 'is-selected' : ''}"
              data-mood="${m.value}" aria-label="${m.label}">
        <span class="mood-btn__emoji">${m.emoji}</span>
        <span class="mood-btn__label">${m.label}</span>
      </button>`).join("");

    moodRow.querySelectorAll(".mood-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.today.mood = btn.dataset.mood;
        saveState();
        renderHome();
        renderPulse();
      });
    });

    // Checklist
    const checklistEl = document.getElementById("home-checklist");
    checklistEl.innerHTML = state.checklist.length === 0
      ? `<p class="muted-text">No items yet — add some below or pick from suggestions.</p>`
      : state.checklist.map((item) => `
          <li class="${item.done ? 'is-done' : ''}">
            <label>
              <input type="checkbox" data-check-id="${item.id}" ${item.done ? "checked" : ""} />
              <span>${escapeHtml(item.label)}</span>
            </label>
            <button class="item-remove" data-remove-check="${item.id}" aria-label="Remove">✕</button>
          </li>`).join("");

    checklistEl.querySelectorAll("[data-check-id]").forEach((box) => {
      box.addEventListener("change", () => {
        const item = state.checklist.find((i) => i.id === box.dataset.checkId);
        if (item) { item.done = box.checked; saveState(); renderHome(); }
      });
    });
    checklistEl.querySelectorAll("[data-remove-check]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.checklist = state.checklist.filter((i) => i.id !== btn.dataset.removeCheck);
        saveState(); renderHome();
      });
    });

    // Suggestions panel
    const suggestEl = document.getElementById("checklist-suggestions");
    const suggestions = CHECKLIST_SUGGESTIONS[state.stage] || [];
    const existing = state.checklist.map((i) => i.label);
    const available = suggestions.filter((s) => !existing.includes(s));
    suggestEl.innerHTML = available.map((s) => `
      <button class="chip suggest-chip" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`
    ).join("");

    suggestEl.querySelectorAll(".suggest-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        state.checklist.push({ id: "c" + Date.now(), label: chip.dataset.suggest, done: false });
        saveState(); renderHome();
      });
    });

    // "I've had my baby" transition card — only shown to pregnant users
    const transitionCard = document.getElementById("baby-arrived-card");
    if (transitionCard) transitionCard.hidden = state.stage !== "pregnant";
  }

  // Add checklist item manually
  document.getElementById("add-checklist-btn").addEventListener("click", () => {
    openModal("Add checklist item", `
      <label for="f-check">What do you want to remember today?</label>
      <input type="text" id="f-check" name="label" required placeholder="e.g. Call midwife" />`,
      (data) => {
        const label = data.get("label").trim();
        if (!label) return;
        state.checklist.push({ id: "c" + Date.now(), label, done: false });
        saveState(); renderHome();
      }
    );
  });

  // Baby arrived transition
  document.getElementById("baby-arrived-btn").addEventListener("click", () => {
    if (confirm("Has your baby arrived? This will switch your whole app to your new mum experience.")) {
      transitionToPostpartum();
    }
  });

  function moodScore(moodKey) {
    const mood = MOODS.find((m) => m.value === moodKey);
    return mood ? mood.score : 3;
  }

  function renderPulse() {
    checkForNewDay();
    const recent     = state.history.slice(0, 6);
    const sleepVals  = [state.today.sleep, ...recent.map((d) => d.sleep || 0)].filter((v) => v > 0);
    const energyVals = [state.today.energy, ...recent.map((d) => d.energy)].filter((v) => v !== null && v !== undefined);
    const moodKeys   = [state.today.mood, ...recent.map((d) => d.mood)].filter((m) => m !== null && m !== undefined);
    const moodVals   = moodKeys.map(moodScore);
    const avg        = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const avgMood   = avg(moodVals);
    const avgEnergy = avg(energyVals);
    const avgSleep  = avg(sleepVals);
    const moodEmoji = avgMood >= 4.5 ? "😊" : avgMood >= 3.5 ? "😌" : avgMood >= 2.5 ? "😔" : avgMood >= 1.5 ? "😰" : "😵";

    document.getElementById("stat-avg-mood").textContent   = moodVals.length   ? `${moodEmoji} ${avgMood.toFixed(1)}`   : "—";
    document.getElementById("stat-avg-sleep").textContent  = sleepVals.length  ? `${avgSleep.toFixed(1)}h`              : "—";
    document.getElementById("stat-avg-water").textContent  = energyVals.length ? `${avgEnergy.toFixed(1)} / 5`          : "—";

    // Rename the water label to Energy in the DOM
    const waterLabel = document.querySelector("#stat-avg-water")?.closest(".stat")?.querySelector(".stat__label");
    if (waterLabel) waterLabel.textContent = "Avg energy";

    // Hide feedings stat for pregnant users
    const feedStat = document.getElementById("stat-feedings");
    if (feedStat) {
      const feedCard = feedStat.closest("[data-stage-show='postpartum']");
      if (feedCard) feedCard.hidden = state.stage !== "postpartum";
    }

    document.getElementById("pulse-data-note").textContent =
      "Mood from Home · Sleep & Energy from Logs" +
      (state.stage === "postpartum" ? " · Feedings from Logs" : " · Kicks from Logs");

    // 7-day mood bar chart — uses score (1-5) for bar height, but shows
    // the actual mood emoji for that day, matching the Android app.
    const moodHistory = [];
    [...recent].reverse().forEach((d) => moodHistory.push(d.mood || "TIRED"));
    while (moodHistory.length < 6) moodHistory.unshift("TIRED");
    moodHistory.push(state.today.mood || "TIRED");

    const dayLabels = ["6d ago", "5d", "4d", "3d", "2d", "Yest.", "Today"];
    document.getElementById("mood-bar-chart").innerHTML = moodHistory.map((moodKey, i) => {
      const score = moodScore(moodKey);
      const pct  = (score / 5) * 100;
      const mood = MOODS.find((m) => m.value === moodKey) || MOODS[2];
      return `
        <div class="bar-chart__col">
          <span class="bar-chart__emoji">${mood.emoji}</span>
          <div class="bar-chart__bar" style="height:${pct}%"></div>
          <span class="bar-chart__day">${dayLabels[i]}</span>
        </div>`;
    }).join("");

    // Gentle insight
    const insightEl = document.getElementById("pulse-insight");
    let insight = "";
    if (moodVals.length < 3) {
      insight = "Check in with your mood on the Home tab each day — your trends will appear here after a few days.";
    } else if (avgMood <= 2) {
      insight = "Your mood has been quite low this week. That's okay — and it's worth being gentle with yourself. If it continues, please talk to someone you trust or your midwife.";
    } else if (avgSleep < 4 && sleepVals.length >= 2) {
      insight = "Your sleep has been very low this week. Even short rest periods during the day make a real difference — ask for help if you can.";
    } else if (avgEnergy <= 2 && energyVals.length >= 2) {
      insight = "Your energy has been consistently low. Make sure you're resting when you can, eating regularly, and letting your village help.";
    } else if (avgMood >= 4) {
      insight = "You've had a good week — that's worth noticing and holding on to.";
    } else {
      insight = "Things look fairly steady. Keep going at your own pace — you're doing a wonderful job.";
    }
    insightEl.textContent = insight;
  }

  /* ---------------------------------------------------
     10. COMPANION / QUESTION HUB
     --------------------------------------------------- */
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function matchesQuery(item, query) {
    if (!query) return true;
    const haystack = `${item.q} ${item.sub.join(" ")} ${item.a}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function questionCardHTML(item, headingTag) {
    const subList = item.sub.length
      ? `<ul>${item.sub.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : "";
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

  function renderQuestionGroup(containerId, stage, query, headingTag) {
    const container = document.getElementById(containerId);
    if (!container) return 0;
    const matches = QUESTIONS.filter((item) => item.stage === stage && matchesQuery(item, query));
    container.innerHTML = matches.map((item) => questionCardHTML(item, headingTag)).join("");
    return matches.length;
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

  // Stage-aware hub render — only shows questions for current stage
  function renderHub(searchInputId, listIdStage, countId, emptyId, trustedId, headingTag) {
    const query    = document.getElementById(searchInputId)?.value.trim() || "";
    const stage    = state.stage || "pregnant";
    const count    = renderQuestionGroup(listIdStage, stage, query, headingTag);
    const countEl  = document.getElementById(countId);
    const emptyEl  = document.getElementById(emptyId);
    if (countEl) countEl.textContent = query ? `${count} question${count === 1 ? "" : "s"} match "${query}"` : "";
    if (emptyEl) emptyEl.hidden = count !== 0;

    const trustedPanel = document.getElementById(trustedId);
    if (trustedPanel) {
      const show = !!query && count === 0;
      trustedPanel.hidden = !show;
      if (show) {
        trustedPanel.dataset.pendingQuery = query;
        const resultsEl = trustedPanel.querySelector(".trusted-results");
        if (resultsEl) resultsEl.innerHTML = "";
        const btn = trustedPanel.querySelector("button");
        if (btn) btn.textContent = `Search trusted sources for "${query}"`;
      }
    }
  }

  // Marketing page hub — shows both stages
  function renderMarketingHub(query) {
    const pregCount  = renderQuestionGroup("hub-list-pregnancy", "pregnant", query, "h3");
    const postCount  = renderQuestionGroup("hub-list-postpartum", "postpartum", query, "h3");
    const total      = pregCount + postCount;
    const countEl    = document.getElementById("hub-results-count");
    const emptyEl    = document.getElementById("hub-empty");
    if (countEl) countEl.textContent = query ? `${total} question${total === 1 ? "" : "s"} match "${query}"` : "";
    if (emptyEl) emptyEl.hidden = total !== 0;

    const trustedPanel = document.getElementById("hub-trusted-search");
    if (trustedPanel) {
      const show = !!query && total === 0;
      trustedPanel.hidden = !show;
      if (show) {
        trustedPanel.dataset.pendingQuery = query;
        const resultsEl = trustedPanel.querySelector(".trusted-results");
        if (resultsEl) resultsEl.innerHTML = "";
        const btn = trustedPanel.querySelector("button");
        if (btn) btn.textContent = `Search trusted sources for "${query}"`;
      }
    }
  }

  wireAccordion("hub-list-pregnancy");
  wireAccordion("hub-list-postpartum");
  wireAccordion("app-list-stage");

  document.getElementById("hub-search-input")?.addEventListener("input", (e) => {
    renderMarketingHub(e.target.value.trim());
  });
  renderMarketingHub("");

  document.getElementById("app-search-input")?.addEventListener("input", () => {
    renderHub("app-search-input", "app-list-stage", "app-results-count", "app-empty", "app-trusted-search", "h2");
  });

  function filterQuestionsByWord(word) {
    const input = document.getElementById("app-search-input");
    if (input) {
      input.value = word;
      renderHub("app-search-input", "app-list-stage", "app-results-count", "app-empty", "app-trusted-search", "h2");
    }
  }

  // Chips
  const CHIP_WORDS_PREGNANT   = ["nausea", "cramping", "exhausted", "birth", "emotions", "movement"];
  const CHIP_WORDS_POSTPARTUM = ["crying", "feeding", "bonding", "exhausted", "bleeding", "mood"];

  function renderChips() {
    const chipRow = document.getElementById("app-question-chips");
    if (!chipRow) return;
    const words = state.stage === "postpartum" ? CHIP_WORDS_POSTPARTUM : CHIP_WORDS_PREGNANT;
    chipRow.innerHTML = words.map((w) => `<button class="chip" type="button">${escapeHtml(w)}</button>`).join("");
    chipRow.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => filterQuestionsByWord(btn.textContent));
    });
  }

  // Ask forms
  function wireAskForm(formId, inputId, toApp) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = document.getElementById(inputId)?.value.trim();
      if (toApp) launchApp();
      openPanel("companion");
      if (value) filterQuestionsByWord(value);
    });
  }
  wireAskForm("hero-ask-form", "hero-ask-input", true);
  wireAskForm("home-ask-form", "home-ask-input", false);

  /* ---------------------------------------------------
     11. TRUSTED-SOURCE SEARCH
     --------------------------------------------------- */
  async function runTrustedSearch(panelId) {
    const panel     = document.getElementById(panelId);
    const resultsEl = panel.querySelector(".trusted-results");
    const rawQuery  = panel.dataset.pendingQuery || "";
    if (!rawQuery) return;

    // Append stage context so Google returns stage-relevant results
    const contextualQuery = `${rawQuery} ${SEARCH_CONTEXT[state.stage] || "pregnancy"}`;
    resultsEl.innerHTML = `<p class="trusted-search__status">Searching trusted sources&hellip;</p>`;

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(contextualQuery)}`);
      const data     = await response.json();

      if (!response.ok) {
        resultsEl.innerHTML = `<p class="trusted-card__error">${escapeHtml(data.error || "Search failed.")}</p>`;
        return;
      }
      if (!data.best && (!data.results || data.results.length === 0)) {
        resultsEl.innerHTML = `<p class="trusted-search__status">No trusted sources matched. Try different words, or ask your midwife or doctor directly.</p>`;
        return;
      }

      const tierLabel    = (tier) => tier === "clinical" ? "Medically reviewed" : "Trusted source";
      const excerptLabel = (src)  => src === "article" ? "Excerpt from article" : "Search summary";

      const bestHtml = data.best ? `
        <div class="trusted-card trusted-card--best">
          <span class="trusted-card__best-flag">Best answer</span>
          <span class="trusted-card__source">${escapeHtml(tierLabel(data.best.tier))} · ${escapeHtml(data.best.source)}</span>
          <h4>${escapeHtml(data.best.title)}</h4>
          <p>${escapeHtml(data.best.snippet)}</p>
          <p class="trusted-card__excerpt-label">${escapeHtml(excerptLabel(data.best.excerptSource))}</p>
          <a class="trusted-card__link" href="${escapeHtml(data.best.link)}" target="_blank" rel="noopener noreferrer">Read full article on ${escapeHtml(data.best.source)} →</a>
        </div>` : "";

      const restHtml = (data.results || []).map((r) => `
        <div class="trusted-card">
          <span class="trusted-card__source">${escapeHtml(tierLabel(r.tier))} · ${escapeHtml(r.source)}</span>
          <h4>${escapeHtml(r.title)}</h4>
          <p>${escapeHtml(r.snippet)}</p>
          <a class="trusted-card__link" href="${escapeHtml(r.link)}" target="_blank" rel="noopener noreferrer">Read full article on ${escapeHtml(r.source)} →</a>
        </div>`).join("");

      const moreLabel = (data.results || []).length ? `<p class="trusted-search__more-label">More from trusted sources</p>` : "";

      resultsEl.innerHTML = bestHtml + moreLabel + restHtml + `
        <p class="trusted-search__disclosure">Results from trusted medical and pregnancy organisations. We never store or share what you search.</p>`;
    } catch (err) {
      resultsEl.innerHTML = `<p class="trusted-card__error">Something went wrong. Please try again.</p>`;
    }
  }

  document.getElementById("hub-trusted-search-btn")?.addEventListener("click", () => runTrustedSearch("hub-trusted-search"));
  document.getElementById("app-trusted-search-btn")?.addEventListener("click", () => runTrustedSearch("app-trusted-search"));

  /* ---------------------------------------------------
     12. VILLAGE TAB
     --------------------------------------------------- */
  function renderVillage() {
    const memberList = document.getElementById("village-members");
    memberList.innerHTML = state.village.members.map((m) => `
      <li data-id="${m.id}">
        <span><span class="item-title">${escapeHtml(m.name)}</span><span class="item-sub"> · ${escapeHtml(m.role)}</span></span>
        <button class="item-remove" data-remove-member="${m.id}">✕</button>
      </li>`).join("") || `<li><span class="item-sub">No one added yet.</span></li>`;

    const taskList = document.getElementById("village-tasks");
    taskList.innerHTML = state.village.tasks.map((t) => `
      <li data-id="${t.id}">
        <input type="checkbox" data-toggle-task="${t.id}" ${t.done ? "checked" : ""} />
        <span class="task-text ${t.done ? "is-done" : ""}">
          ${escapeHtml(t.label)}
          <span class="task-assignee">${escapeHtml(t.assignee)}</span>
        </span>
        <button class="item-remove" data-remove-task="${t.id}">✕</button>
      </li>`).join("") || `<li><span class="item-sub">No shared tasks yet.</span></li>`;

    memberList.querySelectorAll("[data-remove-member]").forEach((btn) => {
      btn.onclick = () => { state.village.members = state.village.members.filter((m) => m.id !== btn.dataset.removeMember); saveState(); renderVillage(); };
    });
    taskList.querySelectorAll("[data-toggle-task]").forEach((box) => {
      box.onchange = () => { const t = state.village.tasks.find((t) => t.id === box.dataset.toggleTask); if (t) { t.done = box.checked; saveState(); renderVillage(); } };
    });
    taskList.querySelectorAll("[data-remove-task]").forEach((btn) => {
      btn.onclick = () => { state.village.tasks = state.village.tasks.filter((t) => t.id !== btn.dataset.removeTask); saveState(); renderVillage(); };
    });
  }

  /* ---------------------------------------------------
     13. CARE TAB
     --------------------------------------------------- */
  function renderCare() {
    const contactList = document.getElementById("care-contacts");
    contactList.innerHTML = state.care.contacts.map((c) => `
      <li data-id="${c.id}">
        <span><span class="item-title">${escapeHtml(c.name)}</span><span class="item-sub"> · ${escapeHtml(c.role)} · ${escapeHtml(c.phone)}</span></span>
        <span>
          <a class="icon-btn" style="text-decoration:none;font-size:1rem;" href="tel:${escapeHtml(c.phone)}" aria-label="Call ${escapeHtml(c.name)}">📞</a>
          <button class="item-remove" data-remove-contact="${c.id}">✕</button>
        </span>
      </li>`).join("") || `<li><span class="item-sub">No contacts yet.</span></li>`;

    const apptList = document.getElementById("care-appointments");
    apptList.innerHTML = state.care.appointments.map((a) => `
      <li data-id="${a.id}">
        <span><span class="item-title">${escapeHtml(a.title)}</span><span class="item-sub"> · ${escapeHtml(a.date)} ${escapeHtml(a.time)}</span></span>
        <button class="item-remove" data-remove-appt="${a.id}">✕</button>
      </li>`).join("") || `<li><span class="item-sub">No appointments yet.</span></li>`;

    const diaryList = document.getElementById("care-diary");
    diaryList.innerHTML = state.care.diary.map((d) => `
      <li data-id="${d.id}">
        <span><span class="item-title">${escapeHtml(d.title)}</span><span class="item-sub"> · ${escapeHtml(d.date)}</span></span>
        <button class="item-remove" data-remove-diary="${d.id}">✕</button>
      </li>`).join("") || `<li><span class="item-sub">No entries yet — tap + to write one.</span></li>`;

    contactList.querySelectorAll("[data-remove-contact]").forEach((btn) => {
      btn.onclick = () => { state.care.contacts = state.care.contacts.filter((c) => c.id !== btn.dataset.removeContact); saveState(); renderCare(); };
    });
    apptList.querySelectorAll("[data-remove-appt]").forEach((btn) => {
      btn.onclick = () => { state.care.appointments = state.care.appointments.filter((a) => a.id !== btn.dataset.removeAppt); saveState(); renderCare(); };
    });
    diaryList.querySelectorAll("[data-remove-diary]").forEach((btn) => {
      btn.onclick = () => { state.care.diary = state.care.diary.filter((d) => d.id !== btn.dataset.removeDiary); saveState(); renderCare(); };
    });
  }

  /* ---------------------------------------------------
     14. LOGS TAB — stage-aware meaningful tracking
     --------------------------------------------------- */
  const ENERGY_LABELS = { 1: "Completely drained", 2: "Low", 3: "Okay", 4: "Good", 5: "Strong" };
  const PAIN_LABELS   = { 1: "No pain", 2: "Mild", 3: "Moderate", 4: "Significant", 5: "Severe" };
  const FEEDING_LABELS = { well: "Feeding well 😊", mixed: "Mixed 😐", struggling: "Struggling 😟" };

  function renderLogs() {
    checkForNewDay();

    // Show whether localStorage is working — helps diagnose the
    // "looks like it resets" concern immediately.
    const storageNote = document.getElementById("storage-note");
    if (storageNote) {
      try {
        const testKey = "_ntest";
        localStorage.setItem(testKey, "1");
        localStorage.removeItem(testKey);
        const lastSaved = state.today.dayKey;
        storageNote.textContent = `✓ Data is saved on this device. Last active: ${lastSaved}`;
        storageNote.style.color = "var(--sage-700)";
      } catch (e) {
        storageNote.textContent = "⚠ Storage is not available in this browser mode. Open via http:// not file://.";
        storageNote.style.color = "var(--rose-600)";
      }
    }

    // Sleep
    const sleepInput = document.getElementById("sleep-input");
    if (sleepInput) sleepInput.value = state.today.sleep || "";
    const sleepSaved = document.getElementById("sleep-saved");
    if (sleepSaved) sleepSaved.hidden = !state.today.sleep;

    // Energy
    document.querySelectorAll("#energy-row .energy-btn").forEach((btn) => {
      btn.classList.toggle("is-selected", parseInt(btn.dataset.energy) === state.today.energy);
    });

    // Kicks (pregnant)
    const kicksEl = document.getElementById("kicks-count");
    if (kicksEl) kicksEl.textContent = String(state.today.kicks);

    // Symptoms (pregnant)
    const symptomList = document.getElementById("symptom-list");
    if (symptomList) {
      symptomList.innerHTML = (state.today.symptoms || []).map((s, i) => `
        <li>
          <span>${escapeHtml(s)}</span>
          <button class="item-remove" data-remove-symptom="${i}">✕</button>
        </li>`).join("") || "";
      symptomList.querySelectorAll("[data-remove-symptom]").forEach((btn) => {
        btn.onclick = () => {
          state.today.symptoms.splice(parseInt(btn.dataset.removeSymptom), 1);
          saveState(); renderLogs();
        };
      });
    }

    // Feeding status (postpartum)
    document.querySelectorAll("#feed-options .feed-btn").forEach((btn) => {
      btn.classList.toggle("is-selected", btn.dataset.feeding === state.today.feedingStatus);
    });

    // Nappies (postpartum)
    const wetEl   = document.getElementById("nappy-wet-count");
    const dirtyEl = document.getElementById("nappy-dirty-count");
    if (wetEl)   wetEl.textContent   = String(state.today.nappyWet);
    if (dirtyEl) dirtyEl.textContent = String(state.today.nappyDirty);

    // Pain (postpartum)
    document.querySelectorAll("#pain-row .energy-btn").forEach((btn) => {
      btn.classList.toggle("is-selected", parseInt(btn.dataset.pain) === state.today.pain);
    });

    // History
    const history = document.getElementById("logs-history");
    history.innerHTML = state.history.map((d) => {
      const mood   = MOODS.find((m) => m.value === d.mood);
      const isPreg = state.stage === "pregnant";
      const extras = isPreg
        ? `· 👶 ${d.kicks || 0} kicks${d.symptoms?.length ? ` · 📝 ${d.symptoms.length} note${d.symptoms.length > 1 ? "s" : ""}` : ""}`
        : `· 🍼 ${FEEDING_LABELS[d.feedingStatus] || "—"} · 🧷 ${d.nappyWet || 0}W/${d.nappyDirty || 0}D`;
      return `
        <div class="history-card">
          <div>
            <span class="history-card__date">${escapeHtml(d.date)}</span>
            <span class="history-card__stats">
              ${mood ? mood.emoji : "—"} · 😴 ${d.sleep || 0}h · ⚡ ${ENERGY_LABELS[d.energy] || "—"} ${extras}
            </span>
          </div>
        </div>`;
    }).join("") || `<p class="muted-text">No history yet — builds up day by day.</p>`;
  }

  // Sleep
  document.getElementById("sleep-save")?.addEventListener("click", () => {
    const val = parseFloat(document.getElementById("sleep-input")?.value);
    if (!isNaN(val) && val >= 0 && val <= 24) {
      state.today.sleep = val; saveState(); renderLogs(); renderPulse();
    }
  });

  // Energy
  document.getElementById("energy-row")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".energy-btn[data-energy]");
    if (!btn) return;
    state.today.energy = parseInt(btn.dataset.energy);
    saveState(); renderLogs();
  });

  // Kicks
  document.getElementById("kicks-increment")?.addEventListener("click", () => {
    checkForNewDay(); state.today.kicks = (state.today.kicks || 0) + 1; saveState(); renderLogs();
  });

  // Symptom note
  document.getElementById("symptom-save")?.addEventListener("click", () => {
    const input = document.getElementById("symptom-input");
    const val   = input?.value.trim();
    if (!val) return;
    if (!state.today.symptoms) state.today.symptoms = [];
    state.today.symptoms.push(val);
    input.value = "";
    saveState(); renderLogs();
  });

  // Feeding status
  document.getElementById("feed-options")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".feed-btn[data-feeding]");
    if (!btn) return;
    state.today.feedingStatus = btn.dataset.feeding;
    saveState(); renderLogs();
  });

  // Nappies
  document.getElementById("nappy-wet-increment")?.addEventListener("click", () => {
    checkForNewDay(); state.today.nappyWet = (state.today.nappyWet || 0) + 1; saveState(); renderLogs();
  });
  document.getElementById("nappy-dirty-increment")?.addEventListener("click", () => {
    checkForNewDay(); state.today.nappyDirty = (state.today.nappyDirty || 0) + 1; saveState(); renderLogs();
  });

  // Pain
  document.getElementById("pain-row")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".energy-btn[data-pain]");
    if (!btn) return;
    state.today.pain = parseInt(btn.dataset.pain);
    saveState(); renderLogs();
  });

  /* ---------------------------------------------------
     15. MODAL — shared for all + add actions
     --------------------------------------------------- */
  const overlay    = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const modalForm  = document.getElementById("modal-form");

  function openModal(title, fieldsHtml, onSubmit) {
    modalTitle.textContent = title;
    modalForm.innerHTML = fieldsHtml + `
      <div class="modal__actions">
        <button type="button" class="modal__cancel" id="modal-cancel-btn">Cancel</button>
        <button type="submit" class="modal__submit">Add</button>
      </div>`;
    overlay.hidden = false;
    document.getElementById("modal-cancel-btn").onclick = closeModal;
    modalForm.onsubmit = (e) => { e.preventDefault(); onSubmit(new FormData(modalForm)); closeModal(); };
    const firstInput = modalForm.querySelector("input, textarea");
    if (firstInput) firstInput.focus();
  }

  function closeModal() { overlay.hidden = true; modalForm.innerHTML = ""; }
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

  document.getElementById("add-member-btn").addEventListener("click", () => {
    openModal("Add to your village", `
      <label for="f-name">Name</label>
      <input type="text" id="f-name" name="name" required />
      <label for="f-role">Role</label>
      <select id="f-role" name="role"><option>Partner</option><option>Family</option><option>Friend</option></select>`,
      (data) => { state.village.members.push({ id: "m" + Date.now(), name: data.get("name"), role: data.get("role") }); saveState(); renderVillage(); }
    );
  });

  document.getElementById("add-task-btn").addEventListener("click", () => {
    const options = state.village.members.map((m) => `<option>${escapeHtml(m.name)}</option>`).join("");
    openModal("New shared task", `
      <label for="f-label">Task</label>
      <input type="text" id="f-label" name="label" required placeholder="e.g. Pick up prescription" />
      <label for="f-assignee">Assign to</label>
      <select id="f-assignee" name="assignee">${options || '<option>Unassigned</option>'}</select>`,
      (data) => { state.village.tasks.push({ id: "t" + Date.now(), label: data.get("label"), assignee: data.get("assignee"), done: false }); saveState(); renderVillage(); }
    );
  });

  document.getElementById("add-contact-btn").addEventListener("click", () => {
    openModal("Add speed dial contact", `
      <label for="f-cname">Name</label><input type="text" id="f-cname" name="name" required />
      <label for="f-crole">Role</label><input type="text" id="f-crole" name="role" placeholder="e.g. Midwife, GP" />
      <label for="f-cphone">Phone number</label><input type="tel" id="f-cphone" name="phone" required />`,
      (data) => { state.care.contacts.push({ id: "c" + Date.now(), name: data.get("name"), role: data.get("role") || "Contact", phone: data.get("phone") }); saveState(); renderCare(); }
    );
  });

  document.getElementById("add-appointment-btn").addEventListener("click", () => {
    openModal("Add appointment", `
      <label for="f-atitle">What's it for?</label><input type="text" id="f-atitle" name="title" required placeholder="e.g. 28-week scan" />
      <label for="f-adate">Date</label><input type="text" id="f-adate" name="date" placeholder="e.g. Tue, 24 Jun" />
      <label for="f-atime">Time</label><input type="text" id="f-atime" name="time" placeholder="e.g. 10:30 AM" />`,
      (data) => { state.care.appointments.push({ id: "a" + Date.now(), title: data.get("title"), date: data.get("date"), time: data.get("time") }); saveState(); renderCare(); }
    );
  });

  document.getElementById("new-diary-btn").addEventListener("click", () => {
    openModal("New diary entry", `
      <label for="f-dcontent">What's on your mind?</label>
      <textarea id="f-dcontent" name="content" required placeholder="Today was..."></textarea>`,
      (data) => {
        const content = data.get("content").trim();
        if (!content) return;
        const title = content.split(/\s+/).slice(0, 3).join(" ");
        const date  = new Date().toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        state.care.diary.unshift({ id: "d" + Date.now(), title, content, date });
        saveState(); renderCare();
      }
    );
  });

  /* ---------------------------------------------------
     16. INITIAL RENDER
     --------------------------------------------------- */
  function renderAll() {
    renderHome();
    renderPulse();
    renderVillage();
    renderCare();
    renderLogs();
    renderChips();
    renderHub("app-search-input", "app-list-stage", "app-results-count", "app-empty", "app-trusted-search", "h2");
  }

  // Start
  if (state.onboarded) {
    showApp();
  } else {
    showMarketing();
  }

})();
