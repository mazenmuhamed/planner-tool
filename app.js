/* =========================================================
       PLANIFY — Main Application Script
       Modern Meeting & Todo Manager
      ========================================================= */

// ---- State ----
let state = {
  user: "",
  theme: "auto", // 'light' | 'dark' | 'auto'
  accent: "indigo",
  meetings: [], // Array of meeting objects
  todos: [], // Array of todo objects
  notifications: [], // Notification log
  browserNotifs: false,
  showTestNotifButton: false,
  currentSection: "dashboard",
  meetingFilter: "all",
  todoFilter: "all",
};

let deleteCallback = null; // Holds the function to call on confirm delete
let notifAlertTimer = null;
let notifAlertActive = false;
let alertAudioCtx = null;

// ---- Persistence ----
function saveState() {
  localStorage.setItem("planify_state", JSON.stringify(state));
}
function loadState() {
  const raw = localStorage.getItem("planify_state");
  if (raw) {
    try {
      state = { ...state, ...JSON.parse(raw) };
    } catch (e) {}
  }
}

// ---- Onboarding ----
function submitName() {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) {
    shakeInput("nameInput");
    return;
  }
  state.user = name;
  saveState();
  startApp();
}

// Allow Enter key on name input
document.getElementById("nameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitName();
});

function shakeInput(id) {
  const el = document.getElementById(id);
  el.style.animation = "none";
  el.style.borderColor = "#ef4444";
  el.style.boxShadow = "0 0 0 3px #fee2e2";
  setTimeout(() => {
    el.style.borderColor = "";
    el.style.boxShadow = "";
  }, 1000);
}

// ---- Boot ----
function boot() {
  loadState();
  applyTheme(state.theme);
  applyAccent(state.accent);
  initTooltips();
  initAudioUnlock();

  if (state.user) {
    startApp();
  } else {
    document.getElementById("onboarding").style.display = "flex";
    lucide.createIcons();
  }
}

function startApp() {
  // Hide onboarding, show app
  document.getElementById("onboarding").style.display = "none";
  document.getElementById("app").classList.add("visible");

  // Set greeting
  const heroName = document.getElementById("heroName");
  if (heroName) heroName.textContent = state.user;
  updateDashGreeting();

  // Re-init icons
  lucide.createIcons();

  // Apply theme/accent UI
  applyTheme(state.theme);
  applyAccent(state.accent);
  updateThemeBtn();
  updateBrowserNotifToggle();

  // Render initial section
  showSection("dashboard");

  // Start clock
  setInterval(updateClock, 1000);
  updateClock();

  // Start notification checker (every 30 seconds)
  setInterval(checkMeetingNotifications, 30000);
  checkMeetingNotifications();

  // Request browser notification permission if previously granted
  if (state.browserNotifs) requestNotifPermission();
}

// ---- Theme ----
function applyTheme(mode) {
  const html = document.documentElement;
  state.theme = mode;
  if (mode === "auto") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    html.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    html.setAttribute("data-theme", mode);
  }
  saveState();
}

function toggleTheme() {
  // Cycle: light → dark → light
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  state.theme = next;
  applyTheme(next);
  updateThemeBtn();
}

function setTheme(mode) {
  state.theme = mode;
  applyTheme(mode);
  updateThemeBtn();
  closeModal("settingsModal");
}

function updateThemeBtn() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const btn = document.getElementById("themeBtn");
  if (btn)
    btn.innerHTML = isDark
      ? '<i data-lucide="sun" style="width:20px;height:20px;"></i>'
      : '<i data-lucide="moon" style="width:20px;height:20px;"></i>';
  lucide.createIcons();
}

// ---- Accent ----
function applyAccent(name) {
  state.accent = name;
  document.documentElement.setAttribute("data-accent", name);
  saveState();
}
function setAccent(name, el) {
  applyAccent(name);
  document
    .querySelectorAll(".swatch")
    .forEach((s) => s.classList.remove("active"));
  el.classList.add("active");
}

