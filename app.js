const STORAGE_KEY = 'taskflow_tasks';

const PRIORITY_LABEL = { low: '낮음', medium: '보통', high: '높음' };
const STATUS_OPTIONS = [
  { value: 'todo',       label: '할 일' },
  { value: 'inprogress', label: '진행 중' },
  { value: 'done',       label: '완료' },
];

let tasks = [];
let pendingDeleteId = null;
let editingId = null;

// ── Storage ───────────────────────────────────────────
function load() {
  try { tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { tasks = []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// ── Filter state ──────────────────────────────────────
function getFilter() {
  return {
    query:    document.getElementById('searchInput').value.trim().toLowerCase(),
    priority: document.getElementById('filterPriority').value,
  };
}

function matchesFilter(task, { query, priority }) {
  if (priority !== 'all' && task.priority !== priority) return false;
  if (query && !task.title.toLowerCase().includes(query) &&
               !task.desc.toLowerCase().includes(query)) return false;
  return true;
}

// ── Render ────────────────────────────────────────────
function render() {
  const filter = getFilter();
  const lists = {
    todo:       document.getElementById('list-todo'),
    inprogress: document.getElementById('list-inprogress'),
    done:       document.getElementById('list-done'),
  };

  Object.values(lists).forEach(el => (el.innerHTML = ''));
  const counts = { todo: 0, inprogress: 0, done: 0 };

  tasks.forEach(task => {
    counts[task.status]++;
    if (matchesFilter(task, filter)) {
      lists[task.status].appendChild(createCard(task));
    }
  });

  document.getElementById('count-todo').textContent       = counts.todo;
  document.getElementById('count-inprogress').textContent = counts.inprogress;
  document.getElementById('count-done').textContent       = counts.done;

  Object.entries(lists).forEach(([, el]) => {
    if (!el.hasChildNodes()) {
      el.innerHTML = '<p class="empty-state">업무가 없습니다</p>';
    }
  });
}

function createCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.id = task.id;
  card.draggable = true;

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
        <button class="btn-icon edit"   data-id="${task.id}" title="수정">✏️</button>
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

  card.querySelector('.btn-icon.edit').addEventListener('click', e => {
    e.stopPropagation();
    openModal(task.id);
  });
  card.querySelector('.btn-icon.delete').addEventListener('click', e => {
    e.stopPropagation();
    openDeleteModal(task.id);
  });
  card.querySelector('.task-status-select').addEventListener('change', e => {
    e.stopPropagation();
    changeStatus(task.id, e.target.value);
  });

  // Drag events
  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragend',   onDragEnd);

  return card;
}

// ── Task CRUD ─────────────────────────────────────────
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
  showToast('업무가 추가됐습니다');
}

function updateTask(id, title, desc, priority, due) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.title    = title;
  task.desc     = desc;
  task.priority = priority;
  task.due      = due;
  save();
  render();
  showToast('업무가 수정됐습니다');
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save();
  render();
  showToast('업무가 삭제됐습니다');
}

function changeStatus(id, status) {
  const task = tasks.find(t => t.id === id);
  if (task) { task.status = status; save(); render(); }
}

// ── Helpers ───────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${y}.${m}.${d}`;
}

function isOverdue(task) {
  return task.due && task.status !== 'done' &&
    new Date(task.due) < new Date(new Date().toDateString());
}

// ── Toast ─────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ── Modal: Add / Edit ─────────────────────────────────
const modalOverlay = document.getElementById('modalOverlay');
const modalTitleEl = document.getElementById('modalTitle');
const submitBtn    = document.getElementById('submitBtn');
const taskTitleEl  = document.getElementById('taskTitle');
const taskDescEl   = document.getElementById('taskDesc');
const taskPriorityEl = document.getElementById('taskPriority');
const taskDueEl    = document.getElementById('taskDue');

