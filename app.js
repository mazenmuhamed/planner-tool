/**
 * Planify - Smart Meeting & Task Planner
 * A clean, offline-first productivity application
 */

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

const CONFIG = {
  STORAGE_KEY: 'planify_v3',
  NOTIFICATION_INTERVAL: 30000,
  CLOCK_INTERVAL: 1000,
  TIPS: [
    'فعّل الإشعارات لتلقّي تنبيه قبل اجتماعك بـ30 دقيقة!',
    'أضف وصفاً لاجتماعاتك لتسهيل المراجعة لاحقاً.',
    'رتّب مهامك حسب الأولوية لتُنجز الأهم أولاً.',
    'استخدم فلتر "اليوم" لرؤية اجتماعات اليوم فقط.',
    'يمكنك تعديل أي اجتماع أو مهمة بالضغط على أيقونة القلم.',
  ],
  EMOJIS: ['✨', '🎉', '🌟', '💫', '🚀', '⚡', '🔥'],
  GREETINGS: [
    { hour: 12, text: 'صباح الخير ☀️' },
    { hour: 17, text: 'مساء النور 🌤️' },
    { hour: 24, text: 'مساء الخير 🌙' },
  ],
  GUIDE_TABS: [
    // Guide content defined below
  ],
  PRIORITY: {
    LABELS: { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' },
    CLASSES: { high: 'p-high', medium: 'p-medium', low: 'p-low' },
    ICONS: { high: 'alert-triangle', medium: 'minus', low: 'chevron-down' },
    ORDER: { high: 0, medium: 1, low: 2 },
  },
}

// ============================================
// STATE MANAGEMENT
// ============================================

class AppState {
  constructor() {
    this.data = {
      user: '',
      theme: 'auto',
      accent: 'indigo',
      meetings: [],
      todos: [],
      notifications: [],
      browserNotifs: false,
      showTestNotifButton: false,
      currentSection: 'dashboard',
      meetingFilter: 'all',
      todoFilter: 'all',
    }
    this.deleteCallback = null
    this.notifAlertTimer = null
    this.alertAudioCtx = null
    this.currentGuideTab = 0
  }

  load() {
    try {
      const stored = localStorage.getItem(CONFIG.STORAGE_KEY)
      if (stored) {
        this.data = { ...this.data, ...JSON.parse(stored) }
      }
    } catch (error) {
      console.warn('Failed to load state:', error)
    }
  }

  save() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data))
    } catch (error) {
      console.warn('Failed to save state:', error)
    }
  }

  get(key) {
    return this.data[key]
  }

  set(key, value) {
    this.data[key] = value
    this.save()
  }

  // Meetings
  getMeetings() {
    return this.data.meetings
  }

  addMeeting(meeting) {
    this.data.meetings.push(meeting)
    this.save()
  }

  updateMeeting(id, updatedMeeting) {
    const index = this.data.meetings.findIndex(m => m.id === id)
    if (index >= 0) {
      this.data.meetings[index] = { ...this.data.meetings[index], ...updatedMeeting }
      this.save()
      return true
    }
    return false
  }

  deleteMeeting(id) {
    this.data.meetings = this.data.meetings.filter(m => m.id !== id)
    this.save()
  }

  // Todos
  getTodos() {
    return this.data.todos
  }

  addTodo(todo) {
    this.data.todos.push(todo)
    this.save()
  }

  updateTodo(id, updatedTodo) {
    const index = this.data.todos.findIndex(t => t.id === id)
    if (index >= 0) {
      this.data.todos[index] = { ...this.data.todos[index], ...updatedTodo }
      this.save()
      return true
    }
    return false
  }

  deleteTodo(id) {
    this.data.todos = this.data.todos.filter(t => t.id !== id)
    this.save()
  }

  toggleTodoDone(id) {
    const todo = this.data.todos.find(t => t.id === id)
    if (todo) {
      todo.done = !todo.done
      this.save()
      return true
    }
    return false
  }

  // Notifications
  addNotification(emoji, title, body) {
    this.data.notifications.push({
      emoji,
      title,
      body,
      time: new Date().toISOString(),
    })
    this.save()
  }

  clearNotifications() {
    this.data.notifications = []
    this.save()
  }
}

// ============================================
// CORE APPLICATION
// ============================================

class PlanifyApp {
  constructor() {
    this.state = new AppState()
    this.dom = {}
    this.intervals = []
  }

  // ──────────────────────────────────────────
  // INITIALIZATION
  // ──────────────────────────────────────────

  init() {
    this.cacheDomElements()
    this.state.load()
    this.applyTheme(this.state.get('theme'))
    this.applyAccent(this.state.get('accent'))
    this.initTooltips()
    this.initAudioUnlock()
    this.initEventListeners()

    if (this.state.get('user')) {
      this.startApp()
    } else {
      this.showOnboarding()
    }
  }

  cacheDomElements() {
    const ids = [
      'onboarding',
      'app',
      'heroName',
      'headerName',
      'dailyTip',
      'currentDateTime',
      'heroSub',
      'themeBtn',
      'themeBtn2',
      'notifDot',
      'notifDot2',
      'navNotifBadge',
      'dockNotifBadge',
      'nameInput',
      'meetingModal',
      'todoModal',
      'settingsModal',
      'guideModal',
      'confirmModal',
      'notifModal',
      'meetingsList',
      'todosList',
      'notifList',
      'dashMeetings',
      'dashTodos',
      'progressFill',
      'progressPct',
      'statMeetings',
      'statTodos',
      'statDone',
      'statNotifs',
    ]

    ids.forEach(id => {
      this.dom[id] = document.getElementById(id)
    })
  }

