/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
let state = {
  user: "",
  theme: "auto",
  accent: "indigo",
  meetings: [],
  todos: [],
  notifications: [],
  browserNotifs: false,
  showTestNotifButton: false,
  currentSection: "dashboard",
  meetingFilter: "all",
  todoFilter: "all",
};
let deleteCallback = null;
let notifAlertTimer = null;
let alertAudioCtx = null;
let currentGuideTab = 0;

const TIPS = [
  "فعّل الإشعارات لتلقّي تنبيه قبل اجتماعك بـ30 دقيقة!",
  "أضف وصفاً لاجتماعاتك لتسهيل المراجعة لاحقاً.",
  "رتّب مهامك حسب الأولوية لتُنجز الأهم أولاً.",
  'استخدم فلتر "اليوم" لرؤية اجتماعات اليوم فقط.',
  "يمكنك تعديل أي اجتماع أو مهمة بالضغط على أيقونة القلم.",
];

/* ─ Persistence ─ */
function saveState() {
  localStorage.setItem("planify_v3", JSON.stringify(state));
}
function loadState() {
  try {
    const r = localStorage.getItem("planify_v3");
    if (r) state = { ...state, ...JSON.parse(r) };
  } catch (e) {}
}

/* ═══════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════ */
function boot() {
  loadState();
  applyTheme(state.theme);
  applyAccent(state.accent);
  initTooltips();
  initAudioUnlock();
  if (state.user) startApp();
  else {
    document.getElementById("onboarding").style.display = "flex";
    lucide.createIcons();
  }
}

function submitName() {
  const n = document.getElementById("nameInput").value.trim();
  if (!n) {
    shakeEl("nameInput");
    return;
  }
  state.user = n;
  saveState();
  startApp();
}
document.getElementById("nameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitName();
});

function shakeEl(id) {
  const el = document.getElementById(id);
  el.style.borderColor = "#ef4444";
  el.style.boxShadow = "0 0 0 3px rgba(239,68,68,.2)";
  setTimeout(() => {
    el.style.borderColor = "";
    el.style.boxShadow = "";
  }, 900);
}

function startApp() {
  document.getElementById("onboarding").style.display = "none";
  document.getElementById("app").classList.add("visible");

  const emojis = ["✨", "🎉", "🌟", "💫", "🚀", "⚡", "🔥"];
  document.getElementById("heroName").textContent = state.user;
  document.getElementById("headerName").textContent =
    `أهلاً ${state.user} ${emojis[Math.floor(Math.random() * emojis.length)]}`;
  document.getElementById("dailyTip").textContent =
    TIPS[Math.floor(Math.random() * TIPS.length)];

  lucide.createIcons();
  applyTheme(state.theme);
  applyAccent(state.accent);
  updateThemeBtn();
  updateThemeSettingBtns();
  updateBrowserNotifToggle();

  showSection("dashboard");
  setInterval(updateClock, 1000);
  updateClock();
  setInterval(checkMeetingNotifications, 30000);
  checkMeetingNotifications();
  if (state.browserNotifs) requestNotifPermission(true);
}

/* ═══════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════ */
function applyTheme(mode) {
  state.theme = mode;
  const isDark =
    mode === "dark" ||
    (mode === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "dark" : "light",
  );
  saveState();
}
function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  setTheme(isDark ? "light" : "dark");
}
function setTheme(mode) {
  applyTheme(mode);
  updateThemeBtn();
  updateThemeSettingBtns();
  closeModal("settingsModal");
}
function updateThemeBtn() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const icon = isDark ? "sun" : "moon";
  ["themeBtn", "themeBtn2"].forEach((id) => {
    const b = document.getElementById(id);
    if (b) {
      b.innerHTML = `<i data-lucide="${icon}" style="width:17px;height:17px;"></i>`;
    }
  });
  lucide.createIcons();
}
function updateThemeSettingBtns() {
  ["light", "dark", "auto"].forEach((m) => {
    const b = document.getElementById("btn" + m[0].toUpperCase() + m.slice(1));
    if (b) b.classList.toggle("active", state.theme === m);
  });
}

/* ═══════════════════════════════════════════════
   ACCENT
═══════════════════════════════════════════════ */
function applyAccent(name) {
  state.accent = name;
  document.documentElement.setAttribute("data-accent", name);
  saveState();
}
function setAccent(name, el) {
  applyAccent(name);
  document
    .querySelectorAll(".swatch[data-accent]")
    .forEach((s) => s.classList.remove("active"));
  el.classList.add("active");
}

