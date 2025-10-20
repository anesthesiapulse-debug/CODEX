const STORAGE_KEY = 'pomodoroPlannerState_v1';
const DEFAULT_STATE = {
  groups: [],
  subgroups: [],
  tasks: [],
  settings: {
    focusDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    continuousGoal: 60,
    theme: 'blue'
  },
  activeTaskId: null,
  pomodoroLog: []
};

let storageFallback = false;
const storage = createSafeStorage();

const elements = {
  body: document.body,
  taskForm: document.getElementById('task-form'),
  taskTitle: document.getElementById('task-title'),
  taskNotes: document.getElementById('task-notes'),
  taskDocument: document.getElementById('task-document'),
  taskTags: document.getElementById('task-tags'),
  groupSelect: document.getElementById('group-select'),
  newGroupWrapper: document.getElementById('new-group-wrapper'),
  newGroupName: document.getElementById('new-group-name'),
  subgroupSelect: document.getElementById('subgroup-select'),
  newSubgroupWrapper: document.getElementById('new-subgroup-wrapper'),
  newSubgroupName: document.getElementById('new-subgroup-name'),
  cancelEdit: document.getElementById('cancel-edit'),
  tasksContainer: document.getElementById('tasks-container'),
  taskTemplate: document.getElementById('task-template'),
  searchInput: document.getElementById('task-search'),
  groupSummary: document.getElementById('group-summary'),
  tagSummary: document.getElementById('tag-summary'),
  analytics: document.getElementById('analytics'),
  activeTaskName: document.getElementById('active-task-name'),
  pomodoroDisplay: document.getElementById('pomodoro-display'),
  pomodoroCount: document.getElementById('pomodoro-count'),
  currentBlockLabel: document.getElementById('current-block-label'),
  focusDuration: document.getElementById('focus-duration'),
  breakDuration: document.getElementById('break-duration'),
  longBreakDuration: document.getElementById('long-break-duration'),
  longBreakInterval: document.getElementById('long-break-interval'),
  continuousSettings: document.getElementById('continuous-settings'),
  pomodoroSettings: document.getElementById('pomodoro-settings'),
  continuousGoal: document.getElementById('continuous-goal'),
  timerStart: document.getElementById('timer-start'),
  timerPause: document.getElementById('timer-pause'),
  timerReset: document.getElementById('timer-reset'),
  timerSkip: document.getElementById('timer-skip'),
  stopwatchDisplay: document.getElementById('stopwatch-display'),
  stopwatchStart: document.getElementById('stopwatch-start'),
  stopwatchPause: document.getElementById('stopwatch-pause'),
  stopwatchReset: document.getElementById('stopwatch-reset'),
  themeSelect: document.getElementById('theme-select'),
  storageWarning: document.getElementById('storage-warning')
};

let state = loadState();
let editingTaskId = null;
let filterTerm = '';
let timerInterval = null;
let timerMode = 'pomodoro';
let timerStage = 'focus';
let remainingSeconds = state.settings.focusDuration * 60;
let pomodorosSinceLongBreak = 0;
let continuousElapsed = 0;
let stopwatchInterval = null;
let stopwatchElapsed = 0;
let previousWasLongBreak = false;

initialise();

function initialise() {
  seedDefaultData();
  applyTheme(state.settings.theme || 'blue');
  elements.themeSelect.value = state.settings.theme || 'blue';
  attachEventListeners();
  updateTimerInputsFromState();
  renderAll();
  updateStorageWarning();
}

function seedDefaultData() {
  if (state.groups.length === 0 && state.tasks.length === 0) {
    const saludId = createGroup('Salud');
    const cardioId = createSubgroup('Cardiología', saludId);
    const endoId = createSubgroup('Endocrinología', saludId);
    state.tasks.push(
      createTaskObject({
        title: '🫀 Repaso de fisiología cardíaca',
        notes: 'Revisar flujo coronario y patologías comunes. Priorizar casos clínicos.',
        document: '',
        groupId: saludId,
        subgroupId: cardioId,
        tags: ['#salud', '#cardiología', '#repaso']
      }),
      createTaskObject({
        title: '🧪 Actualizar esquema de hormonas',
        notes: 'Complementar con nueva guía 2024 y añadir resumen visual.',
        document: '',
        groupId: saludId,
        subgroupId: endoId,
        tags: ['#salud', '#endocrinología', '#notas']
      })
    );
    saveState();
  }
}

