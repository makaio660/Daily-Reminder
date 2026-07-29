const STORAGE_KEY = "life-planner-web-tasks-v1";
const SETTINGS_KEY = "life-planner-web-settings-v1";
const VIEWS = ["Today", "Tomorrow", "Next 7 days", "Overdue", "All tasks"];
const REPEAT_LABELS = {
  none: "One time",
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
};

const SUGGESTIONS = [
  { title: "Drink water", category: "Health", priority: "Medium", time: "09:00", repeat: "daily" },
  { title: "Take vitamins or medicine", category: "Health", priority: "High", time: "08:30", repeat: "daily" },
  { title: "Exercise or stretch", category: "Fitness", priority: "Medium", time: "07:30", repeat: "weekdays" },
  { title: "Review today's schedule", category: "Planning", priority: "High", time: "08:00", repeat: "daily" },
  { title: "Clean room / reset space", category: "Home", priority: "Medium", time: "18:00" },
  { title: "Do laundry", category: "Home", priority: "Low", time: "17:00" },
  { title: "Finish homework / study block", category: "School", priority: "High", time: "16:00" },
  { title: "Work on project", category: "Work", priority: "High", time: "14:00" },
  { title: "Check budget / spending", category: "Money", priority: "Medium", time: "19:00" },
  { title: "Meal prep", category: "Food", priority: "Medium", time: "11:00", repeat: "weekly" },
  { title: "Text or call someone back", category: "Social", priority: "Medium", time: "15:00" },
  { title: "Night routine", category: "Routine", priority: "Low", time: "21:30", repeat: "daily" },
];

const state = {
  tasks: [],
  settings: {
    remindersEnabled: true,
    quietEnabled: false,
    quietStart: "22:00",
    quietEnd: "07:00",
  },
  view: "Today",
  timers: new Map(),
};