/* ═══════════════════════════════════════════════
   CLOCK
═══════════════════════════════════════════════ */
function updateClock() {
  const now = new Date();
  const el = document.getElementById("currentDateTime");
  if (el)
    el.textContent = now.toLocaleString("ar-EG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  // Update hero sub
  const h = now.getHours();
  const sub =
    h < 12 ? "صباح الخير ☀️" : h < 17 ? "مساء النور 🌤️" : "مساء الخير 🌙";
  const heroSub = document.getElementById("heroSub");
  if (heroSub) heroSub.textContent = `${sub} — مخططك الذكي لليوم`;
}

/* ═══════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════ */
function showSection(name) {
  state.currentSection = name;
  document
    .querySelectorAll('[id^="section-"]')
    .forEach((s) => (s.style.display = "none"));
  document
    .querySelectorAll(".nav-item, .dock-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById(`section-${name}`).style.display = "block";
  ["nav-", "dock-"].forEach((p) => {
    const b = document.getElementById(p + name);
    if (b) b.classList.add("active");
  });
  const map = {
    dashboard: renderDashboard,
    meetings: renderMeetings,
    todos: renderTodos,
    notifications: renderNotifications,
  };
  if (map[name]) map[name]();
}

/* ═══════════════════════════════════════════════
   MEETINGS CRUD
═══════════════════════════════════════════════ */
function openMeetingModal(id = null) {
  document.getElementById("editingMeetingId").value = id || "";
  document.getElementById("meetingModalTitle").textContent = id
    ? "✏️ تعديل الاجتماع"
    : "📅 اجتماع جديد";
  if (id) {
    const m = state.meetings.find((x) => x.id === id);
    if (!m) return;
    document.getElementById("meetTitle").value = m.title;
    document.getElementById("meetDesc").value = m.desc || "";
    document.getElementById("meetDate").value = m.date;
    document.getElementById("meetTime").value = m.time;
    document.getElementById("meetLocation").value = m.location || "";
    document
      .getElementById("meetNotifToggle")
      .classList.toggle("on", m.notif !== false);
  } else {
    ["meetTitle", "meetDesc", "meetLocation"].forEach(
      (id) => (document.getElementById(id).value = ""),
    );
    document.getElementById("meetDate").value = new Date()
      .toISOString()
      .split("T")[0];
    document.getElementById("meetTime").value = "";
    document.getElementById("meetNotifToggle").classList.add("on");
  }
  document.getElementById("meetingModal").style.display = "flex";
  lucide.createIcons();
  setTimeout(() => document.getElementById("meetTitle").focus(), 120);
}

function saveMeeting() {
  const title = document.getElementById("meetTitle").value.trim();
  const date = document.getElementById("meetDate").value;
  const time = document.getElementById("meetTime").value;
  if (!title || !date || !time) {
    showToastError("يرجى ملء العنوان والتاريخ والوقت");
    return;
  }
  const editId = document.getElementById("editingMeetingId").value;
  const id = editId || generateId();
  const old = state.meetings.find((m) => m.id === id);
  const meeting = {
    id,
    title,
    date,
    time,
    desc: document.getElementById("meetDesc").value.trim(),
    location: document.getElementById("meetLocation").value.trim(),
    notif: document.getElementById("meetNotifToggle").classList.contains("on"),
    createdAt: old?.createdAt || new Date().toISOString(),
    notified30: old?.notified30 || false,
    notified5: old?.notified5 || false,
  };
  const idx = state.meetings.findIndex((m) => m.id === id);
  if (idx >= 0) state.meetings[idx] = meeting;
  else state.meetings.push(meeting);
  saveState();
  closeModal("meetingModal");
  renderMeetings();
  renderDashboard();
  showToastSuccess(`تم حفظ "${title}" ✅`);
}

function deleteMeeting(id) {
  openConfirm(() => {
    state.meetings = state.meetings.filter((x) => x.id !== id);
    saveState();
    renderMeetings();
    renderDashboard();
    showToastSuccess("تم حذف الاجتماع 🗑️");
  });
}

/* ═══════════════════════════════════════════════
   TODOS CRUD
═══════════════════════════════════════════════ */
function openTodoModal(id = null) {
  document.getElementById("editingTodoId").value = id || "";
  document.getElementById("todoModalTitle").textContent = id
    ? "✏️ تعديل المهمة"
    : "✅ مهمة جديدة";
  if (id) {
    const t = state.todos.find((x) => x.id === id);
    if (!t) return;
    document.getElementById("todoTitle").value = t.title;
    document.getElementById("todoDesc").value = t.desc || "";
    document.getElementById("todoPriority").value = t.priority;
    document.getElementById("todoDue").value = t.due || "";
    document
      .getElementById("todoNotifToggle")
      .classList.toggle("on", t.notif === true);
  } else {
    ["todoTitle", "todoDesc"].forEach(
      (id) => (document.getElementById(id).value = ""),
    );
    document.getElementById("todoPriority").value = "medium";
    document.getElementById("todoDue").value = "";
    document.getElementById("todoNotifToggle").classList.remove("on");
  }
  document.getElementById("todoModal").style.display = "flex";
  lucide.createIcons();
  setTimeout(() => document.getElementById("todoTitle").focus(), 120);
}

function saveTodo() {
  const title = document.getElementById("todoTitle").value.trim();
  if (!title) {
    shakeEl("todoTitle");
    return;
  }
  const editId = document.getElementById("editingTodoId").value;
  const id = editId || generateId();
  const old = state.todos.find((t) => t.id === id);
  const todo = {
    id,
    title,
    desc: document.getElementById("todoDesc").value.trim(),
    priority: document.getElementById("todoPriority").value,
    due: document.getElementById("todoDue").value,
    notif: document.getElementById("todoNotifToggle").classList.contains("on"),
    done: old?.done || false,
    createdAt: old?.createdAt || new Date().toISOString(),
  };
  const idx = state.todos.findIndex((t) => t.id === id);
  if (idx >= 0) state.todos[idx] = todo;
  else state.todos.push(todo);
  saveState();
  closeModal("todoModal");
  renderTodos();
  renderDashboard();
  showToastSuccess(`تم حفظ "${title}" ✅`);
}

function toggleTodoDone(id) {
  const t = state.todos.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  saveState();
  renderTodos();
  renderDashboard();
}
function deleteTodo(id) {
  openConfirm(() => {
    state.todos = state.todos.filter((x) => x.id !== id);
    saveState();
    renderTodos();
    renderDashboard();
    showToastSuccess("تم حذف المهمة 🗑️");
  });
}

/* ═══════════════════════════════════════════════
   RENDERING
═══════════════════════════════════════════════ */
function renderDashboard() {
  const today = new Date().toISOString().split("T")[0];
  const todayMeetings = state.meetings.filter((m) => m.date === today);
  const pendingTodos = state.todos.filter((t) => !t.done);
  const doneTodos = state.todos.filter((t) => t.done);
  const total = state.todos.length;
  const pct = total ? Math.round((doneTodos.length / total) * 100) : 0;

  document.getElementById("statMeetings").textContent = todayMeetings.length;
  document.getElementById("statTodos").textContent = pendingTodos.length;
  document.getElementById("statDone").textContent = doneTodos.length;
  document.getElementById("statNotifs").textContent =
    state.notifications.length;
  document.getElementById("progressPct").textContent = pct + "%";
  document.getElementById("progressFill").style.width = pct + "%";

  const now = new Date();
  const upcoming = state.meetings
    .filter((m) => new Date(`${m.date}T${m.time}`) >= now)
    .sort(
      (a, b) =>
        new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`),
    )
    .slice(0, 4);

  const dm = document.getElementById("dashMeetings");
  dm.innerHTML = upcoming.length
    ? `<div class="meeting-list">${upcoming.map((m) => meetingCardHtml(m, true)).join("")}</div>`
    : `<div class="empty"><div class="empty-icon">📅</div><div class="empty-text">لا توجد اجتماعات قادمة</div></div>`;

  const highTodos = pendingTodos
    .filter((t) => t.priority === "high")
    .slice(0, 3);
  const dt = document.getElementById("dashTodos");
  dt.innerHTML = highTodos.length
    ? `<div class="todo-list">${highTodos.map((t) => todoCardHtml(t)).join("")}</div>`
    : `<div class="empty"><div class="empty-icon">🎉</div><div class="empty-text">لا توجد مهام عالية الأولوية</div></div>`;

  updateNotifBadge();
  lucide.createIcons();
}

function renderMeetings() {
  const f = state.meetingFilter || "all";
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  let list = [...state.meetings].sort(
    (a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`),
  );
  if (f === "today") list = list.filter((m) => m.date === today);
  if (f === "upcoming")
    list = list.filter((m) => new Date(`${m.date}T${m.time}`) > now);
  if (f === "past")
    list = list.filter((m) => new Date(`${m.date}T${m.time}`) < now);

  const c = document.getElementById("meetingsList");
  c.innerHTML = list.length
    ? `<div class="meeting-list">${list.map((m) => meetingCardHtml(m, false)).join("")}</div>`
    : `<div class="empty"><div class="empty-icon">📅</div><div class="empty-text">لا توجد اجتماعات</div><button class="btn btn-primary" onclick="openMeetingModal()" style="margin-top:8px;"><i data-lucide="plus" style="width:14px;height:14px;"></i>أضف اجتماعاً</button></div>`;
  lucide.createIcons();
}

function meetingCardHtml(m, compact) {
  const dt = new Date(`${m.date}T${m.time}`);
  const now = new Date();
  const diff = Math.round((dt - now) / 60000);
  const isPast = dt < now;
  const isSoon = !isPast && diff <= 60;
  const status = isPast ? "past" : isSoon ? "soon" : "upcoming";

  let badge = "";
  if (isPast) badge = `<span class="chip chip-muted">انتهى</span>`;
  else if (isSoon)
    badge = `<span class="chip chip-amber chip-blink">⏰ بعد ${diff} دقيقة</span>`;
  else badge = `<span class="chip chip-green">📅 قادم</span>`;

  const dateStr = dt.toLocaleDateString("ar-EG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = dt.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
  <div class="m-card" data-s="${status}">
    <div class="m-accent-bar"></div>
    <div class="m-card-top">
      <div class="m-card-body">
        <div class="m-card-title">${escHtml(m.title)}</div>
        <div class="m-card-meta">
          <span class="meta-pill"><i data-lucide="calendar" style="width:13px;height:13px;"></i>${dateStr}</span>
          <span class="meta-pill"><i data-lucide="clock" style="width:13px;height:13px;"></i>${timeStr}</span>
          ${m.location ? `<span class="meta-pill"><i data-lucide="map-pin" style="width:13px;height:13px;"></i>${escHtml(m.location)}</span>` : ""}
        </div>
        <div class="m-card-badges">
          ${badge}
          ${m.notif ? `<span class="chip chip-accent"><i data-lucide="bell" style="width:11px;height:11px;"></i>تنبيه</span>` : ""}
        </div>
        ${m.desc && !compact ? `<div class="m-card-desc">${escHtml(m.desc)}</div>` : ""}
      </div>
      ${
        !compact
          ? `
      <div class="m-card-actions">
        <button class="btn-icon" data-tip="تعديل" onclick="openMeetingModal('${m.id}')">
          <i data-lucide="pencil" style="width:15px;height:15px;"></i>
        </button>
        <button class="btn-icon" data-tip="حذف" onclick="deleteMeeting('${m.id}')" style="color:#ef4444;">
          <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
        </button>
      </div>`
          : ""
      }
    </div>
  </div>`;
}

function renderTodos() {
  const f = state.todoFilter || "all";
  const pO = { high: 0, medium: 1, low: 2 };
  let list = [...state.todos].sort(
    (a, b) =>
      pO[a.priority] - pO[b.priority] ||
      new Date(b.createdAt) - new Date(a.createdAt),
  );
  if (f === "pending") list = list.filter((t) => !t.done);
  if (f === "done") list = list.filter((t) => t.done);
  if (f === "high") list = list.filter((t) => t.priority === "high");

  const c = document.getElementById("todosList");
  c.innerHTML = list.length
    ? `<div class="todo-list">${list.map((t) => todoCardHtml(t)).join("")}</div>`
    : `<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">لا توجد مهام</div><button class="btn btn-primary" onclick="openTodoModal()" style="margin-top:8px;"><i data-lucide="plus" style="width:14px;height:14px;"></i>أضف مهمة</button></div>`;
  lucide.createIcons();
}

function todoCardHtml(t) {
  const pLabel = { high: "عالية", medium: "متوسطة", low: "منخفضة" };
  const pClass = { high: "p-high", medium: "p-medium", low: "p-low" };
  const pIcon = {
    high: "alert-triangle",
    medium: "minus",
    low: "chevron-down",
  };
  const dueStr = t.due
    ? new Date(t.due + "T00:00").toLocaleDateString("ar-EG", {
        day: "numeric",
        month: "short",
      })
    : "";
  const overdue = t.due && !t.done && new Date(t.due) < new Date();

  return `
  <div class="t-card${t.done ? " done" : ""}" data-p="${t.priority}">
    <div class="check-circle${t.done ? " done" : ""}" onclick="toggleTodoDone('${t.id}')" data-tip="${t.done ? "إلغاء الإنجاز" : "تحديد كمنجز"}">
      ${t.done ? `<i data-lucide="check" style="width:14px;height:14px;color:#fff;"></i>` : ""}
    </div>
    <div class="t-body">
      <div class="t-title">${escHtml(t.title)}</div>
      ${t.desc ? `<div class="t-desc">${escHtml(t.desc)}</div>` : ""}
      <div class="t-meta">
        <span class="chip ${pClass[t.priority]}">
          <i data-lucide="${pIcon[t.priority]}" style="width:11px;height:11px;"></i>${pLabel[t.priority]}
        </span>
        ${
          dueStr
            ? `<span class="chip${overdue ? " chip-red chip-blink" : " chip-muted"}">
          <i data-lucide="calendar" style="width:11px;height:11px;"></i>${dueStr}${overdue ? " ⚠️" : ""}
        </span>`
            : ""
        }
        ${t.notif ? `<span class="chip chip-accent"><i data-lucide="bell" style="width:11px;height:11px;"></i>تنبيه</span>` : ""}
      </div>
    </div>
    <div class="t-actions">
      <button class="btn-icon" data-tip="تعديل" onclick="openTodoModal('${t.id}')">
        <i data-lucide="pencil" style="width:14px;height:14px;"></i>
      </button>
      <button class="btn-icon" data-tip="حذف" onclick="deleteTodo('${t.id}')" style="color:#ef4444;">
        <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
      </button>
    </div>
  </div>`;
}

function renderNotifications() {
  const c = document.getElementById("notifList");
  if (!state.notifications.length) {
    c.innerHTML = `<div class="empty"><div class="empty-icon">🔕</div><div class="empty-text">لا توجد إشعارات حتى الآن</div></div>`;
    return;
  }
  const sorted = [...state.notifications].reverse();
  c.innerHTML = `<div class="notif-list">${sorted
    .map(
      (n) => `
    <div class="n-card">
      <div class="n-emoji">${n.emoji || "🔔"}</div>
      <div class="n-body">
        <div class="n-title">${escHtml(n.title)}</div>
        ${n.body ? `<div class="n-sub">${escHtml(n.body)}</div>` : ""}
        <div class="n-time">${new Date(n.time).toLocaleString("ar-EG")}</div>
      </div>
    </div>`,
    )
    .join("")}</div>`;
}

function updateNotifBadge() {
  const count = state.notifications.length;
  // dots
  ["notifDot", "notifDot2"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = count ? "block" : "none";
  });
  // nav badge
  const nb = document.getElementById("navNotifBadge");
  if (nb) {
    nb.style.display = count ? "inline-flex" : "none";
    nb.textContent = count;
  }
  // dock badge
  const db = document.getElementById("dockNotifBadge");
  if (db) {
    db.style.display = count ? "inline-flex" : "none";
    db.textContent = count;
  }
}

function clearAllNotifs() {
  openConfirm(() => {
    state.notifications = [];
    saveState();
    renderNotifications();
    updateNotifBadge();
    showToastSuccess("تم مسح جميع الإشعارات");
  });
}

/* ═══════════════════════════════════════════════
   FILTERS
═══════════════════════════════════════════════ */
function filterMeetings(f, btn) {
  state.meetingFilter = f;
  document
    .querySelectorAll("#section-meetings .tab-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderMeetings();
}
function filterTodos(f, btn) {
  state.todoFilter = f;
  document
    .querySelectorAll("#section-todos .tab-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderTodos();
}

/* ═══════════════════════════════════════════════
   NOTIFICATION CHECKER
═══════════════════════════════════════════════ */
function checkMeetingNotifications() {
  const now = new Date();
  state.meetings.forEach((m) => {
    if (!m.notif) return;
    const dt = new Date(`${m.date}T${m.time}`);
    const diff = (dt - now) / 60000;
    if (diff > 0 && diff <= 30 && !m.notified30) {
      m.notified30 = true;
      fireNotification(
        "⏰",
        `اجتماعك "${m.title}" بعد 30 دقيقة`,
        `${m.date} الساعة ${m.time}${m.location ? " — " + m.location : ""}`,
      );
    }
    if (diff > 0 && diff <= 5 && !m.notified5) {
      m.notified5 = true;
      fireNotification(
        "🚨",
        `اجتماعك "${m.title}" بعد 5 دقائق فقط!`,
        `${m.date} الساعة ${m.time}${m.location ? " — " + m.location : ""}`,
      );
    }
  });
  saveState();
}

/* ═══════════════════════════════════════════════
   NOTIFICATION FIRE SYSTEM
═══════════════════════════════════════════════ */
function fireNotification(emoji, title, body) {
  state.notifications.push({
    emoji,
    title,
    body,
    time: new Date().toISOString(),
  });
  saveState();
  updateNotifBadge();
  showToast(emoji, title, body);
  openNotifModal(emoji, title, body);
  if (state.browserNotifs && Notification.permission === "granted") {
    new Notification(`${emoji} ${title}`, { body });
  }
  if (state.currentSection === "notifications") renderNotifications();
}

/* ─ Toast (lightweight top banner) ─ */
function showToast(emoji, title, body) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `
    <div class="toast-emoji">${emoji}</div>
    <div class="toast-text">
      <div class="toast-title">${escHtml(title)}</div>
      ${body ? `<div class="toast-sub">${escHtml(body)}</div>` : ""}
    </div>
    <button class="btn-icon" onclick="this.parentElement.remove()" style="flex-shrink:0;">
      <i data-lucide="x" style="width:14px;height:14px;"></i>
    </button>`;
  document.body.appendChild(t);
  lucide.createIcons();
  setTimeout(() => {
    t.classList.add("out");
    setTimeout(() => t.remove(), 280);
  }, 5000);
}
function showToastSuccess(msg) {
  showToast("✅", msg, "");
}
function showToastError(msg) {
  showToast("❌", msg, "");
}

/* ─ Persistent alert modal ─ */
function openNotifModal(emoji, title, body) {
  const m = document.getElementById("notifModal");
  if (!m) return;
  document.getElementById("notifModalEmoji").textContent = emoji || "🔔";
  document.getElementById("notifModalTitle").textContent = title || "تنبيه";
  document.getElementById("notifModalBody").textContent = body || "";
  m.style.display = "flex";
  startNotifAlertSound();
  lucide.createIcons();
}
function closeNotifModal() {
  const m = document.getElementById("notifModal");
  if (m) m.style.display = "none";
  stopNotifAlertSound();
}

/* ═══════════════════════════════════════════════
   AUDIO — UPGRADED (louder, richer, clear tone)
   Uses layered oscillators: sine + triangle + envelope shaping
═══════════════════════════════════════════════ */
function initAudioUnlock() {
  document.addEventListener(
    "pointerdown",
    () => {
      try {
        ensureAudioCtx();
      } catch (e) {}
    },
    { once: true },
  );
}

function ensureAudioCtx() {
  if (!alertAudioCtx)
    alertAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (alertAudioCtx.state === "suspended") alertAudioCtx.resume();
  return alertAudioCtx;
}

/**
 * Plays a rich, clear 3-note chime — significantly louder and more present
 * than the original. Each note uses two oscillators (sine + triangle) mixed
 * through a single gain, giving it body without being harsh.
 * Gain peaks at 0.55 (was 0.12–0.16 in old code).
 */
function playChime(ctx) {
  const t = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.72, t); // master volume (was ~0.16)
  master.connect(ctx.destination);

  const notes = [
    { freq: 880, start: 0, dur: 0.55 }, // A5
    { freq: 1108, start: 0.18, dur: 0.55 }, // C#6
    { freq: 1319, start: 0.36, dur: 0.75 }, // E6
  ];

  notes.forEach((n) => {
    // Primary sine — smooth tone
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.value = n.freq;
    osc1.connect(g1);
    g1.connect(master);
    g1.gain.setValueAtTime(0, t + n.start);
    g1.gain.linearRampToValueAtTime(0.65, t + n.start + 0.03); // fast attack
    g1.gain.exponentialRampToValueAtTime(0.001, t + n.start + n.dur);
    osc1.start(t + n.start);
    osc1.stop(t + n.start + n.dur + 0.05);

    // Harmonics triangle — adds presence/shimmer
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.value = n.freq * 2;
    osc2.connect(g2);
    g2.connect(master);
    g2.gain.setValueAtTime(0, t + n.start);
    g2.gain.linearRampToValueAtTime(0.22, t + n.start + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t + n.start + n.dur * 0.7);
    osc2.start(t + n.start);
    osc2.stop(t + n.start + n.dur);
  });
}

function startNotifAlertSound() {
  stopNotifAlertSound();
  try {
    const ctx = ensureAudioCtx();
    playChime(ctx);
    notifAlertTimer = setInterval(() => {
      try {
        playChime(ensureAudioCtx());
      } catch (e) {}
    }, 2200);
  } catch (e) {}
}

function stopNotifAlertSound() {
  if (notifAlertTimer) {
    clearInterval(notifAlertTimer);
    notifAlertTimer = null;
  }
}

/* ═══════════════════════════════════════════════
   BROWSER NOTIFICATIONS
═══════════════════════════════════════════════ */
function toggleBrowserNotifs() {
  if (!state.browserNotifs) requestNotifPermission();
  else {
    state.browserNotifs = false;
    document.getElementById("browserNotifToggle").classList.remove("on");
    saveState();
  }
}
function requestNotifPermission(silent = false) {
  if (!("Notification" in window)) {
    if (!silent) showToastError("متصفحك لا يدعم الإشعارات");
    return;
  }
  Notification.requestPermission().then((p) => {
    const b = document.getElementById("browserNotifToggle");
    if (p === "granted") {
      state.browserNotifs = true;
      if (b) b.classList.add("on");
      if (!silent) showToastSuccess("تم تفعيل إشعارات المتصفح 🔔");
    } else {
      state.browserNotifs = false;
      if (b) b.classList.remove("on");
      if (!silent) showToastError("تم رفض إذن الإشعارات");
    }
    saveState();
  });
}
function updateBrowserNotifToggle() {
  const b = document.getElementById("browserNotifToggle");
  if (b) b.classList.toggle("on", state.browserNotifs);
}

/* Test notification toggle */
function toggleTestNotifButton() {
  state.showTestNotifButton = !state.showTestNotifButton;
  const btn = document.getElementById("testNotifToggle");
  const row = document.getElementById("testNotifRow");
  if (btn) btn.classList.toggle("on", state.showTestNotifButton);
  if (row) row.style.display = state.showTestNotifButton ? "flex" : "none";
  saveState();
}
function testNotification() {
  fireNotification(
    "🔔",
    "تنبيه تجريبي",
    "هذه تجربة للتنبيهات — المودال والصوت والإشعار.",
  );
}

/* ═══════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════ */
function openSettings() {
  document.getElementById("settingsModal").style.display = "flex";
  document
    .querySelectorAll(".swatch[data-accent]")
    .forEach((s) =>
      s.classList.toggle("active", s.dataset.accent === state.accent),
    );
  updateBrowserNotifToggle();
  updateThemeSettingBtns();
  const tBtn = document.getElementById("testNotifToggle");
  const tRow = document.getElementById("testNotifRow");
  if (tBtn) tBtn.classList.toggle("on", state.showTestNotifButton);
  if (tRow) tRow.style.display = state.showTestNotifButton ? "flex" : "none";
  lucide.createIcons();
}

/* ═══════════════════════════════════════════════
   GUIDE MODAL
═══════════════════════════════════════════════ */
const GUIDE = [
  {
    title: "👋 مرحباً!",
    html: `
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;margin-bottom:12px;">
        <div style="font-size:28px;margin-bottom:8px;">🗓️</div>
        <div style="font-size:15px;font-weight:800;margin-bottom:6px;">مُخطِّطك الذكي</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">
          يساعدك على تنظيم اجتماعاتك ومهامك في مكان واحد سريع وأنيق.
          كل بياناتك محفوظة <strong>على جهازك</strong> فقط — لا ترفع لأي سيرفر.
        </p>
      </div>
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;">🗺️ التنقل</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">
          على <strong>سطح المكتب</strong>: الشريط الجانبي على اليمين.
          على <strong>الجوال</strong>: الشريط الأسفل. كلاهما للتنقل بين الأقسام.
        </p>
      </div>`,
  },
  {
    title: "📅 الاجتماعات",
    html: `
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;">➕ إضافة اجتماع</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">اضغط <strong>"اجتماع جديد"</strong> وأدخل العنوان والتاريخ والوقت. يمكنك إضافة الوصف والمكان أو رابط الاجتماع.</p>
      </div>
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;">✏️ تعديل أو حذف</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">حرّك مؤشرك فوق البطاقة — ستظهر أيقونتا <strong>القلم والسلة</strong> على اليسار.</p>
      </div>
      <div style="background:var(--a-muted);border:1px solid var(--a);border-radius:14px;padding:16px 18px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;color:var(--a);">🔍 البحث والتصفية</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">استخدم الأزرار: الكل / اليوم / القادمة / المنتهية لتصفية الاجتماعات حسب الحالة.</p>
      </div>`,
  },
  {
    title: "✅ المهام",
    html: `
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;">➕ إضافة مهمة</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">أضف المهمة مع <strong>العنوان والأولوية وتاريخ الاستحقاق</strong>. فعّل إشعار الاستحقاق لتذكير آلي.</p>
      </div>
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;">✔️ إنجاز المهمة</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">اضغط <strong>الدائرة</strong> بجانب المهمة لتحديدها منجزة. اضغط مرة أخرى لإلغاء الإنجاز.</p>
      </div>
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;">🔴 الأولوية</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">المهام العالية الأولوية تظهر أولاً وفي لوحة التحكم مباشرة. الخط الجانبي الأيمن يشير للأولوية بالألوان.</p>
      </div>`,
  },
  {
    title: "🔔 الإشعارات",
    html: `
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;">⏰ تنبيهات الاجتماعات</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">عند تفعيل الإشعارات، ستصلك تنبيهات داخلية مع <strong>صوت واضح ومرتفع</strong> قبل <strong>30 دقيقة و5 دقائق</strong> من بدء الاجتماع.</p>
      </div>
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;">📱 إشعارات المتصفح</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">من <strong>الإعدادات</strong>، فعّل Push Notifications لتلقّي التنبيهات حتى لو كنت في تاب آخر.</p>
      </div>
      <div style="background:var(--a-muted);border:1px solid var(--a);border-radius:14px;padding:16px 18px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;color:var(--a);">🔇 إيقاف الصوت</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">في نافذة التنبيه ستجد زر <strong>إيقاف الصوت</strong> في الزاوية العليا لإيقاف الصوت دون إغلاق التنبيه.</p>
      </div>`,
  },
  {
    title: "🎨 التخصيص",
    html: `
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;">🌓 وضع العرض</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">اختر بين <strong>الفاتح / الداكن / التلقائي</strong>. التلقائي يتبع إعدادات جهازك تلقائياً.</p>
      </div>
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:16px 18px;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;">🎨 لون التمييز</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">6 ألوان للاختيار: Indigo، Emerald، Rose، Amber، Sky، Violet — اللون يطبّق على كل عناصر التطبيق.</p>
      </div>
      <div style="background:var(--a-muted);border:1px solid var(--a);border-radius:14px;padding:16px 18px;">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px;color:var(--a);">🚀 نصيحة ذهبية</div>
        <p style="font-size:13px;color:var(--txt2);line-height:1.7;">ابدأ يومك بمراجعة <strong>لوحة التحكم</strong> — ستجد ملخصاً لاجتماعاتك ومهامك العالية الأولوية دفعة واحدة!</p>
      </div>`,
  },
];

function openGuide() {
  currentGuideTab = 0;
  renderGuide();
  document.getElementById("guideModal").style.display = "flex";
  lucide.createIcons();
}
function renderGuide() {
  const page = GUIDE[currentGuideTab];
  document.getElementById("guideContent").innerHTML = page.html;
  // dots
  document.getElementById("guideDots").innerHTML = GUIDE.map(
    (_, i) => `
    <div onclick="switchGuideTab(${i})" style="
      width:8px;height:8px;border-radius:50%;cursor:pointer;
      background:${i === currentGuideTab ? "var(--a)" : "var(--bd)"};transition:all .2s;
    "></div>`,
  ).join("");
  // tab highlights
  GUIDE.forEach((_, i) => {
    const b = document.getElementById(`gtab-${i}`);
    if (b) b.classList.toggle("active", i === currentGuideTab);
  });
  // prev/next
  document.getElementById("guidePrev").style.visibility =
    currentGuideTab === 0 ? "hidden" : "visible";
  const nxt = document.getElementById("guideNext");
  if (currentGuideTab === GUIDE.length - 1) {
    nxt.innerHTML = `<i data-lucide="check" style="width:15px;height:15px;"></i>فهمت!`;
    nxt.onclick = () => closeModal("guideModal");
  } else {
    nxt.innerHTML = `التالي<i data-lucide="chevron-left" style="width:15px;height:15px;"></i>`;
    nxt.onclick = () => guideNav(1);
  }
  lucide.createIcons();
}
function switchGuideTab(i) {
  currentGuideTab = i;
  renderGuide();
}
function guideNav(dir) {
  currentGuideTab = Math.min(
    Math.max(0, currentGuideTab + dir),
    GUIDE.length - 1,
  );
  renderGuide();
}

/* ═══════════════════════════════════════════════
   CONFIRM
═══════════════════════════════════════════════ */
function openConfirm(cb) {
  deleteCallback = cb;
  document.getElementById("confirmModal").style.display = "flex";
  lucide.createIcons();
}
document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
  closeModal("confirmModal");
  if (deleteCallback) {
    deleteCallback();
    deleteCallback = null;
  }
});