function loadState() {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return deepClone(DEFAULT_STATE);
    }
    const parsed = JSON.parse(raw);
    return {
      ...deepClone(DEFAULT_STATE),
      ...parsed,
      settings: { ...deepClone(DEFAULT_STATE.settings), ...parsed.settings }
    };
  } catch (error) {
    console.error('Error al cargar datos, se reiniciará el estado.', error);
    return deepClone(DEFAULT_STATE);
  }
}

function saveState() {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('No se pudo guardar la información de manera persistente.', error);
  }
  updateStorageWarning();
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function attachEventListeners() {
  elements.taskForm.addEventListener('submit', handleTaskSubmit);
  elements.groupSelect.addEventListener('change', handleGroupSelectionChange);
  elements.subgroupSelect.addEventListener('change', handleSubgroupSelectionChange);
  elements.cancelEdit.addEventListener('click', cancelTaskEditing);
  elements.searchInput.addEventListener('input', (event) => {
    filterTerm = event.target.value.toLowerCase();
    renderTaskBoard();
  });
  elements.themeSelect.addEventListener('change', (event) => {
    applyTheme(event.target.value);
  });
  document.querySelectorAll('input[name="timer-mode"]').forEach((input) => {
    input.addEventListener('change', handleTimerModeChange);
  });
  elements.focusDuration.addEventListener('change', () => updateSettingNumber('focusDuration', elements.focusDuration.valueAsNumber));
  elements.breakDuration.addEventListener('change', () => updateSettingNumber('breakDuration', elements.breakDuration.valueAsNumber));
  elements.longBreakDuration.addEventListener('change', () => updateSettingNumber('longBreakDuration', elements.longBreakDuration.valueAsNumber));
  elements.longBreakInterval.addEventListener('change', () => updateSettingNumber('longBreakInterval', elements.longBreakInterval.valueAsNumber));
  elements.continuousGoal.addEventListener('change', () => updateSettingNumber('continuousGoal', elements.continuousGoal.valueAsNumber));
  elements.timerStart.addEventListener('click', startTimer);
  elements.timerPause.addEventListener('click', pauseTimer);
  elements.timerReset.addEventListener('click', resetTimer);
  elements.timerSkip.addEventListener('click', skipTimerStage);
  elements.stopwatchStart.addEventListener('click', startStopwatch);
  elements.stopwatchPause.addEventListener('click', pauseStopwatch);
  elements.stopwatchReset.addEventListener('click', resetStopwatch);
}

function updateSettingNumber(key, value) {
  if (!Number.isFinite(value) || value <= 0) {
    return;
  }
  state.settings[key] = value;
  saveState();
  if (timerMode === 'pomodoro') {
    if (!timerInterval) {
      if (key === 'focusDuration' && timerStage === 'focus') {
        remainingSeconds = value * 60;
      }
      if (key === 'breakDuration' && timerStage === 'break') {
        remainingSeconds = value * 60;
      }
    }
    updateTimerDisplay();
  } else if (timerMode === 'continuous' && key === 'continuousGoal') {
    if (!timerInterval) {
      continuousElapsed = 0;
    }
    updateTimerDisplay();
  }
}

function handleGroupSelectionChange() {
  const value = elements.groupSelect.value;
  const isNew = value === '__new__';
  elements.newGroupWrapper.classList.toggle('hidden', !isNew);
  elements.newGroupName.required = isNew;
  elements.subgroupSelect.disabled = isNew;
  if (isNew) {
    elements.newSubgroupWrapper.classList.remove('hidden');
    elements.newSubgroupName.required = false;
    elements.subgroupSelect.innerHTML = '';
  } else {
    populateSubgroupOptions(value);
  }
}

