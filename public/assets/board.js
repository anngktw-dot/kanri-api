/* global document, fetch, localStorage, window, setTimeout, HTMLTemplateElement, URLSearchParams, FormData */

const token = localStorage.getItem('kanriAccessToken');
const kanban = document.querySelector('#kanban');
const boardMessage = document.querySelector('#board-message');
const userChip = document.querySelector('#user-chip');
const taskForm = document.querySelector('#task-form');
const columnForm = document.querySelector('#column-form');
const statusFilter = document.querySelector('#status-filter');
const userFilter = document.querySelector('#user-filter');
const resetFiltersButton = document.querySelector('#reset-filters');
const assigneeSelect = document.querySelector('#task-assignee');
const toastRegion = document.querySelector('#toast-region');
const taskCardTemplate = document.querySelector('#task-card-template');

const toastDuration = 4400;

let statuses = [];
let tasks = [];
let users = [];

if (!token) {
  window.location.assign('/login');
}

function setMessage(text) {
  if (boardMessage) {
    boardMessage.textContent = text;
  }
}

function showToast(text, state = 'error') {
  if (!toastRegion) {
    setMessage(text);
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.dataset.state = state;
  toast.setAttribute('role', state === 'error' ? 'alert' : 'status');
  toast.textContent = text;
  toastRegion.append(toast);

  setTimeout(() => {
    toast.dataset.leaving = 'true';
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, toastDuration);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    window.location.assign('/login');
    return null;
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message ?? 'Запит не виконано.');
  }

  return body;
}

function normalizeStatusName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function optionLabel(user) {
  return user.name ? `${user.name} · ${user.email}` : user.email;
}

function formatDate(value) {
  if (!value) {
    return 'Без дати';
  }

  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function fillSelect(select, options, placeholder) {
  if (!select) {
    return;
  }

  select.replaceChildren();

  if (placeholder) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.append(option);
  }

  options.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    select.append(option);
  });
}

function refreshControls() {
  const statusOptions = statuses.map((status) => ({
    value: status.name,
    label: status.name,
  }));
  const userOptions = users.map((user) => ({
    value: user.email,
    label: optionLabel(user),
  }));

  const previousStatusFilter = statusFilter?.value ?? '';
  const previousUserFilter = userFilter?.value ?? '';
  const previousAssignee = assigneeSelect?.value ?? '';

  fillSelect(statusFilter, statusOptions, 'Усі статуси');
  fillSelect(userFilter, userOptions, 'Усі користувачі');
  fillSelect(assigneeSelect, userOptions, 'Оберіть виконавця');

  if (statusFilter) {
    statusFilter.value = previousStatusFilter;
  }

  if (userFilter) {
    userFilter.value = previousUserFilter;
  }

  if (assigneeSelect) {
    assigneeSelect.value = previousAssignee || users[0]?.email || '';
  }
}

function ensureStatusForTasks() {
  const known = new Set(statuses.map((status) => normalizeStatusName(status.name)));

  tasks.forEach((task) => {
    const name = task.status;
    const key = normalizeStatusName(name);

    if (!known.has(key)) {
      known.add(key);
      statuses.push({
        id: key,
        name,
        position: statuses.length + 1,
      });
    }
  });
}

function taskMatchesFilters(task) {
  const selectedStatus = statusFilter?.value;
  const selectedUser = userFilter?.value;

  return (
    (!selectedStatus || normalizeStatusName(task.status) === normalizeStatusName(selectedStatus)) &&
    (!selectedUser || task.assignee?.email === selectedUser)
  );
}

function renderTask(task) {
  if (!(taskCardTemplate instanceof HTMLTemplateElement)) {
    return document.createElement('article');
  }

  const node = taskCardTemplate.content.firstElementChild.cloneNode(true);
  const title = node.querySelector('h2');
  const priority = node.querySelector('.priority');
  const description = node.querySelector('.task-description');
  const assignee = node.querySelector('[data-field="assignee"]');
  const deadline = node.querySelector('[data-field="deadline"]');
  const statusSelect = node.querySelector('[data-action="status"]');

  title.textContent = task.title;
  priority.textContent = task.priority ?? 'medium';
  priority.classList.add(String(task.priority ?? 'medium').toLowerCase());
  description.textContent = task.description || 'Опис не додано';
  assignee.textContent = task.assignee?.name || task.assignee?.email || 'Не призначено';
  deadline.textContent = formatDate(task.deadline);

  fillSelect(
    statusSelect,
    statuses.map((status) => ({ value: status.name, label: status.name })),
  );
  statusSelect.value = task.status;
  statusSelect.addEventListener('change', () =>
    updateTaskStatus(task.id, task.status, statusSelect.value),
  );

  return node;
}

