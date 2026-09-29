// Daymark keeps your tasks in this browser using localStorage.
const STORAGE_KEY = 'daymark-tasks-v1';
const categories = { work: 'Work', personal: 'Personal', learning: 'Learning' };
const state = { tasks: loadTasks(), view: 'all', category: 'all', search: '', sort: 'priority' };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const elements = {
  list: $('#task-list'), empty: $('#empty-state'), dialog: $('#task-dialog'), form: $('#task-form'),
  title: $('#task-title'), notes: $('#task-notes'), category: $('#task-category'), deadline: $('#task-deadline'),
  urgency: $('#task-urgency'), importance: $('#task-importance'), effort: $('#task-effort'),
};

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks)); }
function dateOnly(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function daysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateString}T00:00:00`);
  return Math.round((dateOnly(target) - dateOnly(new Date())) / 86400000);
}
function scoreTask(task) {
  const urgency = Number(task.urgency) / 3;
  const importance = Number(task.importance) / 3;
  const effortBoost = (4 - Number(task.effort)) / 3;
  const days = daysUntil(task.deadline);
  let deadline = days === null ? 0.45 : days < 0 ? 1 : days === 0 ? 1 : days <= 2 ? .9 : days <= 7 ? .75 : days <= 14 ? .6 : .4;
  // A close deadline adds urgency while importance and effort stay personal choices.
  const raw = urgency * 30 + importance * 35 + deadline * 25 + effortBoost * 10;
  return Math.round(raw);
}
function priorityLabel(score) { return score >= 72 ? 'High priority' : score >= 48 ? 'Medium priority' : 'Low priority'; }
function formatDue(dateString) {
  const days = daysUntil(dateString);
  if (days === null) return '';
  if (days < 0) return `Overdue · ${Math.abs(days)}d`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${dateString}T00:00:00`))}`;
}
function escapeHTML(value = '') { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function visibleTasks() {
  let result = [...state.tasks];
  if (state.view === 'completed') result = result.filter((task) => task.done);
  else result = result.filter((task) => !task.done);
  if (state.view === 'today') result = result.filter((task) => !task.deadline || daysUntil(task.deadline) <= 0);
  if (state.view === 'upcoming') result = result.filter((task) => task.deadline && daysUntil(task.deadline) > 0);
  if (state.category !== 'all') result = result.filter((task) => task.category === state.category);
  if (state.search.trim()) {
    const needle = state.search.toLowerCase();
    result = result.filter((task) => `${task.title} ${task.notes}`.toLowerCase().includes(needle));
  }
  result.sort((a, b) => {
    if (state.sort === 'deadline') return (daysUntil(a.deadline) ?? Infinity) - (daysUntil(b.deadline) ?? Infinity);
    if (state.sort === 'effort') return Number(a.effort) - Number(b.effort);
    return (b.done - a.done) || scoreTask(b) - scoreTask(a);
  });
  return result;
}
function render() {
  const active = state.tasks.filter((task) => !task.done);
  const today = active.filter((task) => task.deadline && daysUntil(task.deadline) <= 0);
  const completed = state.tasks.filter((task) => task.done).length;
  $('#all-count').textContent = active.length;
  $('#today-count').textContent = today.length;
  $('#chip-all').textContent = active.length;
  for (const category of Object.keys(categories)) $(`#chip-${category}`).textContent = active.filter((task) => task.category === category).length;
  const doneToday = state.tasks.filter((task) => task.done && task.completedAt && dateOnly(new Date(task.completedAt)).getTime() === dateOnly(new Date()).getTime()).length;
  const progress = active.length + doneToday ? Math.round(doneToday / (active.length + doneToday) * 100) : 0;
  $('#progress-number').textContent = `${progress}%`;
  $('#progress-ring').style.background = `conic-gradient(#a5ccae ${progress * 3.6}deg,rgba(255,255,255,.18) ${progress * 3.6}deg)`;
  $('#progress-tasks').textContent = `${doneToday} of ${active.length + doneToday} tasks`;
  $('#progress-heading').textContent = active.length === 0 && doneToday === 0 ? 'You’re off to a fresh start.' : active.length === 0 ? 'You made it happen.' : 'One thing at a time.';
  $('#progress-sub').textContent = active.length === 0 && doneToday === 0 ? 'Add a task and make today count.' : active.length === 0 ? 'Your tasks are wrapped up for today.' : `${active.length} ${active.length === 1 ? 'task' : 'tasks'} ready for your attention.`;
  const labels = { all: 'All tasks', today: 'Today', upcoming: 'Upcoming', completed: 'Completed' };
  $('#breadcrumb-label').textContent = labels[state.view];
  $('#page-title').innerHTML = `${labels[state.view]}<span class="title-period">.</span>`;
  $('#page-subtitle').textContent = state.view === 'today' ? 'What needs your attention today?' : state.view === 'upcoming' ? 'A little look at what’s ahead.' : state.view === 'completed' ? 'Look at everything you’ve accomplished.' : 'A little progress, thoughtfully prioritized.';
  $('#list-heading').textContent = state.view === 'completed' ? 'Done and dusted' : state.view === 'today' ? 'For today' : state.view === 'upcoming' ? 'Coming up' : 'Your priorities';
  $('#list-caption').textContent = state.view === 'completed' ? 'Every finished task is a small win' : state.sort === 'priority' ? 'Sorted by what needs your attention first' : state.sort === 'deadline' ? 'Sorted by the closest due date' : 'Sorted by the quickest tasks first';
  $('#today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();
  const tasks = visibleTasks();
  elements.list.innerHTML = tasks.map((task) => {
    const score = scoreTask(task), due = formatDue(task.deadline), days = daysUntil(task.deadline);
    const dueClass = days < 0 ? 'late' : days <= 1 ? 'soon' : '';
    return `<article class="task-card ${task.done ? 'done' : ''}" data-id="${escapeHTML(task.id)}">
      <button class="check-button" data-action="toggle" aria-label="${task.done ? 'Mark incomplete' : 'Mark complete'}: ${escapeHTML(task.title)}"></button>
      <div class="task-main"><div class="task-name">${escapeHTML(task.title)}</div>${task.notes ? `<div class="task-notes">${escapeHTML(task.notes)}</div>` : ''}<div class="task-meta"><span class="task-category ${escapeHTML(task.category)}">${categories[task.category] || 'Work'}</span>${due ? `<span class="deadline ${dueClass}">◷ ${escapeHTML(due)}</span>` : ''}<span class="effort-tag">${['', 'Quick win', 'A little while', 'Big chunk'][Number(task.effort)]}</span></div></div>
      <div class="task-right"><span class="priority-badge ${score >= 72 ? 'high' : score < 48 ? 'low' : ''}"><i class="priority-dot"></i>${priorityLabel(score)}</span><span class="score-badge">${score}</span><button class="task-more" data-action="edit" aria-label="Edit ${escapeHTML(task.title)}">···</button></div>
    </article>`;
  }).join('');
  const noTasks = tasks.length === 0;
  elements.empty.classList.toggle('visible', noTasks);
  elements.list.style.display = noTasks ? 'none' : 'grid';
  $('#empty-title').textContent = state.search ? 'No matching tasks.' : state.view === 'completed' ? 'Nothing completed just yet.' : 'A clear mind starts here.';
  $('#empty-copy').textContent = state.search ? 'Try another search, or clear the search box to see all your tasks.' : state.view === 'completed' ? 'Finish a task and it’ll find a home here.' : 'Add your first task and we’ll help you decide what deserves your attention.';
  $('#empty-add').style.display = state.view === 'completed' || state.search ? 'none' : '';
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.filter === state.view));
  $$('.chip').forEach((item) => item.classList.toggle('selected', item.dataset.category === state.category));
  $('#sort-button').innerHTML = `↕ <span>${state.sort === 'priority' ? 'Priority' : state.sort === 'deadline' ? 'Deadline' : 'Effort'}</span>`;
}
function openTask(task = null) {
  elements.form.reset();
  $('#task-id').value = task?.id || '';
  elements.title.value = task?.title || '';
  elements.notes.value = task?.notes || '';
  elements.category.value = task?.category || 'work';
  elements.deadline.value = task?.deadline || '';
  elements.urgency.value = task?.urgency || '2';
  elements.importance.value = task?.importance || '2';
  elements.effort.value = task?.effort || '2';
  $('#dialog-title').textContent = task ? 'Edit task' : 'Add a task';
  $('#save-button').textContent = task ? 'Save changes' : 'Add task';
  $('#delete-task').classList.toggle('hidden', !task);
  updateScorePreview();
  elements.dialog.showModal();
  elements.title.focus();
}
function updateScorePreview() {
  $('#score-preview').textContent = `${scoreTask({ urgency: elements.urgency.value, importance: elements.importance.value, effort: elements.effort.value, deadline: elements.deadline.value })} / 100`;
}