function handleSubgroupSelectionChange() {
  const value = elements.subgroupSelect.value;
  const isNew = value === '__new__';
  elements.newSubgroupWrapper.classList.toggle('hidden', !isNew);
  elements.newSubgroupName.required = isNew;
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const title = elements.taskTitle.value.trim();
  if (!title) return;

  const typedNewGroupName = elements.newGroupName.value.trim();
  const typedNewSubgroupName = elements.newSubgroupName.value.trim();
  let groupId = elements.groupSelect.value;
  if (!groupId) {
    alert('Selecciona o crea un grupo.');
    return;
  }

  if (groupId === '__new__') {
    if (!typedNewGroupName) {
      alert('Introduce un nombre para el nuevo grupo.');
      return;
    }
    groupId = createGroup(typedNewGroupName);
    elements.newGroupName.value = '';
  }

  let subgroupId = elements.subgroupSelect.value;
  if (!subgroupId || subgroupId === '__none__') {
    subgroupId = null;
  }

  if (subgroupId === '__new__' || (!subgroupId && typedNewSubgroupName)) {
    if (!typedNewSubgroupName) {
      alert('Introduce un nombre para el nuevo subgrupo.');
      return;
    }
    subgroupId = createSubgroup(typedNewSubgroupName, groupId);
  }

  elements.newSubgroupName.value = '';

  const notes = elements.taskNotes.value.trim();
  const documentUrl = elements.taskDocument.value.trim();
  const tags = parseTags(elements.taskTags.value);

  if (editingTaskId) {
    updateExistingTask(editingTaskId, { title, notes, document: documentUrl, groupId, subgroupId, tags });
  } else {
    const newTask = createTaskObject({ title, notes, document: documentUrl, groupId, subgroupId, tags });
    state.tasks.push(newTask);
  }

  saveState();
  renderAll();
  elements.taskForm.reset();
  editingTaskId = null;
  elements.cancelEdit.classList.add('hidden');
  handleGroupSelectionChange();
  elements.taskForm.querySelector('button[type="submit"]').textContent = 'Guardar tarea';
}

function cancelTaskEditing() {
  editingTaskId = null;
  elements.taskForm.reset();
  elements.cancelEdit.classList.add('hidden');
  elements.taskForm.querySelector('button[type="submit"]').textContent = 'Guardar tarea';
  handleGroupSelectionChange();
}

function createTaskObject({ title, notes = '', document = '', groupId, subgroupId = null, tags = [] }) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    notes,
    document,
    groupId,
    subgroupId,
    tags,
    pomodorosCompleted: 0,
    totalFocusMinutes: 0,
    createdAt: Date.now()
  };
}

function updateExistingTask(id, changes) {
  const task = state.tasks.find((task) => task.id === id);
  if (!task) return;
  Object.assign(task, changes);
}

function createGroup(name) {
  const id = crypto.randomUUID ? crypto.randomUUID() : `group-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  state.groups.push({ id, name });
  saveState();
  populateGroupOptions(id);
  elements.groupSelect.value = id;
  handleGroupSelectionChange();
  return id;
}

function createSubgroup(name, groupId) {
  const id = crypto.randomUUID ? crypto.randomUUID() : `subgroup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  state.subgroups.push({ id, groupId, name });
  saveState();
  populateSubgroupOptions(groupId, id);
  elements.subgroupSelect.value = id;
  handleSubgroupSelectionChange();
  return id;
}

function parseTags(raw) {
  if (!raw) return [];
  return Array.from(new Set(raw
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
    .slice(0, 12)));
}

function populateGroupOptions(selectedId = null) {
  elements.groupSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecciona un grupo';
  placeholder.disabled = true;
  placeholder.selected = true;
  elements.groupSelect.appendChild(placeholder);

  const sortedGroups = [...state.groups].sort((a, b) => a.name.localeCompare(b.name));
  for (const group of sortedGroups) {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name;
    if (selectedId && selectedId === group.id) {
      option.selected = true;
      placeholder.selected = false;
    }
    elements.groupSelect.appendChild(option);
  }

  const newOption = document.createElement('option');
  newOption.value = '__new__';
  newOption.textContent = '➕ Crear nuevo grupo';
  elements.groupSelect.appendChild(newOption);

  if (selectedId === '__new__') {
    newOption.selected = true;
    placeholder.selected = false;
  }
  handleGroupSelectionChange();
}