  initEventListeners() {
    // Name input
    const nameInput = this.dom.nameInput
    if (nameInput) {
      nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') this.submitName()
      })
    }

    // Theme preference change
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.state.get('theme') === 'auto') {
        this.applyTheme('auto')
        this.updateThemeUI()
      }
    })

    // Confirm delete
    const confirmBtn = document.getElementById('confirmDeleteBtn')
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.closeModal('confirmModal')
        if (this.state.deleteCallback) {
          this.state.deleteCallback()
          this.state.deleteCallback = null
        }
      })
    }
  }

  // ──────────────────────────────────────────
  // ONBOARDING
  // ──────────────────────────────────────────

  showOnboarding() {
    if (this.dom.onboarding) {
      this.dom.onboarding.style.display = 'flex'
    }
    lucide.createIcons()
  }

  submitName() {
    const nameInput = this.dom.nameInput
    const name = nameInput.value.trim()
    if (!name) {
      this.shakeElement(nameInput)
      return
    }
    this.state.set('user', name)
    this.startApp()
  }

  shakeElement(element) {
    element.style.borderColor = '#ef4444'
    element.style.boxShadow = '0 0 0 3px rgba(239,68,68,.2)'
    setTimeout(() => {
      element.style.borderColor = ''
      element.style.boxShadow = ''
    }, 900)
  }

  // ──────────────────────────────────────────
  // APP START
  // ──────────────────────────────────────────

  startApp() {
    if (this.dom.onboarding) {
      this.dom.onboarding.style.display = 'none'
    }
    if (this.dom.app) {
      this.dom.app.classList.add('visible')
    }

    this.updateGreeting()
    this.updateDailyTip()

    lucide.createIcons()
    this.applyTheme(this.state.get('theme'))
    this.applyAccent(this.state.get('accent'))
    this.updateThemeUI()
    this.updateBrowserNotifToggle()

    this.showSection('dashboard')

    // Start intervals
    this.startClock()
    this.startNotificationChecker()

    if (this.state.get('browserNotifs')) {
      this.requestNotificationPermission(true)
    }
  }

  updateGreeting() {
    const emojis = CONFIG.EMOJIS
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)]
    const userName = this.state.get('user')

    if (this.dom.heroName) {
      this.dom.heroName.textContent = userName
    }
    if (this.dom.headerName) {
      this.dom.headerName.textContent = `أهلاً ${userName} ${randomEmoji}`
    }

    this.updateClock()
  }

  updateDailyTip() {
    const tips = CONFIG.TIPS
    if (this.dom.dailyTip) {
      this.dom.dailyTip.textContent = tips[Math.floor(Math.random() * tips.length)]
    }
  }

  // ──────────────────────────────────────────
  // CLOCK
  // ──────────────────────────────────────────

  startClock() {
    this.updateClock()
    const interval = setInterval(() => this.updateClock(), CONFIG.CLOCK_INTERVAL)
    this.intervals.push(interval)
  }

  updateClock() {
    const now = new Date()
    if (this.dom.currentDateTime) {
      this.dom.currentDateTime.textContent = now.toLocaleString('ar-EG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    // Update greeting
    const hour = now.getHours()
    let greeting = 'مساء الخير 🌙'
    if (hour < 12) greeting = 'صباح الخير ☀️'
    else if (hour < 17) greeting = 'مساء النور 🌤️'

    if (this.dom.heroSub) {
      this.dom.heroSub.textContent = `${greeting} — مخططك الذكي لليوم`
    }
  }

  // ──────────────────────────────────────────
  // THEME
  // ──────────────────────────────────────────

  applyTheme(mode) {
    this.state.set('theme', mode)
    const isDark = this.isDarkMode(mode)
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }

  isDarkMode(mode) {
    if (mode === 'dark') return true
    if (mode === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  }

  toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    this.setTheme(isDark ? 'light' : 'dark')
  }

  setTheme(mode) {
    this.applyTheme(mode)
    this.updateThemeUI()
    this.closeModal('settingsModal')
  }

  updateThemeUI() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    const icon = isDark ? 'sun' : 'moon'

    ;['themeBtn', 'themeBtn2'].forEach(id => {
      const btn = document.getElementById(id)
      if (btn) {
        btn.innerHTML = `<i data-lucide="${icon}" style="width:17px;height:17px;"></i>`
      }
    })

    // Update settings buttons
    ;['light', 'dark', 'auto'].forEach(mode => {
      const btnId = `btn${mode.charAt(0).toUpperCase() + mode.slice(1)}`
      const btn = document.getElementById(btnId)
      if (btn) {
        btn.classList.toggle('active', this.state.get('theme') === mode)
      }
    })

    lucide.createIcons()
  }

  // ──────────────────────────────────────────
  // ACCENT COLOR
  // ──────────────────────────────────────────

  applyAccent(name) {
    this.state.set('accent', name)
    document.documentElement.setAttribute('data-accent', name)
  }

  setAccent(name, element) {
    this.applyAccent(name)
    document.querySelectorAll('.swatch[data-accent]').forEach(s => {
      s.classList.remove('active')
    })
    if (element) {
      element.classList.add('active')
    }
  }

  // ──────────────────────────────────────────
  // NAVIGATION
  // ──────────────────────────────────────────

  showSection(name) {
    this.state.set('currentSection', name)

    // Hide all sections
    document.querySelectorAll('[id^="section-"]').forEach(section => {
      section.style.display = 'none'
    })

    // Show target section
    const targetSection = document.getElementById(`section-${name}`)
    if (targetSection) {
      targetSection.style.display = 'block'
    }

    // Update navigation active states
    document.querySelectorAll('.nav-item, .dock-btn').forEach(btn => {
      btn.classList.remove('active')
    })
    ;['nav-', 'dock-'].forEach(prefix => {
      const btn = document.getElementById(prefix + name)
      if (btn) btn.classList.add('active')
    })

    // Render section content
    const renderMap = {
      dashboard: () => this.renderDashboard(),
      meetings: () => this.renderMeetings(),
      todos: () => this.renderTodos(),
      notifications: () => this.renderNotifications(),
    }

    if (renderMap[name]) {
      renderMap[name]()
    }
  }

  // ──────────────────────────────────────────
  // MEETINGS CRUD
  // ──────────────────────────────────────────

  openMeetingModal(id = null) {
    const modal = this.dom.meetingModal
    if (!modal) return

    document.getElementById('editingMeetingId').value = id || ''
    const titleEl = document.getElementById('meetingModalTitle')
    if (titleEl) {
      titleEl.textContent = id ? '✏️ تعديل الاجتماع' : '📅 اجتماع جديد'
    }

    if (id) {
      const meeting = this.state.getMeetings().find(m => m.id === id)
      if (!meeting) return

      document.getElementById('meetTitle').value = meeting.title
      document.getElementById('meetDesc').value = meeting.desc || ''
      document.getElementById('meetDate').value = meeting.date
      document.getElementById('meetTime').value = meeting.time
      document.getElementById('meetLocation').value = meeting.location || ''
      const notifToggle = document.getElementById('meetNotifToggle')
      if (notifToggle) {
        notifToggle.classList.toggle('on', meeting.notif !== false)
      }
    } else {
      ;['meetTitle', 'meetDesc', 'meetLocation'].forEach(id => {
        const el = document.getElementById(id)
        if (el) el.value = ''
      })

      const dateInput = document.getElementById('meetDate')
      if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0]
      }

      const timeInput = document.getElementById('meetTime')
      if (timeInput) {
        timeInput.value = ''
      }

      const notifToggle = document.getElementById('meetNotifToggle')
      if (notifToggle) {
        notifToggle.classList.add('on')
      }
    }

    modal.style.display = 'flex'
    lucide.createIcons()

    setTimeout(() => {
      const titleInput = document.getElementById('meetTitle')
      if (titleInput) titleInput.focus()
    }, 120)
  }

  saveMeeting() {
    const title = document.getElementById('meetTitle').value.trim()
    const date = document.getElementById('meetDate').value
    const time = document.getElementById('meetTime').value

    if (!title || !date || !time) {
      this.showToast('❌', 'يرجى ملء العنوان والتاريخ والوقت')
      return
    }

    const editId = document.getElementById('editingMeetingId').value
    const id = editId || this.generateId()
    const existing = this.state.getMeetings().find(m => m.id === id)

    const meeting = {
      id,
      title,
      date,
      time,
      desc: document.getElementById('meetDesc').value.trim(),
      location: document.getElementById('meetLocation').value.trim(),
      notif: document.getElementById('meetNotifToggle').classList.contains('on'),
      createdAt: existing?.createdAt || new Date().toISOString(),
      notified30: existing?.notified30 || false,
      notified5: existing?.notified5 || false,
    }

    if (existing) {
      this.state.updateMeeting(id, meeting)
    } else {
      this.state.addMeeting(meeting)
    }

    this.closeModal('meetingModal')
    this.renderMeetings()
    this.renderDashboard()
    this.showToast('✅', `تم حفظ "${title}" ✅`)
  }

  deleteMeeting(id) {
    this.openConfirm(() => {
      this.state.deleteMeeting(id)
      this.renderMeetings()
      this.renderDashboard()
      this.showToast('✅', 'تم حذف الاجتماع 🗑️')
    })
  }

  // ──────────────────────────────────────────
  // TODOS CRUD
  // ──────────────────────────────────────────

  openTodoModal(id = null) {
    const modal = this.dom.todoModal
    if (!modal) return

    document.getElementById('editingTodoId').value = id || ''
    const titleEl = document.getElementById('todoModalTitle')
    if (titleEl) {
      titleEl.textContent = id ? '✏️ تعديل المهمة' : '✅ مهمة جديدة'
    }

    if (id) {
      const todo = this.state.getTodos().find(t => t.id === id)
      if (!todo) return

      document.getElementById('todoTitle').value = todo.title
      document.getElementById('todoDesc').value = todo.desc || ''
      document.getElementById('todoPriority').value = todo.priority
      document.getElementById('todoDue').value = todo.due || ''
      const notifToggle = document.getElementById('todoNotifToggle')
      if (notifToggle) {
        notifToggle.classList.toggle('on', todo.notif === true)
      }
    } else {
      ;['todoTitle', 'todoDesc'].forEach(id => {
        const el = document.getElementById(id)
        if (el) el.value = ''
      })

      const priorityEl = document.getElementById('todoPriority')
      if (priorityEl) priorityEl.value = 'medium'

      const dueEl = document.getElementById('todoDue')
      if (dueEl) dueEl.value = ''

      const notifToggle = document.getElementById('todoNotifToggle')
      if (notifToggle) {
        notifToggle.classList.remove('on')
      }
    }

    modal.style.display = 'flex'
    lucide.createIcons()

    setTimeout(() => {
      const titleInput = document.getElementById('todoTitle')
      if (titleInput) titleInput.focus()
    }, 120)
  }

  saveTodo() {
    const title = document.getElementById('todoTitle').value.trim()
    if (!title) {
      this.shakeElement(document.getElementById('todoTitle'))
      return
    }

    const editId = document.getElementById('editingTodoId').value
    const id = editId || this.generateId()
    const existing = this.state.getTodos().find(t => t.id === id)

    const todo = {
      id,
      title,
      desc: document.getElementById('todoDesc').value.trim(),
      priority: document.getElementById('todoPriority').value,
      due: document.getElementById('todoDue').value,
      notif: document.getElementById('todoNotifToggle').classList.contains('on'),
      done: existing?.done || false,
      createdAt: existing?.createdAt || new Date().toISOString(),
    }

    if (existing) {
      this.state.updateTodo(id, todo)
    } else {
      this.state.addTodo(todo)
    }

    this.closeModal('todoModal')
    this.renderTodos()
    this.renderDashboard()
    this.showToast('✅', `تم حفظ "${title}" ✅`)
  }

  toggleTodoDone(id) {
    if (this.state.toggleTodoDone(id)) {
      this.renderTodos()
      this.renderDashboard()
    }
  }

  deleteTodo(id) {
    this.openConfirm(() => {
      this.state.deleteTodo(id)
      this.renderTodos()
      this.renderDashboard()
      this.showToast('✅', 'تم حذف المهمة 🗑️')
    })
  }

  // ──────────────────────────────────────────
  // RENDERING
  // ──────────────────────────────────────────

  renderDashboard() {
    const today = new Date().toISOString().split('T')[0]
    const meetings = this.state.getMeetings()
    const todos = this.state.getTodos()

    const todayMeetings = meetings.filter(m => m.date === today)
    const pendingTodos = todos.filter(t => !t.done)
    const doneTodos = todos.filter(t => t.done)
    const totalTodos = todos.length
    const pct = totalTodos ? Math.round((doneTodos.length / totalTodos) * 100) : 0
    const notifications = this.state.get('notifications')

    // Update stats
    this.updateElement('statMeetings', todayMeetings.length)
    this.updateElement('statTodos', pendingTodos.length)
    this.updateElement('statDone', doneTodos.length)
    this.updateElement('statNotifs', notifications.length)

    // Update progress
    if (this.dom.progressPct) {
      this.dom.progressPct.textContent = pct + '%'
    }
    if (this.dom.progressFill) {
      this.dom.progressFill.style.width = pct + '%'
    }

    // Render upcoming meetings
    const now = new Date()
    const upcomingMeetings = meetings
      .filter(m => new Date(`${m.date}T${m.time}`) >= now)
      .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`))
      .slice(0, 4)

    if (this.dom.dashMeetings) {
      if (upcomingMeetings.length) {
        this.dom.dashMeetings.innerHTML = `
          <div class="meeting-list">
            ${upcomingMeetings.map(m => this.createMeetingCard(m, true)).join('')}
          </div>
        `
      } else {
        this.dom.dashMeetings.innerHTML = `
          <div class="empty">
            <div class="empty-icon">📅</div>
            <div class="empty-text">لا توجد اجتماعات قادمة</div>
          </div>
        `
      }
    }

    // Render high priority todos
    const highPriorityTodos = pendingTodos.filter(t => t.priority === 'high').slice(0, 3)
    if (this.dom.dashTodos) {
      if (highPriorityTodos.length) {
        this.dom.dashTodos.innerHTML = `
          <div class="todo-list">
            ${highPriorityTodos.map(t => this.createTodoCard(t)).join('')}
          </div>
        `
      } else {
        this.dom.dashTodos.innerHTML = `
          <div class="empty">
            <div class="empty-icon">🎉</div>
            <div class="empty-text">لا توجد مهام عالية الأولوية</div>
          </div>
        `
      }
    }

    this.updateNotificationBadge()
    lucide.createIcons()
  }

  renderMeetings() {
    const filter = this.state.get('meetingFilter') || 'all'
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    let meetings = [...this.state.getMeetings()].sort(
      (a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`),
    )

    if (filter === 'today') meetings = meetings.filter(m => m.date === today)
    if (filter === 'upcoming')
      meetings = meetings.filter(m => new Date(`${m.date}T${m.time}`) > now)
    if (filter === 'past') meetings = meetings.filter(m => new Date(`${m.date}T${m.time}`) < now)

    if (this.dom.meetingsList) {
      if (meetings.length) {
        this.dom.meetingsList.innerHTML = `
          <div class="meeting-list">
            ${meetings.map(m => this.createMeetingCard(m, false)).join('')}
          </div>
        `
      } else {
        this.dom.meetingsList.innerHTML = `
          <div class="empty">
            <div class="empty-icon">📅</div>
            <div class="empty-text">لا توجد اجتماعات</div>
            <button class="btn btn-primary" onclick="app.openMeetingModal()" style="margin-top:8px;">
              <i data-lucide="plus" style="width:14px;height:14px;"></i>أضف اجتماعاً
            </button>
          </div>
        `
      }
    }

    lucide.createIcons()
  }

  createMeetingCard(meeting, compact) {
    const dt = new Date(`${meeting.date}T${meeting.time}`)
    const now = new Date()
    const diffMinutes = Math.round((dt - now) / 60000)
    const isPast = dt < now
    const isSoon = !isPast && diffMinutes <= 60

    let badge = ''
    if (isPast) {
      badge = `<span class="chip chip-muted">انتهى</span>`
    } else if (isSoon) {
      badge = `<span class="chip chip-amber chip-blink">⏰ بعد ${diffMinutes} دقيقة</span>`
    } else {
      badge = `<span class="chip chip-green">📅 قادم</span>`
    }

    const dateStr = dt.toLocaleDateString('ar-EG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    const timeStr = dt.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    })

    return `
      <div class="m-card" data-s="${isPast ? 'past' : isSoon ? 'soon' : 'upcoming'}">
        <div class="m-accent-bar"></div>
        <div class="m-card-top">
          <div class="m-card-body">
            <div class="m-card-title">${this.escapeHtml(meeting.title)}</div>
            <div class="m-card-meta">
              <span class="meta-pill"><i data-lucide="calendar" style="width:13px;height:13px;"></i>${dateStr}</span>
              <span class="meta-pill"><i data-lucide="clock" style="width:13px;height:13px;"></i>${timeStr}</span>
              ${meeting.location ? `<span class="meta-pill"><i data-lucide="map-pin" style="width:13px;height:13px;"></i>${this.escapeHtml(meeting.location)}</span>` : ''}
            </div>
            <div class="m-card-badges">
              ${badge}
              ${meeting.notif ? `<span class="chip chip-accent"><i data-lucide="bell" style="width:11px;height:11px;"></i>تنبيه</span>` : ''}
            </div>
            ${meeting.desc && !compact ? `<div class="m-card-desc">${this.escapeHtml(meeting.desc)}</div>` : ''}
          </div>
          ${
            !compact
              ? `
          <div class="m-card-actions">
            <button class="btn-icon" data-tip="تعديل" onclick="app.openMeetingModal('${meeting.id}')">
              <i data-lucide="pencil" style="width:15px;height:15px;"></i>
            </button>
            <button class="btn-icon" data-tip="حذف" onclick="app.deleteMeeting('${meeting.id}')" style="color:#ef4444;">
              <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
            </button>
          </div>`
              : ''
          }
        </div>
      </div>
    `
  }

  renderTodos() {
    const filter = this.state.get('todoFilter') || 'all'
    const priorityOrder = CONFIG.PRIORITY.ORDER

    let todos = [...this.state.getTodos()].sort(
      (a, b) =>
        priorityOrder[a.priority] - priorityOrder[b.priority] ||
        new Date(b.createdAt) - new Date(a.createdAt),
    )

    if (filter === 'pending') todos = todos.filter(t => !t.done)
    if (filter === 'done') todos = todos.filter(t => t.done)
    if (filter === 'high') todos = todos.filter(t => t.priority === 'high')

    if (this.dom.todosList) {
      if (todos.length) {
        this.dom.todosList.innerHTML = `
          <div class="todo-list">
            ${todos.map(t => this.createTodoCard(t)).join('')}
          </div>
        `
      } else {
        this.dom.todosList.innerHTML = `
          <div class="empty">
            <div class="empty-icon">✅</div>
            <div class="empty-text">لا توجد مهام</div>
            <button class="btn btn-primary" onclick="app.openTodoModal()" style="margin-top:8px;">
              <i data-lucide="plus" style="width:14px;height:14px;"></i>أضف مهمة
            </button>
          </div>
        `
      }
    }

    lucide.createIcons()
  }

  createTodoCard(todo) {
    const pLabel = CONFIG.PRIORITY.LABELS
    const pClass = CONFIG.PRIORITY.CLASSES
    const pIcon = CONFIG.PRIORITY.ICONS

    const dueStr = todo.due
      ? new Date(todo.due + 'T00:00').toLocaleDateString('ar-EG', {
          day: 'numeric',
          month: 'short',
        })
      : ''

    const overdue = todo.due && !todo.done && new Date(todo.due) < new Date()

    return `
      <div class="t-card${todo.done ? ' done' : ''}" data-p="${todo.priority}">
        <div class="check-circle${todo.done ? ' done' : ''}" 
             onclick="app.toggleTodoDone('${todo.id}')" 
             data-tip="${todo.done ? 'إلغاء الإنجاز' : 'تحديد كمنجز'}">
          ${todo.done ? `<i data-lucide="check" style="width:14px;height:14px;color:#fff;"></i>` : ''}
        </div>
        <div class="t-body">
          <div class="t-title">${this.escapeHtml(todo.title)}</div>
          ${todo.desc ? `<div class="t-desc">${this.escapeHtml(todo.desc)}</div>` : ''}
          <div class="t-meta">
            <span class="chip ${pClass[todo.priority]}">
              <i data-lucide="${pIcon[todo.priority]}" style="width:11px;height:11px;"></i>${pLabel[todo.priority]}
            </span>
            ${
              dueStr
                ? `
              <span class="chip${overdue ? ' chip-red chip-blink' : ' chip-muted'}">
                <i data-lucide="calendar" style="width:11px;height:11px;"></i>${dueStr}${overdue ? ' ⚠️' : ''}
              </span>
            `
                : ''
            }
            ${todo.notif ? `<span class="chip chip-accent"><i data-lucide="bell" style="width:11px;height:11px;"></i>تنبيه</span>` : ''}
          </div>
        </div>
        <div class="t-actions">
          <button class="btn-icon" data-tip="تعديل" onclick="app.openTodoModal('${todo.id}')">
            <i data-lucide="pencil" style="width:14px;height:14px;"></i>
          </button>
          <button class="btn-icon" data-tip="حذف" onclick="app.deleteTodo('${todo.id}')" style="color:#ef4444;">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          </button>
        </div>
      </div>
    `
  }

  renderNotifications() {
    const notifications = this.state.get('notifications')
    if (this.dom.notifList) {
      if (!notifications.length) {
        this.dom.notifList.innerHTML = `
          <div class="empty">
            <div class="empty-icon">🔕</div>
            <div class="empty-text">لا توجد إشعارات حتى الآن</div>
          </div>
        `
        return
      }

      const sorted = [...notifications].reverse()
      this.dom.notifList.innerHTML = `
        <div class="notif-list">
          ${sorted
            .map(
              n => `
            <div class="n-card">
              <div class="n-emoji">${n.emoji || '🔔'}</div>
              <div class="n-body">
                <div class="n-title">${this.escapeHtml(n.title)}</div>
                ${n.body ? `<div class="n-sub">${this.escapeHtml(n.body)}</div>` : ''}
                <div class="n-time">${new Date(n.time).toLocaleString('ar-EG')}</div>
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
      `
    }
  }

  updateNotificationBadge() {
    const count = this.state.get('notifications').length

    ;['notifDot', 'notifDot2'].forEach(id => {
      const el = document.getElementById(id)
      if (el) {
        el.style.display = count ? 'block' : 'none'
      }
    })

    const navBadge = document.getElementById('navNotifBadge')
    if (navBadge) {
      navBadge.style.display = count ? 'inline-flex' : 'none'
      navBadge.textContent = count
    }

    const dockBadge = document.getElementById('dockNotifBadge')
    if (dockBadge) {
      dockBadge.style.display = count ? 'inline-flex' : 'none'
      dockBadge.textContent = count
    }
  }

  clearAllNotifications() {
    this.openConfirm(() => {
      this.state.clearNotifications()
      this.renderNotifications()
      this.updateNotificationBadge()
      this.showToast('✅', 'تم مسح جميع الإشعارات')
    })
  }

  // ──────────────────────────────────────────
  // FILTERS
  // ──────────────────────────────────────────

  filterMeetings(filter, button) {
    this.state.set('meetingFilter', filter)
    document.querySelectorAll('#section-meetings .tab-btn').forEach(btn => {
      btn.classList.remove('active')
    })
    if (button) button.classList.add('active')
    this.renderMeetings()
  }

  filterTodos(filter, button) {
    this.state.set('todoFilter', filter)
    document.querySelectorAll('#section-todos .tab-btn').forEach(btn => {
      btn.classList.remove('active')
    })
    if (button) button.classList.add('active')
    this.renderTodos()
  }

  // ──────────────────────────────────────────
  // NOTIFICATION SYSTEM
  // ──────────────────────────────────────────

  startNotificationChecker() {
    this.checkMeetingNotifications()
    const interval = setInterval(
      () => this.checkMeetingNotifications(),
      CONFIG.NOTIFICATION_INTERVAL,
    )
    this.intervals.push(interval)
  }

  checkMeetingNotifications() {
    const now = new Date()
    let updated = false

    this.state.getMeetings().forEach(meeting => {
      if (!meeting.notif) return

      const dt = new Date(`${meeting.date}T${meeting.time}`)
      const diffMinutes = (dt - now) / 60000

      if (diffMinutes > 0 && diffMinutes <= 30 && !meeting.notified30) {
        meeting.notified30 = true
        updated = true
        this.fireNotification(
          '⏰',
          `اجتماعك "${meeting.title}" بعد 30 دقيقة`,
          `${meeting.date} الساعة ${meeting.time}${meeting.location ? ' — ' + meeting.location : ''}`,
        )
      }

      if (diffMinutes > 0 && diffMinutes <= 5 && !meeting.notified5) {
        meeting.notified5 = true
        updated = true
        this.fireNotification(
          '🚨',
          `اجتماعك "${meeting.title}" بعد 5 دقائق فقط!`,
          `${meeting.date} الساعة ${meeting.time}${meeting.location ? ' — ' + meeting.location : ''}`,
        )
      }
    })

    if (updated) {
      this.state.save()
    }
  }

  fireNotification(emoji, title, body) {
    // Add to state
    this.state.addNotification(emoji, title, body)
    this.updateNotificationBadge()

    // Show toast
    this.showToast(emoji, title, body)

    // Show modal
    this.openNotificationModal(emoji, title, body)

    // Browser notification
    if (this.state.get('browserNotifs') && Notification.permission === 'granted') {
      new Notification(`${emoji} ${title}`, { body })
    }

    // Re-render if on notifications page
    if (this.state.get('currentSection') === 'notifications') {
      this.renderNotifications()
    }
  }

  openNotificationModal(emoji, title, body) {
    const modal = this.dom.notifModal
    if (!modal) return

    const emojiEl = document.getElementById('notifModalEmoji')
    const titleEl = document.getElementById('notifModalTitle')
    const bodyEl = document.getElementById('notifModalBody')

    if (emojiEl) emojiEl.textContent = emoji || '🔔'
    if (titleEl) titleEl.textContent = title || 'تنبيه'
    if (bodyEl) bodyEl.textContent = body || ''

    modal.style.display = 'flex'
    this.startNotificationSound()
    lucide.createIcons()
  }

  closeNotificationModal() {
    const modal = this.dom.notifModal
    if (modal) modal.style.display = 'none'
    this.stopNotificationSound()
  }

  // ──────────────────────────────────────────
  // TOAST SYSTEM
  // ──────────────────────────────────────────

  showToast(emoji, title, body = '') {
    const toast = document.createElement('div')
    toast.className = 'toast'
    toast.innerHTML = `
      <div class="toast-emoji">${emoji}</div>
      <div class="toast-text">
        <div class="toast-title">${this.escapeHtml(title)}</div>
        ${body ? `<div class="toast-sub">${this.escapeHtml(body)}</div>` : ''}
      </div>
      <button class="btn-icon" onclick="this.parentElement.remove()" style="flex-shrink:0;">
        <i data-lucide="x" style="width:14px;height:14px;"></i>
      </button>
    `

    document.body.appendChild(toast)
    lucide.createIcons()

    setTimeout(() => {
      toast.classList.add('out')
      setTimeout(() => toast.remove(), 280)
    }, 5000)
  }

  // ──────────────────────────────────────────
  // AUDIO SYSTEM
  // ──────────────────────────────────────────

  initAudioUnlock() {
    document.addEventListener(
      'pointerdown',
      () => {
        try {
          this.ensureAudioContext()
        } catch (error) {
          // Silent fail
        }
      },
      { once: true },
    )
  }

  ensureAudioContext() {
    if (!this.state.alertAudioCtx) {
      this.state.alertAudioCtx = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (this.state.alertAudioCtx.state === 'suspended') {
      this.state.alertAudioCtx.resume()
    }
    return this.state.alertAudioCtx
  }

  playChime(ctx) {
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.72, now)
    master.connect(ctx.destination)

    const notes = [
      { freq: 880, start: 0, dur: 0.55 },
      { freq: 1108, start: 0.18, dur: 0.55 },
      { freq: 1319, start: 0.36, dur: 0.75 },
    ]

    notes.forEach(n => {
      // Primary sine
      const osc1 = ctx.createOscillator()
      const g1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.value = n.freq
      osc1.connect(g1)
      g1.connect(master)
      g1.gain.setValueAtTime(0, now + n.start)
      g1.gain.linearRampToValueAtTime(0.65, now + n.start + 0.03)
      g1.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur)
      osc1.start(now + n.start)
      osc1.stop(now + n.start + n.dur + 0.05)

      // Harmonics triangle
      const osc2 = ctx.createOscillator()
      const g2 = ctx.createGain()
      osc2.type = 'triangle'
      osc2.frequency.value = n.freq * 2
      osc2.connect(g2)
      g2.connect(master)
      g2.gain.setValueAtTime(0, now + n.start)
      g2.gain.linearRampToValueAtTime(0.22, now + n.start + 0.02)
      g2.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur * 0.7)
      osc2.start(now + n.start)
      osc2.stop(now + n.start + n.dur)
    })
  }

  startNotificationSound() {
    this.stopNotificationSound()
    try {
      const ctx = this.ensureAudioContext()
      this.playChime(ctx)
      this.state.notifAlertTimer = setInterval(() => {
        try {
          this.playChime(this.ensureAudioContext())
        } catch (error) {
          // Silent fail
        }
      }, 2200)
    } catch (error) {
      console.warn('Failed to play notification sound:', error)
    }
  }

  stopNotificationSound() {
    if (this.state.notifAlertTimer) {
      clearInterval(this.state.notifAlertTimer)
      this.state.notifAlertTimer = null
    }
  }

  // ──────────────────────────────────────────
  // BROWSER NOTIFICATIONS
  // ──────────────────────────────────────────

  toggleBrowserNotifications() {
    if (!this.state.get('browserNotifs')) {
      this.requestNotificationPermission()
    } else {
      this.state.set('browserNotifs', false)
      this.updateBrowserNotifToggle()
    }
  }

  requestNotificationPermission(silent = false) {
    if (!('Notification' in window)) {
      if (!silent) this.showToast('❌', 'متصفحك لا يدعم الإشعارات')
      return
    }

    Notification.requestPermission().then(permission => {
      const toggle = document.getElementById('browserNotifToggle')
      if (permission === 'granted') {
        this.state.set('browserNotifs', true)
        if (toggle) toggle.classList.add('on')
        if (!silent) this.showToast('✅', 'تم تفعيل إشعارات المتصفح 🔔')
      } else {
        this.state.set('browserNotifs', false)
        if (toggle) toggle.classList.remove('on')
        if (!silent) this.showToast('❌', 'تم رفض إذن الإشعارات')
      }
    })
  }

  updateBrowserNotifToggle() {
    const toggle = document.getElementById('browserNotifToggle')
    if (toggle) {
      toggle.classList.toggle('on', this.state.get('browserNotifs'))
    }
  }

  // ──────────────────────────────────────────
  // TEST NOTIFICATION
  // ──────────────────────────────────────────

  toggleTestNotificationButton() {
    const show = !this.state.get('showTestNotifButton')
    this.state.set('showTestNotifButton', show)

    const toggle = document.getElementById('testNotifToggle')
    const row = document.getElementById('testNotifRow')

    if (toggle) toggle.classList.toggle('on', show)
    if (row) row.style.display = show ? 'flex' : 'none'
  }

  testNotification() {
    this.fireNotification('🔔', 'تنبيه تجريبي', 'هذه تجربة للتنبيهات — المودال والصوت والإشعار.')
  }

  // ──────────────────────────────────────────
  // SETTINGS
  // ──────────────────────────────────────────

  openSettings() {
    const modal = this.dom.settingsModal
    if (!modal) return

    modal.style.display = 'flex'

    // Update accent swatches
    document.querySelectorAll('.swatch[data-accent]').forEach(swatch => {
      swatch.classList.toggle('active', swatch.dataset.accent === this.state.get('accent'))
    })

    this.updateBrowserNotifToggle()
    this.updateThemeUI()

    const showTest = this.state.get('showTestNotifButton')
    const testToggle = document.getElementById('testNotifToggle')
    const testRow = document.getElementById('testNotifRow')

    if (testToggle) testToggle.classList.toggle('on', showTest)
    if (testRow) testRow.style.display = showTest ? 'flex' : 'none'

    lucide.createIcons()
  }

  // ──────────────────────────────────────────
  // GUIDE
  // ──────────────────────────────────────────

  openGuide() {
    this.state.currentGuideTab = 0
    this.renderGuide()
    const modal = this.dom.guideModal
    if (modal) modal.style.display = 'flex'
    lucide.createIcons()
  }

  renderGuide() {
    const guideContent = this.getGuideContent()
    const page = guideContent[this.state.currentGuideTab]

    const contentEl = document.getElementById('guideContent')
    if (contentEl) {
      contentEl.innerHTML = page.html
    }

    // Update dots
    const dotsEl = document.getElementById('guideDots')
    if (dotsEl) {
      dotsEl.innerHTML = guideContent
        .map(
          (_, i) => `
        <div onclick="app.switchGuideTab(${i})" style="
          width:8px;height:8px;border-radius:50%;cursor:pointer;
          background:${i === this.state.currentGuideTab ? 'var(--a)' : 'var(--bd)'};
          transition:all .2s;
        "></div>
      `,
        )
        .join('')
    }

    // Update tab highlights
    guideContent.forEach((_, i) => {
      const tabBtn = document.getElementById(`gtab-${i}`)
      if (tabBtn) {
        tabBtn.classList.toggle('active', i === this.state.currentGuideTab)
      }
    })

    // Update navigation buttons
    const prevBtn = document.getElementById('guidePrev')
    if (prevBtn) {
      prevBtn.style.visibility = this.state.currentGuideTab === 0 ? 'hidden' : 'visible'
    }

    const nextBtn = document.getElementById('guideNext')
    if (nextBtn) {
      if (this.state.currentGuideTab === guideContent.length - 1) {
        nextBtn.innerHTML = `<i data-lucide="check" style="width:15px;height:15px;"></i>فهمت!`
        nextBtn.onclick = () => this.closeModal('guideModal')
      } else {
        nextBtn.innerHTML = `التالي<i data-lucide="chevron-left" style="width:15px;height:15px;"></i>`
        nextBtn.onclick = () => this.guideNavigate(1)
      }
    }

    lucide.createIcons()
  }

  getGuideContent() {
    return [
      {
        title: '👋 مرحباً!',
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
          </div>
        `,
      },
      {
        title: '📅 الاجتماعات',
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
          </div>
        `,
      },
      {
        title: '✅ المهام',
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
          </div>
        `,
      },
      {
        title: '🔔 الإشعارات',
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
          </div>
        `,
      },
      {
        title: '🎨 التخصيص',
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
          </div>
        `,
      },
    ]
  }

  switchGuideTab(index) {
    this.state.currentGuideTab = index
    this.renderGuide()
  }

  guideNavigate(direction) {
    const max = this.getGuideContent().length - 1
    this.state.currentGuideTab = Math.min(Math.max(0, this.state.currentGuideTab + direction), max)
    this.renderGuide()
  }

  // ──────────────────────────────────────────
  // MODAL HELPERS
  // ──────────────────────────────────────────

  closeModal(id) {
    const modal = document.getElementById(id)
    if (modal) modal.style.display = 'none'
  }

  closeOnOverlay(event, id) {
    if (event.target.id === id) this.closeModal(id)
  }

  // ──────────────────────────────────────────
  // CONFIRMATION DIALOG
  // ──────────────────────────────────────────

  openConfirm(callback) {
    this.state.deleteCallback = callback
    const modal = this.dom.confirmModal
    if (modal) modal.style.display = 'flex'
    lucide.createIcons()
  }

  // ──────────────────────────────────────────
  // TOOLTIPS
  // ──────────────────────────────────────────

  initTooltips() {
    const tooltip = document.getElementById('tooltip')
    let activeElement = null

    const positionTooltip = element => {
      if (!tooltip) return
      const rect = element.getBoundingClientRect()

      tooltip.style.visibility = 'hidden'
      tooltip.style.display = 'block'

      const tooltipWidth = tooltip.offsetWidth
      const padding = 8

      let left = rect.left + rect.width / 2
      left = Math.min(
        Math.max(left, padding + tooltipWidth / 2),
        window.innerWidth - padding - tooltipWidth / 2,
      )

      const above = rect.top - tooltip.offsetHeight - 10
      if (above >= padding) {
        tooltip.style.top = above + 'px'
        tooltip.className = 'tooltip-bubble tip-top'
      } else {
        tooltip.style.top = rect.bottom + 10 + 'px'
        tooltip.className = 'tooltip-bubble tip-bottom'
      }

      tooltip.style.left = left + 'px'
      tooltip.style.visibility = 'visible'
    }

    const showTooltip = element => {
      const text = element.getAttribute('data-tip')
      if (!text) return

      activeElement = element
      if (tooltip) {
        tooltip.textContent = text
        positionTooltip(element)
        requestAnimationFrame(() => tooltip.classList.add('show'))
      }
    }

    const hideTooltip = () => {
      activeElement = null
      if (tooltip) {
        tooltip.classList.remove('show')
      }
    }

    document.addEventListener('mouseover', event => {
      const element = event.target.closest('[data-tip]')
      if (element) showTooltip(element)
    })

    document.addEventListener('mouseout', event => {
      if (activeElement && !activeElement.contains(event.relatedTarget)) {
        hideTooltip()
      }
    })

    window.addEventListener('scroll', hideTooltip, true)
    window.addEventListener('resize', hideTooltip)
  }

  // ──────────────────────────────────────────
  // RESET APPLICATION
  // ──────────────────────────────────────────

  resetApp() {
    if (!confirm('هل أنت متأكد؟ سيتم حذف جميع البيانات نهائياً.')) return
    localStorage.removeItem(CONFIG.STORAGE_KEY)
    location.reload()
  }

  // ──────────────────────────────────────────
  // UTILITY METHODS
  // ──────────────────────────────────────────

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  }

  escapeHtml(text) {
    if (!text) return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  updateElement(elementId, value) {
    const element = document.getElementById(elementId)
    if (element) element.textContent = value
  }
}