$$('.nav-item').forEach((item) => item.addEventListener('click', () => { state.view = item.dataset.filter; state.category = 'all'; render(); }));
$$('.chip').forEach((item) => item.addEventListener('click', () => { state.category = item.dataset.category; render(); }));
$('#new-task-button').addEventListener('click', () => openTask());
$('#empty-add').addEventListener('click', () => openTask());
$('#close-dialog').addEventListener('click', () => elements.dialog.close());
$('#cancel-dialog').addEventListener('click', () => elements.dialog.close());
$('#search-input').addEventListener('input', (event) => { state.search = event.target.value; render(); });
$('#sort-button').addEventListener('click', () => { state.sort = state.sort === 'priority' ? 'deadline' : state.sort === 'deadline' ? 'effort' : 'priority'; render(); });
[elements.urgency, elements.importance, elements.effort, elements.deadline].forEach((input) => input.addEventListener('input', updateScorePreview));
elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const id = $('#task-id').value;
  const existing = state.tasks.find((task) => task.id === id);
  const task = { id: id || (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`), title: elements.title.value.trim(), notes: elements.notes.value.trim(), category: elements.category.value, deadline: elements.deadline.value, urgency: elements.urgency.value, importance: elements.importance.value, effort: elements.effort.value, done: existing?.done || false, completedAt: existing?.completedAt || null, createdAt: existing?.createdAt || new Date().toISOString() };
  if (existing) Object.assign(existing, task); else state.tasks.push(task);
  saveTasks(); elements.dialog.close(); render();
});
elements.list.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const task = state.tasks.find((item) => item.id === button.closest('.task-card')?.dataset.id);
  if (!task) return;
  if (button.dataset.action === 'toggle') { task.done = !task.done; task.completedAt = task.done ? new Date().toISOString() : null; saveTasks(); render(); }
  if (button.dataset.action === 'edit') openTask(task);
});
$('#delete-task').addEventListener('click', () => {
  const id = $('#task-id').value;
  if (!id || !confirm('Delete this task? This can’t be undone.')) return;
  state.tasks = state.tasks.filter((task) => task.id !== id);
  saveTasks(); elements.dialog.close(); render();
});
$('#how-button').addEventListener('click', () => $('#help-dialog').showModal());
$('#close-help').addEventListener('click', () => $('#help-dialog').close());
$('#help-done').addEventListener('click', () => $('#help-dialog').close());
$('#header-date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
render();