function populateSubgroupOptions(groupId, selectedId = null) {
  elements.subgroupSelect.innerHTML = '';
  if (!groupId) return;

  const subgroups = state.subgroups.filter((subgroup) => subgroup.groupId === groupId);
  const baseOption = document.createElement('option');
  baseOption.value = '__none__';
  baseOption.textContent = 'Sin subgrupo';
  elements.subgroupSelect.appendChild(baseOption);

  for (const subgroup of subgroups.sort((a, b) => a.name.localeCompare(b.name))) {
    const option = document.createElement('option');
    option.value = subgroup.id;
    option.textContent = subgroup.name;
    if (selectedId && selectedId === subgroup.id) {
      option.selected = true;
      baseOption.selected = false;
    }
    elements.subgroupSelect.appendChild(option);
  }

  const newOption = document.createElement('option');
  newOption.value = '__new__';
  newOption.textContent = '➕ Nuevo subgrupo';
  elements.subgroupSelect.appendChild(newOption);

  elements.subgroupSelect.disabled = false;
  handleSubgroupSelectionChange();
}

function renderAll() {
  populateGroupOptions();
  renderTaskBoard();
  renderSummaries();
  renderAnalytics();
  renderActiveTask();
  updatePomodoroCount();
  updateTimerDisplay();
}

function renderTaskBoard() {
  elements.tasksContainer.innerHTML = '';
  const groupedTasks = groupTasksByHierarchy();

  if (groupedTasks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Aún no tienes tareas registradas. ¡Crea tu primera tarea para comenzar!';
    elements.tasksContainer.appendChild(empty);
    return;
  }

  for (const group of groupedTasks) {
    const groupSection = document.createElement('section');
    groupSection.className = 'group-column';

    const title = document.createElement('h3');
    title.textContent = group.name;
    groupSection.appendChild(title);

    for (const subgroup of group.subgroups) {
      const subgroupSection = document.createElement('section');
      subgroupSection.className = 'subgroup-section';

      const subgroupTitle = document.createElement('div');
      subgroupTitle.className = 'subgroup-title';
      subgroupTitle.innerHTML = `<strong>${subgroup.name}</strong><span>${subgroup.tasks.length} tarea(s)</span>`;
      subgroupSection.appendChild(subgroupTitle);

      const list = document.createElement('div');
      list.className = 'task-list';

      subgroup.tasks.forEach((task) => {
        const card = renderTaskCard(task);
        list.appendChild(card);
      });

      subgroupSection.appendChild(list);
      groupSection.appendChild(subgroupSection);
    }

    elements.tasksContainer.appendChild(groupSection);
  }
}

function groupTasksByHierarchy() {
  const term = filterTerm.trim();
  const tasks = state.tasks.filter((task) => {
    if (!term) return true;
    const text = [task.title, task.notes, ...(task.tags || [])].join(' ').toLowerCase();
    return text.includes(term.toLowerCase());
  });

  const groups = state.groups.map((group) => ({
    id: group.id,
    name: group.name,
    subgroups: []
  }));

  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const subgroupMap = new Map();

  for (const subgroup of state.subgroups) {
    const parent = groupMap.get(subgroup.groupId);
    if (!parent) continue;
    const subgroupEntry = {
      id: subgroup.id,
      name: subgroup.name,
      tasks: []
    };
    parent.subgroups.push(subgroupEntry);
    subgroupMap.set(subgroup.id, subgroupEntry);
  }

  // Ensure every group has at least one subgroup container
  for (const group of groups) {
    const noSubgroupContainer = {
      id: '__none__',
      name: 'Sin subgrupo',
      tasks: []
    };
    group.subgroups.push(noSubgroupContainer);
    subgroupMap.set(`none-${group.id}`, noSubgroupContainer);
  }

  for (const task of tasks) {
    const group = groupMap.get(task.groupId);
    if (!group) continue;
    let subgroup;
    if (task.subgroupId) {
      subgroup = subgroupMap.get(task.subgroupId);
    }
    if (!subgroup) {
      subgroup = subgroupMap.get(`none-${group.id}`);
    }
    subgroup.tasks.push(task);
  }

  const filledGroups = groups
    .map((group) => ({
      ...group,
      subgroups: group.subgroups
        .map((subgroup) => ({
          ...subgroup,
          tasks: subgroup.tasks.sort((a, b) => a.createdAt - b.createdAt)
        }))
        .filter((subgroup) => subgroup.tasks.length > 0)
    }))
    .filter((group) => group.subgroups.length > 0);

  return filledGroups.sort((a, b) => a.name.localeCompare(b.name));
}