const els = {
  form: document.querySelector("#taskForm"),
  suggestedTask: document.querySelector("#suggestedTask"),
  title: document.querySelector("#taskTitle"),
  category: document.querySelector("#taskCategory"),
  priority: document.querySelector("#taskPriority"),
  date: document.querySelector("#taskDate"),
  time: document.querySelector("#taskTime"),
  repeat: document.querySelector("#taskRepeat"),
  notes: document.querySelector("#taskNotes"),
  remindersEnabled: document.querySelector("#remindersEnabled"),
  quietEnabled: document.querySelector("#quietEnabled"),
  quietStart: document.querySelector("#quietStart"),
  quietEnd: document.querySelector("#quietEnd"),
  reminderStatus: document.querySelector("#reminderStatus"),
  viewTabs: document.querySelector("#viewTabs"),
  taskList: document.querySelector("#taskList"),
  taskTemplate: document.querySelector("#taskTemplate"),
  todayProgress: document.querySelector("#todayProgress"),
  taskCount: document.querySelector("#taskCount"),
  testNotification: document.querySelector("#testNotification"),
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInputValue(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDayKey(date) {
  return toDateInputValue(new Date(date));
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addRepeatInterval(date, repeat) {
  const next = new Date(date);

  if (repeat === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (repeat === "weekdays") {
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || next.getDay() === 6);
  } else if (repeat === "weekly") {
    next.setDate(next.getDate() + 7);
  }

  return next;
}

function getNextRepeatedDue(task, fromDate = new Date()) {
  let due = new Date(task.dueAt);

  if (!task.repeat || task.repeat === "none") return due;

  while (due <= fromDate) {
    due = addRepeatInterval(due, task.repeat);
  }

  return due;
}

function formatDateTime(value) {
  const date = new Date(value);
  return `${date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  })} at ${date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function buildDueDate(dateValue, timeValue) {
  return new Date(`${dateValue}T${timeValue}:00`);
}

function loadTasks() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const parsedTasks = stored ? JSON.parse(stored) : [];

  state.tasks = parsedTasks.map((task) => ({
    repeat: "none",
    completedDates: [],
    ...task,
  }));
}

function loadSettings() {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) return;

  state.settings = {
    ...state.settings,
    ...JSON.parse(stored),
  };
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function syncSettingsControls() {
  els.remindersEnabled.checked = state.settings.remindersEnabled;
  els.quietEnabled.checked = state.settings.quietEnabled;
  els.quietStart.value = state.settings.quietStart;
  els.quietEnd.value = state.settings.quietEnd;
  els.reminderStatus.textContent = state.settings.remindersEnabled ? "On" : "Off";
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isDuringQuietTime(date) {
  if (!state.settings.quietEnabled) return false;

  const start = timeToMinutes(state.settings.quietStart);
  const end = timeToMinutes(state.settings.quietEnd);
  if (start === end) return false;

  const current = date.getHours() * 60 + date.getMinutes();
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function quietEndFor(date) {
  const start = timeToMinutes(state.settings.quietStart);
  const end = timeToMinutes(state.settings.quietEnd);
  const current = date.getHours() * 60 + date.getMinutes();
  const [endHours, endMinutes] = state.settings.quietEnd.split(":").map(Number);
  const next = new Date(date);

  next.setHours(endHours, endMinutes, 0, 0);
  if (start > end && current >= start) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function nextAllowedNotificationTime(date) {
  if (!isDuringQuietTime(date)) return date;
  return quietEndFor(date);
}

function refreshRepeatedTasks() {
  let changed = false;
  const now = new Date();

  state.tasks.forEach((task) => {
    if (!task.repeat || task.repeat === "none" || task.completed) return;

    const due = new Date(task.dueAt);
    if (due < now) {
      task.dueAt = getNextRepeatedDue(task, now).toISOString();
      changed = true;
    }
  });

  if (changed) saveTasks();
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("This browser does not support notifications.");
    return false;
  }

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") {
    alert("Notifications are blocked for this site. You can re-enable them in your browser settings.");
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

function showNotification(task) {
  if (!state.settings.remindersEnabled || isDuringQuietTime(new Date())) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  new Notification(`Reminder: ${task.title}`, {
    body: `${task.category} • ${task.priority} priority • ${formatDateTime(task.dueAt)}`,
    tag: task.id,
  });
}

function advanceRecurringAfterReminder(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || !task.repeat || task.repeat === "none") return;

  task.dueAt = getNextRepeatedDue(task, new Date()).toISOString();
  task.completed = false;
  saveTasks();
  scheduleReminder(task);
  render();
}

function clearReminder(taskId) {
  const timer = state.timers.get(taskId);
  if (timer) clearTimeout(timer);
  state.timers.delete(taskId);
}

function scheduleReminder(task) {
  clearReminder(task.id);

  if (!state.settings.remindersEnabled) return;
  if (task.completed) return;

  const fireAt = nextAllowedNotificationTime(new Date(task.dueAt));
  const delay = fireAt.getTime() - Date.now();
  if (delay <= 0) return;

  const timer = setTimeout(() => {
    showNotification(task);
    advanceRecurringAfterReminder(task.id);
  }, delay);
  state.timers.set(task.id, timer);
}

function rescheduleAllReminders() {
  state.timers.forEach((timer) => clearTimeout(timer));
  state.timers.clear();
  state.tasks.forEach(scheduleReminder);
}

function getFilteredTasks() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const nextSevenEnd = endOfDay(addDays(now, 6));

  return [...state.tasks]
    .filter((task) => {
      const due = new Date(task.dueAt);
      if (state.view === "Today") return due >= todayStart && due <= todayEnd;
      if (state.view === "Tomorrow") return due >= tomorrowStart && due <= tomorrowEnd;
      if (state.view === "Next 7 days") return due >= todayStart && due <= nextSevenEnd;
      if (state.view === "Overdue") return due < now && !task.completed;
      return true;
    })
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
}

function renderTabs() {
  els.viewTabs.innerHTML = "";

  VIEWS.forEach((view) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab${state.view === view ? " active" : ""}`;
    button.textContent = view;
    button.addEventListener("click", () => {
      state.view = view;
      render();
    });
    els.viewTabs.append(button);
  });
}

function updateProgress() {
  const todayKey = toDayKey(new Date());
  const todayTasks = state.tasks.filter((task) => {
    const due = new Date(task.dueAt);
    return (
      (due >= startOfDay(new Date()) && due <= endOfDay(new Date())) ||
      task.completedDates.includes(todayKey)
    );
  });
  const complete = todayTasks.filter((task) => task.completed || task.completedDates.includes(todayKey)).length;
  els.todayProgress.textContent = `${complete}/${todayTasks.length} complete today`;
}

function renderTasks() {
  const tasks = getFilteredTasks();
  els.taskCount.textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
  els.taskList.innerHTML = "";

  if (tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No tasks here yet.";
    els.taskList.append(empty);
    return;
  }

  tasks.forEach((task) => {
    const node = els.taskTemplate.content.firstElementChild.cloneNode(true);
    const due = new Date(task.dueAt);
    const checkButton = node.querySelector(".check-button");
    const title = node.querySelector("h3");
    const badge = node.querySelector(".priority-badge");
    const meta = node.querySelector(".task-meta");
    const notes = node.querySelector(".task-notes");

    node.classList.toggle("complete", task.completed);
    node.classList.toggle("overdue", due < new Date() && !task.completed);
    checkButton.classList.toggle("done", task.completed);
    checkButton.textContent = task.completed ? "✓" : "";
    title.textContent = task.title;
    badge.textContent = task.priority;
    badge.classList.add(task.priority.toLowerCase());
    meta.textContent = `${task.category} • ${formatDateTime(task.dueAt)} • ${REPEAT_LABELS[task.repeat] || "One time"}`;
    notes.textContent = task.notes || "";

    checkButton.addEventListener("click", () => toggleTask(task.id));

    node.querySelector("[data-action='one']").addEventListener("click", () => snoozeTask(task.id, 1));
    node.querySelector("[data-action='two']").addEventListener("click", () => snoozeTask(task.id, 2));
    node.querySelector("[data-action='tomorrow']").addEventListener("click", () => moveToTomorrowMorning(task.id));
    node.querySelector("[data-action='delete']").addEventListener("click", () => deleteTask(task.id));

    els.taskList.append(node);
  });
}

function render() {
  renderTabs();
  updateProgress();
  renderTasks();
}

function createId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function addTask(event) {
  event.preventDefault();

  const dueAt = buildDueDate(els.date.value, els.time.value).toISOString();
  if (state.settings.remindersEnabled && new Date(dueAt) > new Date()) {
    await requestNotificationPermission();
  }

  const task = {
    id: createId(),
    title: els.title.value.trim(),
    category: els.category.value.trim() || "General",
    priority: els.priority.value,
    repeat: els.repeat.value,
    dueAt,
    notes: els.notes.value.trim(),
    completed: false,
    completedDates: [],
    createdAt: new Date().toISOString(),
  };

  state.tasks.push(task);
  saveTasks();
  scheduleReminder(task);
  els.form.reset();
  setDefaultFormDateTime();
  els.category.value = "Planning";
  els.priority.value = "Medium";
  els.repeat.value = "none";
  render();
}

async function toggleTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;

  task.completed = !task.completed;

  if (task.completed && task.repeat && task.repeat !== "none") {
    const todayKey = toDayKey(new Date());
    if (!task.completedDates.includes(todayKey)) {
      task.completedDates.push(todayKey);
    }
    task.completed = false;
    task.dueAt = getNextRepeatedDue(task, new Date()).toISOString();
    scheduleReminder(task);
  } else if (task.completed) {
    clearReminder(task.id);
  } else {
    if (state.settings.remindersEnabled && new Date(task.dueAt) > new Date()) {
      await requestNotificationPermission();
    }
    scheduleReminder(task);
  }

  saveTasks();
  render();
}