function renderBoard() {
  if (!kanban) {
    return;
  }

  ensureStatusForTasks();
  refreshControls();
  kanban.replaceChildren();

  const visibleTasks = tasks.filter(taskMatchesFilters);

  statuses.forEach((status) => {
    const column = document.createElement('article');
    column.className = 'column';

    const header = document.createElement('header');
    header.className = 'column-header';

    const title = document.createElement('h2');
    title.className = 'column-title';
    title.textContent = status.name;

    const columnTasks = visibleTasks.filter(
      (task) => normalizeStatusName(task.status) === normalizeStatusName(status.name),
    );

    const count = document.createElement('span');
    count.className = 'column-count';
    count.textContent = String(columnTasks.length);

    const list = document.createElement('div');
    list.className = 'task-list';

    if (columnTasks.length) {
      columnTasks.forEach((task) => list.append(renderTask(task)));
    } else {
      const empty = document.createElement('p');
      empty.className = 'empty-column';
      empty.textContent = 'Немає задач';
      list.append(empty);
    }

    header.append(title, count);
    column.append(header, list);
    kanban.append(column);
  });

  setMessage(`${visibleTasks.length} задач у списку`);
}

async function loadBoard() {
  setMessage('Завантаження задач...');

  try {
    const [meBody, usersBody, statusesBody, tasksBody] = await Promise.all([
      api('/users/me'),
      api('/users'),
      api('/statuses'),
      api('/tasks'),
    ]);

    users = usersBody?.users ?? [];
    statuses = statusesBody?.statuses ?? [];
    tasks = tasksBody?.tasks ?? [];

    if (userChip && meBody?.user) {
      userChip.textContent = optionLabel(meBody.user);
    }

    renderBoard();
  } catch (error) {
    setMessage(error.message);
    showToast(error.message);
  }
}

async function loadTasksWithFilters() {
  const params = new URLSearchParams();

  if (statusFilter?.value) {
    params.set('status', statusFilter.value);
  }

  if (userFilter?.value) {
    params.set('assignee', userFilter.value);
  }

  try {
    const body = await api(`/tasks${params.toString() ? `?${params}` : ''}`);
    tasks = body?.tasks ?? [];
    renderBoard();
  } catch (error) {
    showToast(error.message);
  }
}

async function createTask(event) {
  event.preventDefault();

  const data = new FormData(taskForm);
  const title = String(data.get('title') ?? '').trim();
  const assignee = String(data.get('assignee') ?? '').trim();
  const priority = String(data.get('priority') ?? 'medium');

  if (!title || !assignee) {
    showToast('Вкажіть назву задачі та виконавця.');
    return;
  }

  const button = taskForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const body = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, assignee, priority }),
    });

    tasks = [body.task, ...tasks];
    taskForm.reset();
    refreshControls();
    renderBoard();
    showToast('Задачу створено.', 'success');
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
}

async function updateTaskStatus(taskId, previousStatus, nextStatus) {
  const task = tasks.find((item) => item.id === taskId);

  if (!task || normalizeStatusName(previousStatus) === normalizeStatusName(nextStatus)) {
    return;
  }

  task.status = nextStatus;
  renderBoard();

  try {
    const body = await api(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });

    tasks = tasks.map((item) => (item.id === taskId ? body.task : item));
    renderBoard();
    showToast('Статус оновлено.', 'success');
  } catch (error) {
    task.status = previousStatus;
    renderBoard();
    showToast(error.message);
  }
}

async function createColumn(event) {
  event.preventDefault();

  const data = new FormData(columnForm);
  const name = String(data.get('name') ?? '').trim();

  if (!name) {
    showToast('Вкажіть назву колонки.');
    return;
  }

  const button = columnForm.querySelector('button[type="submit"]');
  button.disabled = true;

  try {
    const body = await api('/statuses', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });

    statuses = [...statuses, body.status].sort((a, b) => a.position - b.position);
    columnForm.reset();
    renderBoard();
    showToast('Колонку додано.', 'success');
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
}

taskForm?.addEventListener('submit', createTask);
columnForm?.addEventListener('submit', createColumn);
statusFilter?.addEventListener('change', loadTasksWithFilters);
userFilter?.addEventListener('change', loadTasksWithFilters);
resetFiltersButton?.addEventListener('click', () => {
  if (statusFilter) {
    statusFilter.value = '';
  }

  if (userFilter) {
    userFilter.value = '';
  }

  loadTasksWithFilters();
});

loadBoard();