function renderTaskCard(task) {
  const fragment = elements.taskTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.task-card');
  card.dataset.taskId = task.id;
  if (state.activeTaskId === task.id) {
    card.classList.add('is-active');
  }

  fragment.querySelector('.task-title').textContent = task.title;
  fragment.querySelector('.task-notes').textContent = task.notes || 'Sin notas adicionales';

  const documentParagraph = fragment.querySelector('.task-document');
  if (task.document) {
    documentParagraph.innerHTML = `📄 <a href="${task.document}" target="_blank" rel="noopener">Documento / enlace</a>`;
  } else {
    documentParagraph.textContent = 'Sin documento asociado';
  }

  const tagsContainer = fragment.querySelector('.task-tags');
  if (task.tags && task.tags.length > 0) {
    task.tags.forEach((tag) => {
      const tagChip = document.createElement('span');
      tagChip.className = 'tag-chip';
      tagChip.textContent = tag;
      tagsContainer.appendChild(tagChip);
    });
  } else {
    const noTags = document.createElement('span');
    noTags.className = 'tag-chip';
    noTags.textContent = '#sin-etiquetas';
    tagsContainer.appendChild(noTags);
  }

  fragment.querySelector('.pomodoro-count').textContent = `${task.pomodorosCompleted} pomodoro(s)`;
  fragment.querySelector('.total-focus').textContent = `${Math.round(task.totalFocusMinutes)} min de foco`;

  fragment.querySelector('[data-action="activate"]').addEventListener('click', () => {
    state.activeTaskId = task.id;
    saveState();
    renderActiveTask();
  });

  fragment.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTask(task.id));
  fragment.querySelector('[data-action="edit"]').addEventListener('click', () => startEditingTask(task.id));

  return fragment;
}

function startEditingTask(taskId) {
  const task = state.tasks.find((task) => task.id === taskId);
  if (!task) return;
  editingTaskId = taskId;
  elements.taskTitle.value = task.title;
  elements.taskNotes.value = task.notes;
  elements.taskDocument.value = task.document;
  elements.taskTags.value = (task.tags || []).join(' ');
  populateGroupOptions(task.groupId);
  populateSubgroupOptions(task.groupId, task.subgroupId || '__none__');
  if (!task.subgroupId) {
    elements.subgroupSelect.value = '__none__';
  }
  elements.taskForm.querySelector('button[type="submit"]').textContent = 'Actualizar tarea';
  elements.cancelEdit.classList.remove('hidden');
  elements.taskTitle.focus();
}

function deleteTask(taskId) {
  const task = state.tasks.find((task) => task.id === taskId);
  if (!task) return;
  if (!confirm(`¿Eliminar la tarea "${task.title}"?`)) return;
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  if (state.activeTaskId === taskId) {
    state.activeTaskId = null;
  }
  saveState();
  renderAll();
}

function renderSummaries() {
  renderGroupSummary();
  renderTagSummary();
}

function renderGroupSummary() {
  elements.groupSummary.innerHTML = '';
  const summary = new Map();
  for (const task of state.tasks) {
    const group = state.groups.find((group) => group.id === task.groupId);
    if (!group) continue;
    const data = summary.get(group.id) || { label: group.name, pomodoros: 0, minutes: 0 };
    data.pomodoros += task.pomodorosCompleted;
    data.minutes += task.totalFocusMinutes;
    summary.set(group.id, data);
  }
  if (summary.size === 0) {
    elements.groupSummary.innerHTML = '<p class="theme-note">No hay pomodoros registrados todavía.</p>';
    return;
  }
  const entries = Array.from(summary.values()).sort((a, b) => b.pomodoros - a.pomodoros);
  for (const entry of entries) {
    const div = document.createElement('div');
    div.className = 'summary-entry';
    div.innerHTML = `<span class="label">${entry.label}</span><span class="value">${entry.pomodoros} · ${Math.round(entry.minutes)} min</span>`;
    elements.groupSummary.appendChild(div);
  }
}

function renderTagSummary() {
  elements.tagSummary.innerHTML = '';
  const summary = new Map();
  for (const task of state.tasks) {
    for (const tag of task.tags || []) {
      const entry = summary.get(tag) || { label: tag, pomodoros: 0 };
      entry.pomodoros += task.pomodorosCompleted;
      summary.set(tag, entry);
    }
  }
  if (summary.size === 0) {
    elements.tagSummary.innerHTML = '<p class="theme-note">Añade etiquetas con # para ver métricas.</p>';
    return;
  }
  const sorted = Array.from(summary.values()).sort((a, b) => b.pomodoros - a.pomodoros || a.label.localeCompare(b.label));
  for (const entry of sorted.slice(0, 12)) {
    const div = document.createElement('div');
    div.className = 'summary-entry';
    div.innerHTML = `<span class="label">${entry.label}</span><span class="value">${entry.pomodoros}</span>`;
    elements.tagSummary.appendChild(div);
  }
}

