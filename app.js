const STORAGE_KEY = 'taskflow_tasks';

const PRIORITY_LABEL = { low: '낮음', medium: '보통', high: '높음' };
const STATUS_OPTIONS = [
  { value: 'todo',       label: '할 일' },
  { value: 'inprogress', label: '진행 중' },
  { value: 'done',       label: '완료' },
];

let tasks = [];
let pendingDeleteId = null;

// ── Storage ──────────────────────────────────────────
function load() {
  try { tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { tasks = []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// ── Render ───────────────────────────────────────────
function render() {
  const lists = {
    todo:       document.getElementById('list-todo'),
    inprogress: document.getElementById('list-inprogress'),
    done:       document.getElementById('list-done'),
  };

  Object.values(lists).forEach(el => (el.innerHTML = ''));

  const counts = { todo: 0, inprogress: 0, done: 0 };

  tasks.forEach(task => {
    counts[task.status]++;
    lists[task.status].appendChild(createCard(task));
  });

  document.getElementById('count-todo').textContent       = counts.todo;
  document.getElementById('count-inprogress').textContent = counts.inprogress;
  document.getElementById('count-done').textContent       = counts.done;

  Object.entries(lists).forEach(([status, el]) => {
    if (counts[status] === 0) {
      el.innerHTML = '<p class="empty-state">업무가 없습니다</p>';
    }
  });
}

function createCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.id = task.id;

  const dueHTML = task.due
    ? `<span class="due-date ${isOverdue(task) ? 'overdue' : ''}">📅 ${formatDate(task.due)}</span>`
    : '';

  const selectOptions = STATUS_OPTIONS.map(opt =>
    `<option value="${opt.value}" ${task.status === opt.value ? 'selected' : ''}>${opt.label}</option>`
  ).join('');

  card.innerHTML = `
    <div class="task-card-top">
      <span class="task-title">${escHtml(task.title)}</span>
      <div class="task-actions">
        <button class="btn-icon delete" data-id="${task.id}" title="삭제">🗑</button>
      </div>
    </div>
    ${task.desc ? `<p class="task-desc">${escHtml(task.desc)}</p>` : ''}
    <div class="task-meta">
      <span class="priority-badge ${task.priority}">${PRIORITY_LABEL[task.priority]}</span>
      ${dueHTML}
    </div>
    <select class="task-status-select" data-id="${task.id}">${selectOptions}</select>
  `;

  card.querySelector('.btn-icon.delete').addEventListener('click', () => openDeleteModal(task.id));
  card.querySelector('.task-status-select').addEventListener('change', e => changeStatus(task.id, e.target.value));

  return card;
}

// ── Task CRUD ────────────────────────────────────────
function addTask(title, desc, priority, due) {
  tasks.push({
    id: Date.now().toString(),
    title,
    desc,
    priority,
    due,
    status: 'todo',
    createdAt: new Date().toISOString(),
  });
  save();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save();
  render();
}

function changeStatus(id, status) {
  const task = tasks.find(t => t.id === id);
  if (task) { task.status = status; save(); render(); }
}

// ── Helpers ──────────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${y}.${m}.${d}`;
}

function isOverdue(task) {
  return task.due && task.status !== 'done' && new Date(task.due) < new Date(new Date().toDateString());
}

// ── Modal: Add ───────────────────────────────────────
const modalOverlay  = document.getElementById('modalOverlay');
const taskTitle     = document.getElementById('taskTitle');
const taskDesc      = document.getElementById('taskDesc');
const taskPriority  = document.getElementById('taskPriority');
const taskDue       = document.getElementById('taskDue');

function openModal() {
  taskTitle.value    = '';
  taskDesc.value     = '';
  taskPriority.value = 'medium';
  taskDue.value      = '';
  taskTitle.classList.remove('error');
  modalOverlay.classList.add('active');
  taskTitle.focus();
}

function closeModal() { modalOverlay.classList.remove('active'); }

document.getElementById('openModalBtn').addEventListener('click', openModal);
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);

modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

document.getElementById('submitBtn').addEventListener('click', () => {
  const title = taskTitle.value.trim();
  if (!title) { taskTitle.classList.add('error'); taskTitle.focus(); return; }
  addTask(title, taskDesc.value.trim(), taskPriority.value, taskDue.value);
  closeModal();
});

taskTitle.addEventListener('input', () => taskTitle.classList.remove('error'));

// Enter로 빠른 추가
taskTitle.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('submitBtn').click();
});

// ── Modal: Delete ─────────────────────────────────────
const deleteOverlay = document.getElementById('deleteOverlay');

function openDeleteModal(id) {
  pendingDeleteId = id;
  deleteOverlay.classList.add('active');
}

function closeDeleteModal() {
  pendingDeleteId = null;
  deleteOverlay.classList.remove('active');
}

document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
document.getElementById('deleteConfirmBtn').addEventListener('click', () => {
  if (pendingDeleteId) deleteTask(pendingDeleteId);
  closeDeleteModal();
});

deleteOverlay.addEventListener('click', e => { if (e.target === deleteOverlay) closeDeleteModal(); });

// ── Init ──────────────────────────────────────────────
load();
render();