// ============================================
// INITIALIZE APPLICATION
// ============================================

// Set current year in footer
const currentYear = new Date().getFullYear()
const yearElement = document.getElementById('current-year')
if (yearElement) yearElement.textContent = currentYear

// Create and initialize app
const app = new PlanifyApp()
app.init()

// Make app accessible globally for inline onclick handlers
window.app = app

// Expose functions for inline onclick handlers
window.openMeetingModal = id => app.openMeetingModal(id)
window.saveMeeting = () => app.saveMeeting()
window.deleteMeeting = id => app.deleteMeeting(id)
window.openTodoModal = id => app.openTodoModal(id)
window.saveTodo = () => app.saveTodo()
window.toggleTodoDone = id => app.toggleTodoDone(id)
window.deleteTodo = id => app.deleteTodo(id)
window.showSection = name => app.showSection(name)
window.filterMeetings = (filter, btn) => app.filterMeetings(filter, btn)
window.filterTodos = (filter, btn) => app.filterTodos(filter, btn)
window.closeModal = id => app.closeModal(id)
window.closeOnOverlay = (e, id) => app.closeOnOverlay(e, id)
window.openSettings = () => app.openSettings()
window.openGuide = () => app.openGuide()
window.switchGuideTab = i => app.switchGuideTab(i)
window.guideNav = dir => app.guideNavigate(dir)
window.toggleTheme = () => app.toggleTheme()
window.setTheme = mode => app.setTheme(mode)
window.setAccent = (name, el) => app.setAccent(name, el)
window.toggleBrowserNotifs = () => app.toggleBrowserNotifications()
window.clearAllNotifs = () => app.clearAllNotifications()
window.closeNotifModal = () => app.closeNotificationModal()
window.testNotification = () => app.testNotification()
window.toggleTestNotifButton = () => app.toggleTestNotificationButton()
window.resetApp = () => app.resetApp()
window.submitName = () => app.submitName()