function renderAnalytics() {
  elements.analytics.innerHTML = '';
  const section = document.createElement('div');
  section.className = 'analytics-section';

  const subgroupHeading = document.createElement('h3');
  subgroupHeading.textContent = 'Pomodoros por subgrupo';
  section.appendChild(subgroupHeading);

  const subgroupList = document.createElement('div');
  subgroupList.className = 'analytics-list';

  const subgroupStats = new Map();
  for (const task of state.tasks) {
    const subgroupId = task.subgroupId || `none-${task.groupId}`;
    const subgroupName = task.subgroupId
      ? (state.subgroups.find((s) => s.id === task.subgroupId)?.name ?? 'Sin subgrupo')
      : 'Sin subgrupo';
    const groupName = state.groups.find((g) => g.id === task.groupId)?.name ?? 'Grupo sin nombre';
    const key = `${groupName}__${subgroupName}`;
    const entry = subgroupStats.get(key) || { groupName, subgroupName, pomodoros: 0, minutes: 0 };
    entry.pomodoros += task.pomodorosCompleted;
    entry.minutes += task.totalFocusMinutes;
    subgroupStats.set(key, entry);
  }

  if (subgroupStats.size === 0) {
    const empty = document.createElement('p');
    empty.className = 'theme-note';
    empty.textContent = 'Realiza un pomodoro para comenzar a ver estadísticas.';
    subgroupList.appendChild(empty);
  } else {
    const entries = Array.from(subgroupStats.values()).sort((a, b) => b.pomodoros - a.pomodoros);
    entries.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'analytics-item';
      item.innerHTML = `<strong>${entry.groupName} · ${entry.subgroupName}</strong><span>${entry.pomodoros} pom. · ${Math.round(entry.minutes)} min</span>`;
      subgroupList.appendChild(item);
    });
  }

  section.appendChild(subgroupList);

  const tagHeading = document.createElement('h3');
  tagHeading.textContent = 'Pomodoros por etiqueta';
  section.appendChild(tagHeading);

  const tagList = document.createElement('div');
  tagList.className = 'analytics-list';

  const tagStats = new Map();
  for (const task of state.tasks) {
    for (const tag of task.tags || []) {
      const entry = tagStats.get(tag) || { tag, pomodoros: 0 };
      entry.pomodoros += task.pomodorosCompleted;
      tagStats.set(tag, entry);
    }
  }

  if (tagStats.size === 0) {
    const empty = document.createElement('p');
    empty.className = 'theme-note';
    empty.textContent = 'Añade etiquetas con # y registra pomodoros para ver tendencias.';
    tagList.appendChild(empty);
  } else {
    Array.from(tagStats.values())
      .sort((a, b) => b.pomodoros - a.pomodoros || a.tag.localeCompare(b.tag))
      .forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'analytics-item';
        item.innerHTML = `<strong>${entry.tag}</strong><span>${entry.pomodoros} pom.</span>`;
        tagList.appendChild(item);
      });
  }

  section.appendChild(tagList);

  const historyHeading = document.createElement('h3');
  historyHeading.textContent = 'Últimos pomodoros';
  section.appendChild(historyHeading);

  const historyList = document.createElement('div');
  historyList.className = 'analytics-list';

  const recent = [...(state.pomodoroLog || [])]
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 8);

  if (recent.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'theme-note';
    empty.textContent = 'Aún no hay registros de pomodoro.';
    historyList.appendChild(empty);
  } else {
    for (const entry of recent) {
      const task = state.tasks.find((task) => task.id === entry.taskId);
      const group = state.groups.find((group) => group.id === entry.groupId);
      const subgroup = state.subgroups.find((sub) => sub.id === entry.subgroupId);
      const item = document.createElement('div');
      item.className = 'analytics-item';
      const date = new Date(entry.completedAt).toLocaleString();
      item.innerHTML = `<strong>${task?.title ?? 'Tarea'}</strong><span>${entry.focusMinutes} min · ${group?.name ?? '-'} · ${subgroup?.name ?? 'Sin subgrupo'} · ${date}</span>`;
      historyList.appendChild(item);
    }
  }

  section.appendChild(historyList);
  elements.analytics.appendChild(section);
}