// ---- Clock / Greeting ----
function updateClock() {
  const now = new Date();
  const el = document.getElementById("currentDateTime");
  if (el)
    el.textContent = now.toLocaleDateString("ar-EG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
}

function updateDashGreeting() {
  const h = new Date().getHours();
  let greet =
    h < 12 ? `صباح الخير ☀️` : h < 17 ? `مساء النور 🌤️` : `مساء الخير 🌙`;
  const el = document.getElementById("dashGreet");
  if (el) el.textContent = `${greet}، ${state.user}`;
}

// ---- Section Navigation ----
function showSection(name) {
  state.currentSection = name;
  // Hide all sections
  document
    .querySelectorAll('[id^="section-"]')
    .forEach((s) => (s.style.display = "none"));
  document
    .querySelectorAll(".sidebar-item, .dock-item")
    .forEach((b) => b.classList.remove("active"));

  document.getElementById(`section-${name}`).style.display = "block";
  const navBtn = document.getElementById(`dock-${name}`);
  if (navBtn) navBtn.classList.add("active");

  // Render the section content
  if (name === "dashboard") renderDashboard();
  if (name === "meetings") renderMeetings();
  if (name === "todos") renderTodos();
  if (name === "notifications") renderNotifications();
}

// ---- MEETINGS CRUD ----

function openMeetingModal(id = null) {
  document.getElementById("editingMeetingId").value = id || "";
  document.getElementById("meetingModalTitle").textContent = id
    ? "تعديل الاجتماع"
    : "اجتماع جديد";

  if (id) {
    // Populate for edit
    const m = state.meetings.find((x) => x.id === id);
    if (!m) return;
    document.getElementById("meetTitle").value = m.title;
    document.getElementById("meetDesc").value = m.desc || "";
    document.getElementById("meetDate").value = m.date;
    document.getElementById("meetTime").value = m.time;
    document.getElementById("meetLocation").value = m.location || "";
    const toggle = document.getElementById("meetNotifToggle");
    toggle.classList.toggle("on", m.notif !== false);
  } else {
    // Default: today's date, nearest half hour
    document.getElementById("meetTitle").value = "";
    document.getElementById("meetDesc").value = "";
    document.getElementById("meetDate").value = new Date()
      .toISOString()
      .split("T")[0];
    document.getElementById("meetTime").value = "";
    document.getElementById("meetLocation").value = "";
    document.getElementById("meetNotifToggle").classList.add("on");
  }

  document.getElementById("meetingModal").style.display = "flex";
  lucide.createIcons();
  setTimeout(() => document.getElementById("meetTitle").focus(), 100);
}

function saveMeeting() {
  const title = document.getElementById("meetTitle").value.trim();
  const date = document.getElementById("meetDate").value;
  const time = document.getElementById("meetTime").value;
  if (!title || !date || !time) {
    showToastError("يرجى ملء الحقول المطلوبة (العنوان، التاريخ، الوقت)");
    return;
  }

  const id = document.getElementById("editingMeetingId").value || generateId();
  const notif = document
    .getElementById("meetNotifToggle")
    .classList.contains("on");

  const meeting = {
    id,
    title,
    date,
    time,
    desc: document.getElementById("meetDesc").value.trim(),
    location: document.getElementById("meetLocation").value.trim(),
    notif,
    createdAt: new Date().toISOString(),
    notified30: false,
    notified5: false,
  };

  const existing = state.meetings.findIndex((m) => m.id === id);
  if (existing >= 0) {
    // Preserve notified state on edit
    meeting.notified30 = state.meetings[existing].notified30;
    meeting.notified5 = state.meetings[existing].notified5;
    state.meetings[existing] = meeting;
  } else {
    state.meetings.push(meeting);
  }

  saveState();
  closeModal("meetingModal");
  renderMeetings();
  renderDashboard();
  showToastSuccess(`تم حفظ الاجتماع "${title}" ✅`);
}

function deleteMeeting(id) {
  const m = state.meetings.find((x) => x.id === id);
  openConfirm(() => {
    state.meetings = state.meetings.filter((x) => x.id !== id);
    saveState();
    renderMeetings();
    renderDashboard();
    showToastSuccess("تم حذف الاجتماع 🗑️");
  });
}

// ---- TODOS CRUD ----

function openTodoModal(id = null) {
  document.getElementById("editingTodoId").value = id || "";
  document.getElementById("todoModalTitle").textContent = id
    ? "تعديل المهمة"
    : "مهمة جديدة";

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
    document.getElementById("todoTitle").value = "";
    document.getElementById("todoDesc").value = "";
    document.getElementById("todoPriority").value = "medium";
    document.getElementById("todoDue").value = "";
    document.getElementById("todoNotifToggle").classList.remove("on");
  }

  document.getElementById("todoModal").style.display = "flex";
  lucide.createIcons();
  setTimeout(() => document.getElementById("todoTitle").focus(), 100);
}