function openModal(id = null) {
  editingId = id;
  taskTitleEl.classList.remove('error');

  if (id) {
    const task = tasks.find(t => t.id === id);
    modalTitleEl.textContent = '업무 수정';
    submitBtn.textContent    = '저장';
    taskTitleEl.value    = task.title;
    taskDescEl.value     = task.desc;
    taskPriorityEl.value = task.priority;
    taskDueEl.value      = task.due || '';
  } else {
    modalTitleEl.textContent = '새 업무 추가';
    submitBtn.textContent    = '추가';
    taskTitleEl.value    = '';
    taskDescEl.value     = '';
    taskPriorityEl.value = 'medium';
    taskDueEl.value      = '';
  }

  modalOverlay.classList.add('active');
  setTimeout(() => taskTitleEl.focus(), 50);
}

function closeModal() {
  modalOverlay.classList.remove('active');
  editingId = null;
}

document.getElementById('openModalBtn').addEventListener('click', () => openModal());
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

submitBtn.addEventListener('click', () => {
  const title = taskTitleEl.value.trim();
  if (!title) { taskTitleEl.classList.add('error'); taskTitleEl.focus(); return; }

  if (editingId) {
    updateTask(editingId, title, taskDescEl.value.trim(), taskPriorityEl.value, taskDueEl.value);
  } else {
    addTask(title, taskDescEl.value.trim(), taskPriorityEl.value, taskDueEl.value);
  }
  closeModal();
});

taskTitleEl.addEventListener('input', () => taskTitleEl.classList.remove('error'));
taskTitleEl.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });

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

// ── Drag & Drop ───────────────────────────────────────
let dragId = null;

function onDragStart(e) {
  dragId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
}

document.querySelectorAll('.column').forEach(col => {
  col.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    col.classList.add('drag-over');
  });

  col.addEventListener('dragleave', e => {
    if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  });

  col.addEventListener('drop', e => {
    e.preventDefault();
    col.classList.remove('drag-over');
    if (!dragId) return;
    const newStatus = col.dataset.status;
    changeStatus(dragId, newStatus);
    dragId = null;
  });
});

// ── Search & Filter ───────────────────────────────────
document.getElementById('searchInput').addEventListener('input', render);
document.getElementById('filterPriority').addEventListener('change', render);

// ── Sample Data ───────────────────────────────────────
const SAMPLE_TASKS = [
  { id: 's1', title: '요구사항 분석 문서 작성', desc: '고객 미팅 내용을 바탕으로 기능 요구사항 정리', priority: 'high', due: '2026-05-20', status: 'todo', createdAt: '2026-05-15T09:00:00.000Z' },
  { id: 's2', title: 'UI 디자인 시안 검토', desc: 'Figma 시안 피드백 후 수정 요청사항 전달', priority: 'medium', due: '2026-05-22', status: 'todo', createdAt: '2026-05-15T10:00:00.000Z' },
  { id: 's3', title: 'API 명세서 작성', desc: 'REST API 엔드포인트 정의 및 Swagger 문서화', priority: 'high', due: '2026-05-19', status: 'inprogress', createdAt: '2026-05-14T09:00:00.000Z' },
  { id: 's4', title: '로그인 기능 개발', desc: 'JWT 기반 인증 구현 (소셜 로그인 포함)', priority: 'high', due: '2026-05-25', status: 'inprogress', createdAt: '2026-05-13T09:00:00.000Z' },
  { id: 's5', title: '데이터베이스 설계', desc: 'ERD 작성 및 테이블 스키마 정의 완료', priority: 'medium', due: '2026-05-14', status: 'done', createdAt: '2026-05-10T09:00:00.000Z' },
  { id: 's6', title: '개발 환경 세팅', desc: 'Docker 컨테이너 구성, CI/CD 파이프라인 초기 설정', priority: 'low', due: '2026-05-12', status: 'done', createdAt: '2026-05-09T09:00:00.000Z' },
];

// ── Init ──────────────────────────────────────────────
load();
if (tasks.length === 0) {
  tasks = SAMPLE_TASKS;
  save();
}
render();