function renderActiveTask() {
  const activeTask = state.tasks.find((task) => task.id === state.activeTaskId);
  if (!activeTask) {
    elements.activeTaskName.textContent = 'Ninguna';
    return;
  }
  elements.activeTaskName.textContent = `${activeTask.title} (${activeTask.pomodorosCompleted} pom.)`;
}

function updatePomodoroCount() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const count = (state.pomodoroLog || []).filter((entry) => entry.completedAt >= today.getTime() && entry.completedAt < tomorrow.getTime()).length;
  elements.pomodoroCount.textContent = count;
}

function updateTimerInputsFromState() {
  elements.focusDuration.value = state.settings.focusDuration;
  elements.breakDuration.value = state.settings.breakDuration;
  elements.longBreakDuration.value = state.settings.longBreakDuration;
  elements.longBreakInterval.value = state.settings.longBreakInterval;
  elements.continuousGoal.value = state.settings.continuousGoal;
}

function updateTimerDisplay() {
  if (timerMode === 'pomodoro') {
    elements.pomodoroDisplay.textContent = formatDuration(remainingSeconds);
    elements.currentBlockLabel.textContent = timerStage === 'focus' ? 'Foco' : 'Descanso';
  } else {
    elements.pomodoroDisplay.textContent = formatDuration(continuousElapsed);
    elements.currentBlockLabel.textContent = 'Conteo continuo';
  }
}

function startTimer() {
  if (timerInterval) return;
  if (timerMode === 'pomodoro') {
    if (remainingSeconds <= 0) {
      remainingSeconds = getCurrentStageDuration();
    }
    timerInterval = setInterval(() => {
      remainingSeconds -= 1;
      if (remainingSeconds <= 0) {
        completeTimerStage();
      }
      updateTimerDisplay();
    }, 1000);
  } else {
    timerInterval = setInterval(() => {
      continuousElapsed += 1;
      updateTimerDisplay();
      if (state.settings.continuousGoal > 0 && continuousElapsed >= state.settings.continuousGoal * 60) {
        completeContinuousGoal();
      }
    }, 1000);
  }
}

function pauseTimer() {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  pauseTimer();
  if (timerMode === 'pomodoro') {
    timerStage = 'focus';
    remainingSeconds = state.settings.focusDuration * 60;
    pomodorosSinceLongBreak = 0;
    previousWasLongBreak = false;
  } else {
    continuousElapsed = 0;
  }
  updateTimerDisplay();
}

function skipTimerStage() {
  if (timerMode === 'pomodoro') {
    completeTimerStage(true);
  } else {
    continuousElapsed = 0;
    updateTimerDisplay();
  }
}

function completeTimerStage(isSkipped = false) {
  pauseTimer();
  if (timerMode !== 'pomodoro') return;
  if (timerStage === 'focus') {
    let isLongBreak = false;
    if (!isSkipped) {
      registerPomodoroCompletion();
      pomodorosSinceLongBreak += 1;
      const interval = state.settings.longBreakInterval || 4;
      if (pomodorosSinceLongBreak > 0 && pomodorosSinceLongBreak % interval === 0) {
        isLongBreak = true;
      }
    }
    timerStage = 'break';
    if (isLongBreak) {
      remainingSeconds = state.settings.longBreakDuration * 60;
      previousWasLongBreak = true;
    } else {
      remainingSeconds = state.settings.breakDuration * 60;
      previousWasLongBreak = false;
    }
  } else {
    timerStage = 'focus';
    remainingSeconds = state.settings.focusDuration * 60;
    if (previousWasLongBreak) {
      pomodorosSinceLongBreak = 0;
      previousWasLongBreak = false;
    }
  }
  updateTimerDisplay();
  startTimer();
}