function saveTodo() {
  const title = document.getElementById("todoTitle").value.trim();
  if (!title) {
    shakeInput("todoTitle");
    return;
  }

  const id = document.getElementById("editingTodoId").value || generateId();
  const notif = document
    .getElementById("todoNotifToggle")
    .classList.contains("on");

  const todo = {
    id,
    title,
    desc: document.getElementById("todoDesc").value.trim(),
    priority: document.getElementById("todoPriority").value,
    due: document.getElementById("todoDue").value,
    notif,
    done: false,
    createdAt: new Date().toISOString(),
  };

  const existing = state.todos.findIndex((t) => t.id === id);
  if (existing >= 0) {
    todo.done = state.todos[existing].done; // Preserve done state
    state.todos[existing] = todo;
  } else {
    state.todos.push(todo);
  }

  saveState();
  closeModal("todoModal");
  renderTodos();
  renderDashboard();
  showToastSuccess(`تم حفظ المهمة "${title}" ✅`);
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

// ---- RENDERING ----

function renderDashboard() {
  updateDashGreeting();
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

  // Upcoming meetings (next 5, sorted by datetime)
  const now = new Date();
  const upcoming = state.meetings
    .filter((m) => new Date(`${m.date}T${m.time}`) >= now)
    .sort(
      (a, b) =>
        new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`),
    )
    .slice(0, 5);

  const container = document.getElementById("dashMeetings");
  if (!upcoming.length) {
    container.innerHTML = `<div class="empty-state"><div style="font-size:48px;">📅</div><div>لا توجد اجتماعات قادمة</div></div>`;
  } else {
    container.innerHTML = upcoming
      .map((m) => meetingCardHtml(m, true))
      .join("");
  }

  // Notification badge
  updateNotifBadge();
  lucide.createIcons();
}

function renderMeetings() {
  const filter = state.meetingFilter || "all";
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  let meetings = [...state.meetings].sort(
    (a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`),
  );

  if (filter === "today") meetings = meetings.filter((m) => m.date === today);
  if (filter === "upcoming")
    meetings = meetings.filter((m) => new Date(`${m.date}T${m.time}`) > now);
  if (filter === "past")
    meetings = meetings.filter((m) => new Date(`${m.date}T${m.time}`) < now);

  const container = document.getElementById("meetingsList");
  if (!meetings.length) {
    container.innerHTML = `<div class="empty-state"><div style="font-size:48px;">📅</div><div>لا توجد اجتماعات</div><button class="btn-primary" onclick="openMeetingModal()" style="margin-top:8px;"><i data-lucide="plus" style="width:15px;height:15px;"></i> أضف اجتماعاً</button></div>`;
  } else {
    container.innerHTML = `<div style="display:flex; flex-direction:column; gap:12px;">${meetings.map((m) => meetingCardHtml(m, false)).join("")}</div>`;
  }
  lucide.createIcons();
}