async function snoozeTask(taskId, days) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;

  const due = addDays(new Date(task.dueAt), days);
  task.dueAt = due.toISOString();
  task.completed = false;
  if (state.settings.remindersEnabled) {
    await requestNotificationPermission();
  }
  saveTasks();
  scheduleReminder(task);
  render();
}

async function moveToTomorrowMorning(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;

  const due = addDays(new Date(), 1);
  due.setHours(9, 0, 0, 0);
  task.dueAt = due.toISOString();
  task.completed = false;
  if (state.settings.remindersEnabled) {
    await requestNotificationPermission();
  }
  saveTasks();
  scheduleReminder(task);
  render();
}

function deleteTask(taskId) {
  clearReminder(taskId);
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  saveTasks();
  render();
}

function setDefaultFormDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  els.date.value = toDateInputValue(now);
  els.time.value = toTimeInputValue(now);
}

function updateSettingsFromControls() {
  state.settings = {
    remindersEnabled: els.remindersEnabled.checked,
    quietEnabled: els.quietEnabled.checked,
    quietStart: els.quietStart.value || "22:00",
    quietEnd: els.quietEnd.value || "07:00",
  };

  saveSettings();
  syncSettingsControls();
  rescheduleAllReminders();
}

function fillSuggestions() {
  SUGGESTIONS.forEach((suggestion) => {
    const option = document.createElement("option");
    option.value = suggestion.title;
    option.textContent = suggestion.title;
    els.suggestedTask.append(option);
  });
}

function handleSuggestionChange() {
  const selected = SUGGESTIONS.find((item) => item.title === els.suggestedTask.value);
  if (!selected) return;

  els.title.value = selected.title;
  els.category.value = selected.category;
  els.priority.value = selected.priority;
  els.time.value = selected.time;
  els.repeat.value = selected.repeat || "none";
}

async function sendTestNotification() {
  if (!state.settings.remindersEnabled) {
    alert("Reminders are currently turned off.");
    return;
  }

  if (isDuringQuietTime(new Date())) {
    alert("Silent time is on right now, so reminders are muted.");
    return;
  }

  const allowed = await requestNotificationPermission();
  if (!allowed) return;

  window.setTimeout(() => {
    if (!state.settings.remindersEnabled || isDuringQuietTime(new Date())) return;

    new Notification("Life Planner test reminder", {
      body: "Your browser reminders are working.",
      tag: "life-planner-test",
    });
  }, 5000);

  alert("Test reminder scheduled for 5 seconds from now.");
}

function bindEvents() {
  els.form.addEventListener("submit", addTask);
  els.suggestedTask.addEventListener("change", handleSuggestionChange);
  els.testNotification.addEventListener("click", sendTestNotification);
  els.remindersEnabled.addEventListener("change", updateSettingsFromControls);
  els.quietEnabled.addEventListener("change", updateSettingsFromControls);
  els.quietStart.addEventListener("change", updateSettingsFromControls);
  els.quietEnd.addEventListener("change", updateSettingsFromControls);
}

fillSuggestions();
setDefaultFormDateTime();
loadTasks();
loadSettings();
syncSettingsControls();
refreshRepeatedTasks();
bindEvents();
rescheduleAllReminders();
render();