function registerPomodoroCompletion() {
  const focusMinutes = state.settings.focusDuration;
  const entry = {
    taskId: state.activeTaskId,
    groupId: null,
    subgroupId: null,
    focusMinutes,
    completedAt: Date.now()
  };

  if (state.activeTaskId) {
    const task = state.tasks.find((task) => task.id === state.activeTaskId);
    if (task) {
      task.pomodorosCompleted += 1;
      task.totalFocusMinutes += focusMinutes;
      entry.groupId = task.groupId;
      entry.subgroupId = task.subgroupId;
    }
  }

  state.pomodoroLog.push(entry);
  saveState();
  renderAll();
}

function completeContinuousGoal() {
  pauseTimer();
  continuousElapsed = 0;
  updateTimerDisplay();
  alert('¡Meta alcanzada! Has completado tu conteo continuo.');
}

function handleTimerModeChange(event) {
  timerMode = event.target.value;
  pauseTimer();
  if (timerMode === 'pomodoro') {
    timerStage = 'focus';
    remainingSeconds = state.settings.focusDuration * 60;
    elements.pomodoroSettings.classList.remove('hidden');
    elements.continuousSettings.classList.add('hidden');
  } else {
    elements.pomodoroSettings.classList.add('hidden');
    elements.continuousSettings.classList.remove('hidden');
    continuousElapsed = 0;
  }
  updateTimerDisplay();
}

function getCurrentStageDuration() {
  if (timerStage === 'focus') return state.settings.focusDuration * 60;
  const interval = state.settings.longBreakInterval || 4;
  if (pomodorosSinceLongBreak % interval === 0) {
    return state.settings.longBreakDuration * 60;
  }
  return state.settings.breakDuration * 60;
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function applyTheme(theme) {
  elements.body.classList.remove('theme-blue', 'theme-teal', 'theme-purple', 'theme-sunset');
  elements.body.classList.add(`theme-${theme}`);
  state.settings.theme = theme;
  saveState();
}

function updateStorageWarning() {
  if (!elements.storageWarning) return;
  elements.storageWarning.classList.toggle('hidden', !storage.isFallback());
}

function createSafeStorage() {
  const memoryStore = {};
  try {
    const testKey = '__pomodoro_test__';
    window.localStorage.setItem(testKey, 'ok');
    window.localStorage.removeItem(testKey);
  } catch (error) {
    storageFallback = true;
    console.warn('localStorage no está disponible, se utilizará memoria temporal.', error);
  }

  function storeInMemory(key, value) {
    if (typeof value === 'undefined') {
      delete memoryStore[key];
    } else {
      memoryStore[key] = String(value);
    }
  }

  return {
    getItem(key) {
      if (!storageFallback) {
        try {
          return window.localStorage.getItem(key);
        } catch (error) {
          storageFallback = true;
          console.warn('Error al leer localStorage, usando memoria temporal.', error);
          updateStorageWarning();
        }
      }
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
    },
    setItem(key, value) {
      if (!storageFallback) {
        try {
          window.localStorage.setItem(key, value);
          return;
        } catch (error) {
          storageFallback = true;
          console.warn('Error al guardar en localStorage, usando memoria temporal.', error);
          updateStorageWarning();
        }
      }
      storeInMemory(key, value);
    },
    removeItem(key) {
      if (!storageFallback) {
        try {
          window.localStorage.removeItem(key);
          return;
        } catch (error) {
          storageFallback = true;
          console.warn('Error al eliminar datos de localStorage, usando memoria temporal.', error);
          updateStorageWarning();
        }
      }
      storeInMemory(key);
    },
    isFallback() {
      return storageFallback;
    }
  };
}

function startStopwatch() {
  if (stopwatchInterval) return;
  stopwatchInterval = setInterval(() => {
    stopwatchElapsed += 1;
    updateStopwatchDisplay();
  }, 1000);
}

function pauseStopwatch() {
  if (!stopwatchInterval) return;
  clearInterval(stopwatchInterval);
  stopwatchInterval = null;
}

function resetStopwatch() {
  pauseStopwatch();
  stopwatchElapsed = 0;
  updateStopwatchDisplay();
}

function updateStopwatchDisplay() {
  const hrs = Math.floor(stopwatchElapsed / 3600);
  const mins = Math.floor((stopwatchElapsed % 3600) / 60);
  const secs = stopwatchElapsed % 60;
  elements.stopwatchDisplay.textContent = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

window.addEventListener('load', () => {
  populateGroupOptions();
  handleGroupSelectionChange();
  handleSubgroupSelectionChange();
  updateTimerDisplay();
  updateStopwatchDisplay();
});