function meetingCardHtml(m, compact = false) {
  const dt = new Date(`${m.date}T${m.time}`);
  const now = new Date();
  const diffMin = Math.round((dt - now) / 60000);
  const isPast = dt < now;
  const isSoon = !isPast && diffMin <= 60;

  let statusBadge = "";
  if (isPast) {
    statusBadge =
      '<span class="status-badge past"><i data-lucide="check-circle" style="width:12px;height:12px;"></i> انتهى</span>';
  } else if (isSoon) {
    statusBadge = `<span class="status-badge urgent"><i data-lucide="clock" style="width:12px;height:12px;"></i> قريباً (${diffMin} د)</span>`;
  } else {
    statusBadge =
      '<span class="status-badge upcoming"><i data-lucide="calendar" style="width:12px;height:12px;"></i> قادم</span>';
  }

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
  <div class="meeting-card${isPast ? " past" : ""}${isSoon ? " soon" : ""}" data-status="${isPast ? "past" : isSoon ? "soon" : "upcoming"}">
    <div class="meeting-glow"></div>
    <div class="meeting-content">
      <div class="meeting-header">
        <div class="meeting-main">
          <div class="meeting-title-row">
            <h3 class="meeting-title">${escHtml(m.title)}</h3>
            ${statusBadge}
            ${m.notif ? '<span class="notif-badge"><i data-lucide="bell" style="width:12px;height:12px;"></i> تنبيه</span>' : ""}
          </div>
          <div class="meeting-meta">
            <span class="meta-item">
              <i data-lucide="calendar" style="width:14px;height:14px;"></i>
              ${dateStr}
            </span>
            <span class="meta-item">
              <i data-lucide="clock" style="width:14px;height:14px;"></i>
              ${timeStr}
            </span>
            ${m.location ? `<span class="meta-item"><i data-lucide="map-pin" style="width:14px;height:14px;"></i> ${escHtml(m.location)}</span>` : ""}
          </div>
          ${m.desc && !compact ? `<p class="meeting-desc">${escHtml(m.desc)}</p>` : ""}
        </div>
        ${
          !compact
            ? `
        <div class="meeting-actions">
          <button class="btn-icon" data-tip="تعديل" onclick="openMeetingModal('${m.id}')">
            <i data-lucide="pencil" style="width:16px;height:16px;"></i>
          </button>
          <button class="btn-icon" data-tip="حذف" onclick="deleteMeeting('${m.id}')" style="color:#ef4444;">
            <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
          </button>
        </div>`
            : ""
        }
      </div>
    </div>
  </div>`;
}

function renderTodos() {
  const filter = state.todoFilter || "all";
  let todos = [...state.todos].sort((a, b) => {
    // High priority first, then by creation
    const pOrder = { high: 0, medium: 1, low: 2 };
    return (
      pOrder[a.priority] - pOrder[b.priority] ||
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  });

  if (filter === "pending") todos = todos.filter((t) => !t.done);
  if (filter === "done") todos = todos.filter((t) => t.done);
  if (filter === "high") todos = todos.filter((t) => t.priority === "high");

  const container = document.getElementById("todosList");
  if (!todos.length) {
    container.innerHTML = `<div class="empty-state"><div style="font-size:48px;">✅</div><div>لا توجد مهام</div><button class="btn-primary" onclick="openTodoModal()" style="margin-top:8px;"><i data-lucide="plus" style="width:15px;height:15px;"></i> أضف مهمة</button></div>`;
  } else {
    container.innerHTML = `<div style="display:flex; flex-direction:column; gap:10px;">${todos.map((t) => todoItemHtml(t)).join("")}</div>`;
  }
  lucide.createIcons();
}

function todoItemHtml(t) {
  const pLabel = { high: "عالية", medium: "متوسطة", low: "منخفضة" };
  const pClass = {
    high: "priority-high",
    medium: "priority-medium",
    low: "priority-low",
  };
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
  const isOverdue = t.due && !t.done && new Date(t.due) < new Date();

  return `
  <div class="todo-card${t.done ? " completed" : ""}" data-priority="${t.priority}">
    <div class="todo-glow"></div>
    <div class="todo-content">
      <div class="todo-header">
        <div class="todo-check-wrapper">
          <div class="custom-check${t.done ? " checked" : ""}" onclick="toggleTodoDone('${t.id}')" data-tip="${t.done ? "إلغاء الإنجاز" : "تحديد كمنجز"}">
            ${t.done ? `<i data-lucide="check" style="width:14px;height:14px;color:#fff;"></i>` : ""}
          </div>
        </div>
        <div class="todo-main">
          <div class="todo-title">${escHtml(t.title)}</div>
          ${t.desc ? `<div class="todo-desc">${escHtml(t.desc)}</div>` : ""}
        </div>
        <div class="todo-actions">
          <button class="btn-icon" data-tip="تعديل" onclick="openTodoModal('${t.id}')">
            <i data-lucide="pencil" style="width:16px;height:16px;"></i>
          </button>
          <button class="btn-icon" data-tip="حذف" onclick="deleteTodo('${t.id}')" style="color:#ef4444;">
            <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
          </button>
        </div>
      </div>
      <div class="todo-footer">
        <div class="todo-badges">
          <span class="priority-badge ${pClass[t.priority]}">
            <i data-lucide="${pIcon[t.priority]}" style="width:12px;height:12px;"></i>
            ${pLabel[t.priority]}
          </span>
          ${
            dueStr
              ? `<span class="due-badge${isOverdue ? " overdue" : ""}">
            <i data-lucide="calendar" style="width:12px;height:12px;"></i>
            ${dueStr}${isOverdue ? " متأخر" : ""}
          </span>`
              : ""
          }
          ${t.notif ? '<span class="notif-badge"><i data-lucide="bell" style="width:12px;height:12px;"></i> تنبيه</span>' : ""}
        </div>
      </div>
    </div>
  </div>`;
}

function renderNotifications() {
  const container = document.getElementById("notifList");
  if (!state.notifications.length) {
    container.innerHTML = `<div class="empty-state"><div style="font-size:48px;">🔕</div><div>لا توجد إشعارات حتى الآن</div></div>`;
  } else {
    const sorted = [...state.notifications].reverse();
    container.innerHTML = `<div style="display:flex; flex-direction:column; gap:8px;">${sorted
      .map(
        (n) => `
      <div class="notif-item">
        <div style="font-size:22px;">${n.emoji || "🔔"}</div>
        <div style="flex:1;">
          <div style="font-size:14px; font-weight:700; margin-bottom:2px;">${escHtml(n.title)}</div>
          <div style="font-size:12px; color:var(--text-muted);">${escHtml(n.body)}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${new Date(n.time).toLocaleString("ar-EG")}</div>
        </div>
      </div>`,
      )
      .join("")}</div>`;
  }
}

function updateNotifBadge() {
  const count = state.notifications.length;
  document.getElementById("notifBadge").style.display = count
    ? "block"
    : "none";
  const nc = document.getElementById("notifCount");
  nc.style.display = count ? "inline-flex" : "none";
  nc.textContent = count;
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

// ---- Filters ----
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

// ---- Meeting Notification Checker ----
function checkMeetingNotifications() {
  const now = new Date();
  state.meetings.forEach((m) => {
    if (!m.notif) return;
    const dt = new Date(`${m.date}T${m.time}`);
    const diffMin = (dt - now) / 60000;

    // 30-minute warning
    if (diffMin > 0 && diffMin <= 30 && !m.notified30) {
      m.notified30 = true;
      const msg = `الاجتماع "${m.title}" بعد 30 دقيقة`;
      const detail = `${m.date} الساعة ${m.time}${m.location ? " — " + m.location : ""}`;
      fireNotification("⏰", msg, detail);
    }

    // 5-minute warning
    if (diffMin > 0 && diffMin <= 5 && !m.notified5) {
      m.notified5 = true;
      const msg = `الاجتماع "${m.title}" بعد 5 دقائق فقط!`;
      const detail = `${m.date} الساعة ${m.time}${m.location ? " — " + m.location : ""}`;
      fireNotification("🚨", msg, detail);
    }
  });
  saveState();
}

// ---- Fire Notification (in-app + browser) ----
function fireNotification(emoji, title, body) {
  // 1. Add to notification log
  state.notifications.push({
    emoji,
    title,
    body,
    time: new Date().toISOString(),
  });
  saveState();
  updateNotifBadge();

  // 2. Show in-app toast
  showNotifToast(emoji, title, body);

  // 3. Show persistent alert + looping sound
  openNotifModal(emoji, title, body);

  // 4. Browser notification
  if (state.browserNotifs && Notification.permission === "granted") {
    new Notification(`${emoji} ${title}`, { body, icon: "🗓️" });
  }

  // 5. Re-render notifications if on that section
  if (state.currentSection === "notifications") renderNotifications();
}

// ---- In-App Toast ----
function showNotifToast(emoji, title, body) {
  const toast = document.createElement("div");
  toast.className = "notif-toast";
  toast.innerHTML = `
    <div style="font-size:18px;">${emoji}</div>
    <div style="flex:1;">
      <div style="font-size:14px; font-weight:800;">${escHtml(title)}</div>
      <div style="font-size:12px; color:var(--text-muted);">${escHtml(body)}</div>
    </div>
    <button class="btn-icon" onclick="this.parentElement.remove()">
      <i data-lucide="x" style="width:14px;height:14px;"></i>
    </button>`;
  document.body.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => {
    toast.classList.add("out");
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}

function showToastSuccess(msg) {
  showNotifToast("✅", msg, "");
}
function showToastError(msg) {
  showNotifToast("❌", msg, "");
}

// ---- Sound (Web Audio API) ----
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(
        0.12,
        ctx.currentTime + i * 0.15 + 0.05,
      );
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.15 + 0.3);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.35);
    });
  } catch (e) {}
}

function initAudioUnlock() {
  const handler = () => {
    try {
      ensureAlertAudioContext();
    } catch (e) {}
  };
  document.addEventListener("pointerdown", handler, { once: true });
}

function ensureAlertAudioContext() {
  if (!alertAudioCtx) {
    alertAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (alertAudioCtx.state === "suspended") {
    alertAudioCtx.resume();
  }
}

function playAlertTone() {
  try {
    ensureAlertAudioContext();
    const ctx = alertAudioCtx;
    const base = ctx.currentTime;
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0, base + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.16, base + i * 0.18 + 0.04);
      gain.gain.linearRampToValueAtTime(0, base + i * 0.18 + 0.25);
      osc.start(base + i * 0.18);
      osc.stop(base + i * 0.18 + 0.28);
    });
  } catch (e) {}
}

function startNotifAlertSound() {
  stopNotifAlertSound();
  playAlertTone();
  notifAlertTimer = setInterval(playAlertTone, 1800);
}

function stopNotifAlertSound() {
  if (notifAlertTimer) {
    clearInterval(notifAlertTimer);
    notifAlertTimer = null;
  }
}

function openNotifModal(emoji, title, body) {
  const modal = document.getElementById("notifModal");
  if (!modal) return;
  const em = document.getElementById("notifModalEmoji");
  const tt = document.getElementById("notifModalTitle");
  const bb = document.getElementById("notifModalBody");
  if (em) em.textContent = emoji || "🔔";
  if (tt) tt.textContent = title || "تنبيه";
  if (bb) bb.textContent = body || "";
  modal.style.display = "flex";
  notifAlertActive = true;
  startNotifAlertSound();
  lucide.createIcons();
}

function closeNotifModal() {
  const modal = document.getElementById("notifModal");
  if (!modal) return;
  modal.style.display = "none";
  notifAlertActive = false;
  stopNotifAlertSound();
}

// ---- Browser Notifications ----
function toggleBrowserNotifs() {
  const btn = document.getElementById("browserNotifToggle");
  if (!state.browserNotifs) {
    requestNotifPermission();
  } else {
    state.browserNotifs = false;
    btn.classList.remove("on");
    saveState();
  }
}

function requestNotifPermission() {
  if (!("Notification" in window)) {
    showToastError("متصفحك لا يدعم الإشعارات");
    return;
  }
  Notification.requestPermission().then((perm) => {
    const btn = document.getElementById("browserNotifToggle");
    if (perm === "granted") {
      state.browserNotifs = true;
      btn && btn.classList.add("on");
      showToastSuccess("تم تفعيل إشعارات المتصفح 🔔");
    } else {
      state.browserNotifs = false;
      btn && btn.classList.remove("on");
      showToastError("تم رفض إشعارات المتصفح");
    }
    saveState();
  });
}

function updateBrowserNotifToggle() {
  const btn = document.getElementById("browserNotifToggle");
  if (btn) btn.classList.toggle("on", state.browserNotifs);
}

function toggleTestNotifButton() {
  state.showTestNotifButton = !state.showTestNotifButton;
  updateTestNotifToggle();
  saveState();
}

function updateTestNotifToggle() {
  const btn = document.getElementById("testNotifToggle");
  const row = document.getElementById("testNotifRow");
  if (btn) btn.classList.toggle("on", state.showTestNotifButton);
  if (row) row.style.display = state.showTestNotifButton ? "flex" : "none";
}

function testNotification() {
  fireNotification(
    "🔔",
    "تنبيه تجريبي",
    "هذه تجربة للتنبيهات (المودال + الصوت).",
  );
}

// ---- Settings Modal ----
function openSettings() {
  document.getElementById("settingsModal").style.display = "flex";
  // Highlight active accent swatch
  document.querySelectorAll(".swatch").forEach((s) => {
    s.classList.toggle("active", s.dataset.accent === state.accent);
  });
  updateBrowserNotifToggle();
  updateTestNotifToggle();
  lucide.createIcons();
}

// ---- Confirm Delete ----
function openConfirm(callback) {
  deleteCallback = callback;
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

// ---- Modal helpers ----
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}
function closeOnOverlay(event, id) {
  if (event.target.id === id) closeModal(id);
}

// ---- Reset App ----
function resetApp() {
  if (!confirm("هل أنت متأكد؟ سيتم حذف جميع البيانات.")) return;
  localStorage.removeItem("planify_state");
  location.reload();
}

// ---- Utility ----
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function escHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- Tooltips ----
function initTooltips() {
  if (document.querySelector(".tooltip-bubble")) return;

  const tip = document.createElement("div");
  tip.className = "tooltip-bubble";
  tip.setAttribute("data-side", "top");
  tip.setAttribute("data-show", "false");
  document.body.appendChild(tip);

  let activeEl = null;

  function positionTooltip(target) {
    const rect = target.getBoundingClientRect();
    const padding = 8;

    tip.style.visibility = "hidden";
    tip.style.display = "block";

    const tipRect = tip.getBoundingClientRect();

    let side = "top";
    let top = rect.top - tipRect.height - 10;
    if (top < padding) {
      side = "bottom";
      top = rect.bottom + 10;
    }

    let left = rect.left + rect.width / 2;
    const minLeft = padding + tipRect.width / 2;
    const maxLeft = window.innerWidth - padding - tipRect.width / 2;
    left = Math.min(Math.max(left, minLeft), maxLeft);

    tip.style.left = left + "px";
    tip.style.top = top + "px";
    tip.setAttribute("data-side", side);
    tip.style.visibility = "visible";
  }

  function show(target) {
    const text = target.getAttribute("data-tip");
    if (!text) return;
    activeEl = target;
    tip.textContent = text;
    tip.setAttribute("data-show", "true");
    positionTooltip(target);
  }

  function hide() {
    activeEl = null;
    tip.setAttribute("data-show", "false");
  }

  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest("[data-tip]");
    if (target) show(target);
  });

  document.addEventListener("mouseout", (e) => {
    if (!activeEl) return;
    const related = e.relatedTarget;
    if (related && activeEl.contains(related)) return;
    hide();
  });

  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
}

// ---- Auto theme watcher ----
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (state.theme === "auto") applyTheme("auto");
    updateThemeBtn();
  });

// ---- Init ----
boot();