/* ═══════════════════════════════════════════════
   MODAL HELPERS
═══════════════════════════════════════════════ */
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}
function closeOnOverlay(e, id) {
  if (e.target.id === id) closeModal(id);
}

/* ═══════════════════════════════════════════════
   RESET
═══════════════════════════════════════════════ */
function resetApp() {
  if (!confirm("هل أنت متأكد؟ سيتم حذف جميع البيانات نهائياً.")) return;
  localStorage.removeItem("planify_v3");
  location.reload();
}

/* ═══════════════════════════════════════════════
   TOOLTIPS — smart JS-driven (no overflow issue)
═══════════════════════════════════════════════ */
function initTooltips() {
  const tip = document.getElementById("tooltip");
  let active = null;

  function position(el) {
    const r = el.getBoundingClientRect();
    tip.style.visibility = "hidden";
    tip.style.display = "block";
    const tw = tip.offsetWidth;
    const pad = 8;

    let left = r.left + r.width / 2;
    left = Math.min(
      Math.max(left, pad + tw / 2),
      window.innerWidth - pad - tw / 2,
    );

    // Try above first, fallback to below
    const above = r.top - tip.offsetHeight - 10;
    if (above >= pad) {
      tip.style.top = above + "px";
      tip.className = "tooltip-bubble tip-top";
    } else {
      tip.style.top = r.bottom + 10 + "px";
      tip.className = "tooltip-bubble tip-bottom";
    }
    tip.style.left = left + "px";
    tip.style.visibility = "visible";
  }

  function show(el) {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    active = el;
    tip.textContent = text;
    position(el);
    requestAnimationFrame(() => tip.classList.add("show"));
  }
  function hide() {
    active = null;
    tip.classList.remove("show");
  }

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el) show(el);
  });
  document.addEventListener("mouseout", (e) => {
    if (active && !active.contains(e.relatedTarget)) hide();
  });
  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
}

/* ═══════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════ */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function escHtml(s) {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Set current year in footer
const copyrightYear = new Date().getFullYear();
document.getElementById("current-year").textContent = copyrightYear;

/* Auto-detect system theme changes */
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (state.theme === "auto") {
      applyTheme("auto");
      updateThemeBtn();
    }
  });

/* ─ Init ─ */
boot();
