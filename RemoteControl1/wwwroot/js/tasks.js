// Файл: RemoteControl1/wwwroot/js/tasks.js

let expandedTaskId = 0;
let collapsedTaskPeriodKeys = new Set();

function getAvailableTimerTasks() {
    const allTasks = Array.isArray(tasks) ? tasks : [];

    if (!currentUserId || Number(currentUserId) <= 0) {
        return [];
    }

    return allTasks.filter(t => Number(t.userId) === Number(currentUserId));
}

function formatDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getDefaultTaskDeadlineValue() {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return formatDateInputValue(date);
}

function renderDashboard() {
    const activeTasks = document.getElementById("activeTasks");
    const completedTasks = document.getElementById("completedTasks");
    const activeProjects = document.getElementById("activeProjects");
    const totalHours = document.getElementById("totalHours");

    const myTasks = getAvailableTimerTasks();

    if (activeTasks) {
        activeTasks.textContent = myTasks.filter(t => t.status !== "done").length;
    }

    if (completedTasks) {
        completedTasks.textContent = myTasks.filter(t => t.status === "done").length;
    }

    if (activeProjects) {
        activeProjects.textContent = projects.length;
    }

    if (totalHours) {
        const total = timeEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
        totalHours.textContent = total.toFixed(1);
    }
}

function renderDashboardTasks() {
    const container = document.getElementById("dashboardTasks");
    if (!container) return;

    const dashboardItems = getAvailableTimerTasks().slice(0, 3);

    if (!dashboardItems.length) {
        container.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; margin-bottom:0;">
                <div style="color: var(--gray);">Задач пока нет</div>
            </div>
        `;
        return;
    }

    container.innerHTML = dashboardItems.map(task => `
        <div class="task-card ${task.priority}">
            <h4 class="task-title">${task.name}</h4>
            <p style="color: var(--gray); margin-bottom: 15px; font-size: 14px;">
                ${task.description || "Без описания"}
            </p>
            <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom:10px;">
                <span class="status-badge ${getStatusBadgeClass(task.status)}">${getStatusText(task.status)}</span>
                <span style="color: var(--gray); font-size: 13px;"><i class="far fa-calendar"></i> ${task.deadline || "-"}</span>
            </div>
            <div style="display:flex; justify-content: space-between; align-items:center;">
                <span style="font-size: 13px; color: var(--gray);"><i class="far fa-user"></i> ${task.assignee || "-"}</span>
                <span style="font-size: 13px; color: var(--gray);"><i class="far fa-clock"></i> ${task.plannedTime || 0} ч</span>
            </div>
        </div>
    `).join("");
}

function renderActivityLog() {
    const container = document.getElementById("activityLog");
    if (!container) return;

    if (!timeEntries.length) {
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color: var(--gray);">Записей пока нет</td>
            </tr>
        `;
        return;
    }

    container.innerHTML = timeEntries.slice(0, 5).map(entry => `
        <tr>
            <td>${entry.date || "-"}</td>
            <td>${entry.task || "-"}</td>
            <td>${Number(entry.hours || 0).toFixed(1)} ч</td>
            <td>${entry.comment || "-"}</td>
            <td>-</td>
            <td><span class="task-status status-done">Учтено</span></td>
        </tr>
    `).join("");
}

function fillProjectFilter() {
    const select = document.getElementById("taskProjectFilter");
    if (!select) return;

    select.innerHTML =
        `<option value="all">Все проекты</option>` +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

function fillProjectSelect(selectId, selectedId = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = projects.map(p =>
        `<option value="${p.id}" ${selectedId == p.id ? "selected" : ""}>${p.name}</option>`
    ).join("");
}

function getUsersForProject(projectId) {
    const project = projects.find(p => Number(p.id) === Number(projectId));
    if (!project) return [];

    return users.filter(u => (project.memberIds || []).includes(Number(u.id)));
}

function fillTaskAssigneeSelect(projectId, selectId, selectedUserId = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const pid = Number(projectId || 0);

    if (!pid) {
        select.innerHTML = `<option value="">Сначала выберите проект</option>`;
        return;
    }

    const projectUsers = getUsersForProject(pid);

    if (!projectUsers.length) {
        select.innerHTML = `<option value="">У проекта нет участников</option>`;
        return;
    }

    select.innerHTML =
        `<option value="">Выберите исполнителя</option>` +
        projectUsers.map(u => `<option value="${u.id}">${u.fullName}</option>`).join("");

    if (selectedUserId && [...select.options].some(x => Number(x.value) === Number(selectedUserId))) {
        select.value = String(selectedUserId);
    }
}

function getTaskStageNamesForProject(projectId) {
    const pid = Number(projectId || 0);
    const project = projects.find(p => Number(p.id) === pid);

    if (!project) {
        return [];
    }

    const projectTasks = tasks.filter(t => Number(t.projectId) === pid);

    if (typeof getProjectStageNames === "function") {
        return getProjectStageNames(project, projectTasks);
    }

    const savedStages = Array.isArray(project.stageNames)
        ? project.stageNames.map(x => (x || "").trim()).filter(Boolean)
        : [];
    const taskStages = [...new Set(
        projectTasks
            .map(task => (task.stageName || "").trim())
            .filter(Boolean)
    )];
    const rawType = String(project.projectType || project.projectTypeName || "").toLowerCase();
    const presetStages = rawType.includes("линей") || rawType === "linear"
        ? ["Анализ", "Проектирование", "Разработка", "Тестирование", "Запуск"]
        : rawType.includes("гибрид") || rawType === "hybrid"
            ? ["Подготовка", "Разработка / Backend", "Разработка / Frontend", "Сдача / QA", "Сдача / Релиз"]
            : ["Backend", "Frontend", "UI/UX", "QA", "Docs"];

    return [...new Set([...(savedStages.length ? savedStages : presetStages), ...taskStages])];
}

function fillTaskStageSelect(projectId, selectId, selectedStageName = "") {
    const select = document.getElementById(selectId);
    if (!select) return;

    const pid = Number(projectId || 0);
    const stageNames = getTaskStageNamesForProject(pid);

    if (!pid) {
        select.innerHTML = `<option value="">Сначала выберите проект</option>`;
        return;
    }

    if (!stageNames.length) {
        select.innerHTML = `<option value="">Этапы не заданы</option>`;
        return;
    }

    select.innerHTML =
        `<option value="">Выберите этап</option>` +
        stageNames.map(stage => `
            <option value="${escapeTaskText(stage)}" ${stage === selectedStageName ? "selected" : ""}>
                ${escapeTaskText(stage)}
            </option>
        `).join("");
}

function fillTaskSelects() {
    const availableTasks = getAvailableTimerTasks();

    const currentTask = document.getElementById("currentTask");
    const currentTaskFull = document.getElementById("currentTaskFull");
    const quickTask = document.getElementById("quickTask");

    const currentTaskValue = currentTask ? currentTask.value : "";
    const currentTaskFullValue = currentTaskFull ? currentTaskFull.value : "";
    const quickTaskValue = quickTask ? quickTask.value : "";

    const emptyText = availableTasks.length
        ? "Выберите задачу"
        : "Нет доступных задач";

    const taskOptions = availableTasks.map(t =>
        `<option value="${escapeTaskText(t.id)}">${escapeTaskText(t.name)}</option>`
    ).join("");

    const html = `<option value="">${emptyText}</option>${taskOptions}`;

    if (currentTask) {
        currentTask.innerHTML = html;

        if (currentTaskValue && availableTasks.some(t => String(t.id) === String(currentTaskValue))) {
            currentTask.value = currentTaskValue;
        } else if (activeTaskId && availableTasks.some(t => Number(t.id) === Number(activeTaskId))) {
            currentTask.value = String(activeTaskId);
        }
    }

    if (currentTaskFull) {
        currentTaskFull.innerHTML = html;

        if (currentTaskFullValue && availableTasks.some(t => String(t.id) === String(currentTaskFullValue))) {
            currentTaskFull.value = currentTaskFullValue;
        } else if (activeTaskId && availableTasks.some(t => Number(t.id) === Number(activeTaskId))) {
            currentTaskFull.value = String(activeTaskId);
        }
    }

    if (quickTask) {
        quickTask.innerHTML = html;

        if (quickTaskValue && availableTasks.some(t => String(t.id) === String(quickTaskValue))) {
            quickTask.value = quickTaskValue;
        } else if (activeTaskId && availableTasks.some(t => Number(t.id) === Number(activeTaskId))) {
            quickTask.value = String(activeTaskId);
        }
    }

    if (!availableTasks.some(t => Number(t.id) === Number(activeTaskId))) {
        activeTaskId = null;
        activeTaskName = "";
    }
}

function syncTrackerTaskSelects() {
    const currentTask = document.getElementById("currentTask");
    const currentTaskFull = document.getElementById("currentTaskFull");

    if (!currentTask || !currentTaskFull) return;

    currentTask.onchange = function () {
        const taskId = Number(currentTask.value || 0);
        const task = getAvailableTimerTasks().find(t => Number(t.id) === taskId);

        currentTaskFull.value = currentTask.value;

        if (task) {
            setActiveTask(task);
        } else {
            activeTaskId = null;
            activeTaskName = "";
        }
    };

    currentTaskFull.onchange = function () {
        const taskId = Number(currentTaskFull.value || 0);
        const task = getAvailableTimerTasks().find(t => Number(t.id) === taskId);

        currentTask.value = currentTaskFull.value;

        if (task) {
            setActiveTask(task);
        } else {
            activeTaskId = null;
            activeTaskName = "";
        }
    };
}

function setActiveTask(task) {
    if (!task) return;

    activeTaskId = Number(task.id);
    activeTaskName = task.name || "";

    const currentTask = document.getElementById("currentTask");
    const currentTaskFull = document.getElementById("currentTaskFull");
    const quickTask = document.getElementById("quickTask");

    if (currentTask) currentTask.value = String(task.id);
    if (currentTaskFull) currentTaskFull.value = String(task.id);
    if (quickTask) quickTask.value = String(task.id);
}

function syncEmployeeTaskStatusControl(taskId, status) {
    const statusInput = document.getElementById(`employeeStatus_${taskId}`);
    const badge = statusInput?.closest(".status-dropdown")?.querySelector(".task-status-badge");
    const badgeText = badge?.querySelector(".status-badge-text");

    if (statusInput) {
        statusInput.value = status;
    }

    if (badge) {
        badge.className = `status-badge ${getStatusBadgeClass(status)} task-status-badge`;
    }

    if (badgeText) {
        badgeText.textContent = getStatusText(status);
    }
}

async function saveEmployeeTaskStatus(taskId) {
    const statusInput = document.getElementById(`employeeStatus_${taskId}`);
    if (!statusInput) return;

    const newStatus = statusInput.value;
    const task = tasks.find(x => Number(x.id) === Number(taskId));
    if (!task) return;

    if (newStatus === "done") {
        syncEmployeeTaskStatusControl(taskId, task.status);
        openCompleteTaskModal(taskId);
        return;
    }

    try {
        const response = await fetch(`/api/tasks/${task.id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({
                id: task.id,
                name: task.name,
                description: buildTaskDescriptionPayload(task.description || "", task.taskMeta || {}),
                projectId: task.projectId,
                userId: task.userId || 0,
                priority: task.priority,
                status: newStatus,
                plannedTime: task.plannedTime || 0,
                deadline: task.deadlineRaw || null,
                stageName: task.stageName || ""
            })
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
            showNotification(result.error || "Не удалось изменить статус");
            return;
        }

        const index = tasks.findIndex(x => Number(x.id) === Number(taskId));
        if (index !== -1) {
            tasks[index] = normalizeTask(result.task);
        }

        refreshProjectsStats();
        renderTasksTable();
        renderDashboard();
        renderDashboardTasks();
        renderProjects();

        if (typeof showProjectDetails === "function" && typeof currentOpenedProjectId !== "undefined" && currentOpenedProjectId) {
            showProjectDetails(currentOpenedProjectId);
        }

        showNotification("Статус обновлён");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

function escapeTaskText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function renderTaskExpandMeta(parts) {
    const items = parts.filter(part => String(part || "").trim());
    if (!items.length) {
        return "";
    }

    return `
        <div class="table-expand-subtitle">
            ${items.map(item => `<span>${escapeTaskText(item)}</span>`).join("")}
        </div>
    `;
}

function renderTaskExpandStat(label, value, options = {}) {
    const { html = false } = options;
    const content = html ? value : escapeTaskText(value || "—");

    return `
        <div class="table-expand-stat">
            <span class="table-expand-stat-label">${escapeTaskText(label)}</span>
            <div class="table-expand-stat-value">${content}</div>
        </div>
    `;
}

function renderTaskExpandItem(label, value, options = {}) {
    const { html = false } = options;
    const content = html ? value : escapeTaskText(value || "—");

    return `
        <div class="table-expand-item">
            <span class="table-expand-item-label">${escapeTaskText(label)}</span>
            <div class="table-expand-item-value">${content}</div>
        </div>
    `;
}

function renderTaskExpandSection(title, content, options = {}) {
    const { wide = false } = options;
    return `
        <section class="table-expand-section${wide ? " is-wide" : ""}">
            <div class="table-expand-section-title">${escapeTaskText(title)}</div>
            <div class="table-expand-list">
                ${content}
            </div>
        </section>
    `;
}

function renderTaskExpandNote(title, value, options = {}) {
    const { wide = false, muted = false } = options;

    return `
        <div class="table-expand-note${wide ? " is-wide" : ""}${muted ? " is-muted" : ""}">
            <span class="table-expand-note-title">${escapeTaskText(title)}</span>
            <div class="table-expand-note-body">${escapeTaskText(value || "—")}</div>
        </div>
    `;
}

function getTaskDeadlineDate(task) {
    const raw = task?.deadlineRaw || task?.deadline || "";
    if (!raw) {
        return null;
    }

    const normalized = String(raw).includes("T")
        ? raw
        : `${raw}T00:00:00`;
    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? null : date;
}

function formatTaskBoardDate(task) {
    const date = getTaskDeadlineDate(task);
    if (!date) {
        return "Без срока";
    }

    return date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short"
    });
}

function formatTaskBoardFullDate(task) {
    const date = getTaskDeadlineDate(task);
    if (!date) {
        return "Срок не задан";
    }

    return date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}

function formatTaskReportDate(value) {
    if (!value) {
        return "Отчёт ещё не отправлен";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getTaskDeadlineTone(task) {
    const date = getTaskDeadlineDate(task);
    if (!date) {
        return "is-unscheduled";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    if (compareDate.getTime() < today.getTime() && task.status !== "done") {
        return "is-overdue";
    }

    if (compareDate.getTime() === today.getTime()) {
        return "is-today";
    }

    const diffDays = Math.round((compareDate.getTime() - today.getTime()) / 86400000);
    if (diffDays <= 3) {
        return "is-soon";
    }

    return "is-planned";
}

function getTaskReporterName() {
    const user = users.find(x => Number(x.id) === Number(currentUserId));
    return user?.fullName || user?.login || "Исполнитель";
}

function getTaskStatusOrder(status) {
    switch (String(status || "").toLowerCase()) {
        case "new":
            return 0;
        case "progress":
            return 1;
        case "review":
            return 2;
        case "done":
            return 3;
        default:
            return 4;
    }
}

function getTaskPriorityOrder(priority) {
    switch (String(priority || "").toLowerCase()) {
        case "high":
            return 0;
        case "medium":
            return 1;
        case "low":
            return 2;
        default:
            return 3;
    }
}

function getTaskPeriodMeta(task) {
    const deadlineDate = getTaskDeadlineDate(task);
    if (!deadlineDate) {
        return {
            key: "no-deadline",
            label: "Без срока",
            hint: "Задачи, которым нужен ручной приоритет",
            order: Number.MAX_SAFE_INTEGER - 1
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const normalized = new Date(deadlineDate);
    normalized.setHours(0, 0, 0, 0);

    if (normalized.getTime() < today.getTime() && task.status !== "done") {
        return {
            key: "overdue",
            label: "Просрочено",
            hint: "Требует внимания в первую очередь",
            order: Number.MIN_SAFE_INTEGER
        };
    }

    const monthStart = new Date(normalized.getFullYear(), normalized.getMonth(), 1);
    const formatter = new Intl.DateTimeFormat("ru-RU", {
        month: "long",
        year: "numeric"
    });
    const rawLabel = formatter.format(monthStart);
    const label = rawLabel ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1) : "Период";

    return {
        key: `month-${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
        label,
        hint: "Задачи сгруппированы по месяцу срока",
        order: monthStart.getTime()
    };
}

function getFilteredTasksList() {
    const filterStatus = document.getElementById("taskStatusFilter")?.value || "all";
    const filterPriority = document.getElementById("taskPriorityFilter")?.value || "all";
    const filterProject = document.getElementById("taskProjectFilter")?.value || "all";
    const sort = document.getElementById("taskSortFilter")?.value || "deadline_asc";
    const searchText = (document.getElementById("taskSearch")?.value || "").trim().toLowerCase();

    const filteredTasks = tasks.filter(task => {
        if (filterStatus !== "all" && task.status !== filterStatus) return false;
        if (filterPriority !== "all" && task.priority !== filterPriority) return false;
        if (filterProject !== "all" && task.projectId !== Number(filterProject)) return false;

        if (searchText) {
            const haystack = [
                task.name,
                task.description,
                task.project,
                task.stageName,
                task.assignee,
                task.completionReportText
            ].join(" ").toLowerCase();

            if (!haystack.includes(searchText)) {
                return false;
            }
        }

        return true;
    });

    filteredTasks.sort((a, b) => {
        if (sort === "deadline_desc" || sort === "deadline_asc") {
            const aTime = getTaskDeadlineDate(a)?.getTime() ?? (sort === "deadline_asc" ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER);
            const bTime = getTaskDeadlineDate(b)?.getTime() ?? (sort === "deadline_asc" ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER);
            if (aTime !== bTime) {
                return sort === "deadline_asc" ? aTime - bTime : bTime - aTime;
            }
        }

        if (sort === "priority_desc") {
            const priorityDiff = getTaskPriorityOrder(a.priority) - getTaskPriorityOrder(b.priority);
            if (priorityDiff !== 0) {
                return priorityDiff;
            }
        }

        if (sort === "status") {
            const statusDiff = getTaskStatusOrder(a.status) - getTaskStatusOrder(b.status);
            if (statusDiff !== 0) {
                return statusDiff;
            }
        }

        if (sort === "name") {
            const nameDiff = String(a.name || "").localeCompare(String(b.name || ""), "ru");
            if (nameDiff !== 0) {
                return nameDiff;
            }
        }

        const aDeadline = getTaskDeadlineDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDeadline = getTaskDeadlineDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (aDeadline !== bDeadline) {
            return aDeadline - bDeadline;
        }

        return String(a.name || "").localeCompare(String(b.name || ""), "ru");
    });

    return filteredTasks;
}

function buildTaskPeriods(taskItems) {
    const groups = new Map();

    taskItems.forEach(task => {
        const meta = getTaskPeriodMeta(task);
        if (!groups.has(meta.key)) {
            groups.set(meta.key, {
                ...meta,
                tasks: []
            });
        }

        groups.get(meta.key).tasks.push(task);
    });

    return [...groups.values()].sort((a, b) => a.order - b.order);
}

function renderTaskPeriodSummary(items) {
    const counts = {
        new: 0,
        progress: 0,
        review: 0,
        done: 0
    };

    items.forEach(task => {
        const status = String(task.status || "").toLowerCase();
        if (counts[status] != null) {
            counts[status] += 1;
        }
    });

    const parts = [];
    if (counts.progress) parts.push(`${counts.progress} в работе`);
    if (counts.review) parts.push(`${counts.review} на проверке`);
    if (counts.new) parts.push(`${counts.new} новые`);
    if (counts.done) parts.push(`${counts.done} завершены`);

    return parts.length ? parts.join(" · ") : "Задач пока нет";
}

function renderTaskListInlineMeta(label, value) {
    return `
        <span class="task-list-inline-meta-item">
            <strong>${escapeTaskText(label)}:</strong>
            <span>${escapeTaskText(value || "—")}</span>
        </span>
    `;
}

function renderTaskListMetric(label, value, options = {}) {
    const { tone = "" } = options;
    return `
        <div class="task-list-metric${tone ? ` ${tone}` : ""}">
            <span>${escapeTaskText(label)}</span>
            <strong>${escapeTaskText(value || "—")}</strong>
        </div>
    `;
}

function renderTaskPriorityChip(task) {
    return `
        <span class="task-priority-chip ${getPriorityClass(task.priority)}">
            <i class="fas fa-flag" aria-hidden="true"></i>
            <span>Приоритет</span>
            <strong>${escapeTaskText(getPriorityText(task.priority))}</strong>
        </span>
    `;
}

function renderTaskStatusBlock(task) {
    return `
        <div class="task-list-status-block">
            <span>Статус выполнения</span>
            ${renderTaskStatusControl(task)}
        </div>
    `;
}

function getTaskDeadlineDashboard(items) {
    const summary = {
        overdue: 0,
        today: 0,
        soon: 0,
        unscheduled: 0,
        active: 0,
        done: 0
    };

    items.forEach(task => {
        if (task.status === "done") {
            summary.done += 1;
        } else {
            summary.active += 1;
        }

        const tone = getTaskDeadlineTone(task);
        if (tone === "is-overdue") summary.overdue += 1;
        if (tone === "is-today") summary.today += 1;
        if (tone === "is-soon") summary.soon += 1;
        if (tone === "is-unscheduled") summary.unscheduled += 1;
    });

    return summary;
}

function renderTaskDeadlineDashboard(items) {
    const summaryRoot = document.getElementById("tasksDeadlineSummary");
    const caption = document.getElementById("tasksDeadlineCaption");
    if (!summaryRoot) return;

    const summary = getTaskDeadlineDashboard(items);
    const cards = [
        {
            tone: "is-overview",
            icon: "fa-calendar-days",
            title: "Сроки",
            value: summary.active,
            note: `Готово: ${summary.done}`
        },
        {
            tone: "is-overdue",
            icon: "fa-circle-exclamation",
            title: "Просрочено",
            value: summary.overdue,
            note: summary.overdue ? "Нужно действие" : "Нет"
        },
        {
            tone: "is-today",
            icon: "fa-calendar-day",
            title: "Сегодня",
            value: summary.today,
            note: summary.today ? "В фокусе" : "Нет"
        },
        {
            tone: "is-soon",
            icon: "fa-calendar-week",
            title: "Скоро",
            value: summary.soon,
            note: summary.soon ? "Ближайшие" : "Нет"
        },
        {
            tone: "is-unscheduled",
            icon: "fa-inbox",
            title: "Без срока",
            value: summary.unscheduled,
            note: summary.unscheduled ? "Назначьте срок" : "Нет"
        }
    ];

    summaryRoot.innerHTML = cards.map(card => `
        <article class="tasks-deadline-card ${card.tone}">
            <div class="tasks-deadline-card-head">
                <span class="tasks-deadline-card-title">${escapeTaskText(card.title)}</span>
                <span class="tasks-deadline-card-icon" aria-hidden="true">
                    <i class="fas ${card.icon}"></i>
                </span>
            </div>
            <div class="tasks-deadline-card-value">${escapeTaskText(card.value)}</div>
            <div class="tasks-deadline-card-note">${escapeTaskText(card.note)}</div>
        </article>
    `).join("");

    if (caption) {
        caption.textContent = `${items.length} задач · активные ${summary.active} · завершённые ${summary.done}`;
    }
}

function getTaskPeriodGroupTone(group) {
    if (group.key === "overdue") return "is-overdue";
    if (group.key === "no-deadline") return "is-unscheduled";
    if (group.tasks.some(task => getTaskDeadlineTone(task) === "is-today")) return "is-today";
    if (group.tasks.some(task => getTaskDeadlineTone(task) === "is-soon")) return "is-soon";
    return "is-planned";
}

function getTaskPeriodGroupIcon(group) {
    const tone = getTaskPeriodGroupTone(group);
    if (tone === "is-overdue") return "fa-circle-exclamation";
    if (tone === "is-today") return "fa-calendar-day";
    if (tone === "is-soon") return "fa-calendar-week";
    if (tone === "is-unscheduled") return "fa-inbox";
    return "fa-calendar-days";
}

function renderTaskPeriodPills(items) {
    const counts = {
        new: 0,
        progress: 0,
        review: 0,
        done: 0
    };

    items.forEach(task => {
        const status = String(task.status || "").toLowerCase();
        if (counts[status] != null) {
            counts[status] += 1;
        }
    });

    return [
        ["Новые", counts.new],
        ["В работе", counts.progress],
        ["Проверка", counts.review],
        ["Готово", counts.done]
    ]
        .filter(([, value]) => value > 0)
        .map(([label, value]) => `
            <span class="tasks-period-pill">
                <span>${escapeTaskText(label)}</span>
                <strong>${escapeTaskText(value)}</strong>
            </span>
        `).join("");
}

function renderTaskPeriodItems(tasksInPeriod) {
    return tasksInPeriod.map(task => {
        const isExpanded = Number(expandedTaskId) === Number(task.id);
        const deadlineTone = getTaskDeadlineTone(task);
        return `
            <article class="task-list-item ${isExpanded ? "is-expanded" : ""} ${deadlineTone}" data-task-card data-task-id="${task.id}">
                <div class="task-list-main" onclick="selectTaskTableRow(event, ${task.id})">
                    <div class="task-list-primary">
                        <span class="task-list-indicator ${deadlineTone}"></span>
                        <div class="task-list-copy">
                            <div class="task-list-title-row">
                                <h3 class="task-list-title">${escapeTaskText(task.name || "—")}</h3>
                                ${renderTaskPriorityChip(task)}
                            </div>
                            <div class="task-list-inline-meta">
                                ${renderTaskListInlineMeta("Проект", task.project || "Без проекта")}
                                ${renderTaskListInlineMeta("Этап", task.stageName || "Этап не указан")}
                                ${renderTaskListInlineMeta("Исполнитель", task.assignee || "Не назначен")}
                            </div>
                        </div>
                    </div>

                    <div class="task-list-aside">
                        <div class="task-list-metrics">
                            ${renderTaskListMetric("Плановые часы", `${Number(task.plannedTime || 0).toFixed(1)} ч`)}
                            ${renderTaskListMetric("Дедлайн", formatTaskBoardDate(task), {
            tone: deadlineTone
        })}
                        </div>

                        <div class="task-list-side">
                            ${renderTaskStatusBlock(task)}
                            ${renderTaskRowActions(task)}
                        </div>
                    </div>
                </div>
                ${isExpanded ? renderTaskExpandedRow(task) : ""}
            </article>
        `;
    }).join("");
}

function renderTaskDetailSection(title, content) {
    return `
        <section class="task-detail-section">
            <h4 class="task-detail-heading">${escapeTaskText(title)}</h4>
            <div class="table-expand-list task-detail-list">
                ${content}
            </div>
        </section>
    `;
}

function renderTaskDetailNote(title, value, options = {}) {
    const { muted = false } = options;
    return `
        <section class="task-detail-note${muted ? " is-muted" : ""}">
            <h4 class="task-detail-heading">${escapeTaskText(title)}</h4>
            <div class="task-detail-note-body">${escapeTaskText(value || "—")}</div>
        </section>
    `;
}

function renderTaskStatusControl(task) {
    if (!isEmployee) {
        return `<span class="task-status ${getStatusBadgeClass(task.status)}">${getStatusText(task.status)}</span>`;
    }

    return `
        <div class="task-status-cell">
            <div class="status-dropdown">
                <input type="hidden" id="employeeStatus_${task.id}" class="employee-status-value" value="${task.status}">
                <button type="button"
                        class="status-badge ${getStatusBadgeClass(task.status)} task-status-badge"
                        onclick="toggleStatusMenu(this)">
                    <span class="status-badge-dot"></span>
                    <span class="status-badge-text">${getStatusText(task.status)}</span>
                    <i class="fas fa-chevron-down status-badge-arrow"></i>
                </button>

                <div class="status-menu hidden">
                    <button type="button" class="status-menu-item" onclick="changeStatus(this, 'new')">
                        <span class="status-menu-dot status-new-dot"></span>
                        <span>Новая</span>
                    </button>
                    <button type="button" class="status-menu-item" onclick="changeStatus(this, 'progress')">
                        <span class="status-menu-dot status-progress-dot"></span>
                        <span>В работе</span>
                    </button>
                    <button type="button" class="status-menu-item" onclick="changeStatus(this, 'review')">
                        <span class="status-menu-dot status-review-dot"></span>
                        <span>На проверке</span>
                    </button>
                    <button type="button" class="status-menu-item" onclick="changeStatus(this, 'done')">
                        <span class="status-menu-dot status-done-dot"></span>
                        <span>Завершена</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderTaskRowActions(task) {
    const managerButtons = !isEmployee
        ? `
            <button class="btn btn-sm btn-outline" type="button" onclick="openEditTaskModal(${task.id})" title="Редактировать">
                <i class="fas fa-pen-to-square"></i>
            </button>
            <button class="btn btn-sm btn-danger" type="button" onclick="openDeleteTaskModal(${task.id})" title="Удалить">
                <i class="fas fa-trash-can"></i>
            </button>
        `
        : `
            <button class="btn btn-sm btn-primary" type="button" onclick="saveEmployeeTaskStatus(${task.id})" title="Сохранить статус">
                <i class="fas fa-floppy-disk"></i>
            </button>
        `;

    const startButton = (isEmployee || isManager || isAdmin) && task.status !== "done"
        ? `
            <button class="btn btn-sm btn-success" type="button" onclick="startTask(${task.id})" title="Начать">
                <i class="fas fa-play"></i>
            </button>
        `
        : "";

    return `
        <div class="task-list-actions table-actions">
            ${managerButtons}
            ${startButton}
        </div>
    `;
}

function renderTaskExpandedRow(task) {
    const description = String(task.description || "").trim();
    const project = projects.find(x => Number(x.id) === Number(task.projectId));
    const reportText = String(task.completionReportText || "").trim();
    const contextSection = renderTaskDetailSection("Основные данные", [
        renderTaskExpandItem("ID", `#${task.id}`),
        renderTaskExpandItem("Категория приоритета", getPriorityText(task.priority)),
        renderTaskExpandItem("Менеджер", project?.managerName || "Не назначен"),
        renderTaskExpandItem("Плановые часы", `${Number(task.plannedTime || 0).toFixed(1)} ч`)
    ].join(""));
    const reviewSection = reportText
        ? renderTaskDetailSection("Проверка результата", [
            renderTaskExpandItem("Отправил", task.completionReportedBy || task.assignee || "Исполнитель"),
            renderTaskExpandItem("Когда", formatTaskReportDate(task.completionReportedAt)),
            renderTaskExpandItem("Статус выполнения", task.status === "review" ? "Ожидает проверки менеджера" : getStatusText(task.status)),
            renderTaskExpandItem("Дедлайн", formatTaskBoardFullDate(task))
        ].join(""))
        : renderTaskDetailSection("Статус и следующий шаг", [
            renderTaskExpandItem("Статус выполнения", getStatusText(task.status)),
            renderTaskExpandItem("Дедлайн", formatTaskBoardFullDate(task)),
            renderTaskExpandItem("Следующий шаг", task.status === "review"
                ? "Менеджеру нужно принять результат или вернуть задачу на доработку"
                : task.status === "done"
                    ? "Задача закрыта, можно использовать данные в отчётах"
                    : "Выполните работу, кратко опишите результат и отправьте на проверку"),
            renderTaskExpandItem("Менеджер", project?.managerName || "Не назначен")
        ].join(""));
    const completionAction = isEmployee && task.status !== "done"
        ? `
            <button class="btn btn-primary task-expand-primary-btn" type="button" onclick="openCompleteTaskModal(${task.id})">
                <i class="fas fa-paper-plane"></i>
                <span>Отчёт и отправка на проверку</span>
            </button>
        `
        : "";
    const managerActions = !isEmployee
        ? `
            <button class="btn btn-outline" type="button" onclick="openEditTaskModal(${task.id})">
                <i class="fas fa-pen-to-square"></i>
                <span>Редактировать</span>
            </button>
            <button class="btn btn-danger" type="button" onclick="openDeleteTaskModal(${task.id})">
                <i class="fas fa-trash-can"></i>
                <span>Удалить</span>
            </button>
        `
        : "";

    return `
        <div class="task-card-expand" data-expand-stage data-enter="true">
            <div class="task-detail-panel">
                <div class="task-detail-hero">
                    <div class="task-detail-title">
                        <span>Задача #${escapeTaskText(task.id)}</span>
                        <h4>${escapeTaskText(task.name || "—")}</h4>
                        <p>${escapeTaskText(task.project || "Без проекта")} · ${escapeTaskText(task.stageName || "Этап не указан")} · ${escapeTaskText(task.assignee || "Не назначен")}</p>
                    </div>

                    <div class="task-detail-state">
                        ${renderTaskPriorityChip(task)}
                        ${renderTaskStatusControl(task)}
                    </div>
                </div>

                <div class="task-detail-grid">
                    ${contextSection}
                    ${reviewSection}
                </div>

                ${renderTaskDetailNote("Описание задачи", description || "Описание не заполнено.", {
            muted: !description
        })}

                ${reportText ? renderTaskDetailNote("Отчёт исполнителя", reportText) : ""}

                ${(completionAction || managerActions) ? `
                    <div class="task-detail-actions">
                        ${completionAction}
                        ${managerActions}
                    </div>
                ` : ""}
            </div>
        </div>
    `;
}

function playTaskExpandStageEnter(root) {
    root?.querySelectorAll?.("[data-expand-stage][data-enter='true']").forEach(stage => {
        const targetHeight = stage.scrollHeight;
        const shell = stage.firstElementChild;

        stage.style.overflow = "hidden";
        stage.style.height = "0px";
        stage.style.opacity = "0";
        stage.style.willChange = "height, opacity";
        stage.style.transition = "none";

        if (shell instanceof HTMLElement) {
            shell.style.opacity = "0";
            shell.style.transform = "translateY(-4px)";
            shell.style.transition = "none";
        }

        stage.offsetHeight;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                stage.style.transition = "height 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease";
                stage.style.height = `${targetHeight}px`;
                stage.style.opacity = "1";

                if (shell instanceof HTMLElement) {
                    shell.style.transition = "transform 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease";
                    shell.style.opacity = "1";
                    shell.style.transform = "translateY(0)";
                }
            });
        });

        const cleanup = () => {
            stage.style.height = "";
            stage.style.opacity = "";
            stage.style.transition = "";
            stage.style.overflow = "";
            stage.style.willChange = "";
            stage.removeAttribute("data-enter");

            if (shell instanceof HTMLElement) {
                shell.style.opacity = "";
                shell.style.transform = "";
                shell.style.transition = "";
            }
        };

        const onEnd = event => {
            if (event.target !== stage || event.propertyName !== "height") {
                return;
            }

            stage.removeEventListener("transitionend", onEnd);
            cleanup();
        };

        stage.addEventListener("transitionend", onEnd);
        window.setTimeout(() => {
            stage.removeEventListener("transitionend", onEnd);
            cleanup();
        }, 380);
    });
}

function collapseTaskExpandStage(stage, onDone) {
    if (!stage) {
        onDone?.();
        return;
    }

    const currentHeight = stage.scrollHeight;
    const shell = stage.firstElementChild;
    stage.style.overflow = "hidden";
    stage.style.height = `${currentHeight}px`;
    stage.style.opacity = "1";
    stage.style.willChange = "height, opacity";
    stage.style.transition = "none";

    if (shell instanceof HTMLElement) {
        shell.style.opacity = "1";
        shell.style.transform = "translateY(0)";
        shell.style.transition = "none";
    }

    stage.offsetHeight;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            stage.style.transition = "height 280ms cubic-bezier(0.32, 0, 0.2, 1), opacity 220ms ease";
            stage.style.height = "0px";
            stage.style.opacity = "0";

            if (shell instanceof HTMLElement) {
                shell.style.transition = "transform 220ms ease, opacity 200ms ease";
                shell.style.opacity = "0";
                shell.style.transform = "translateY(-4px)";
            }
        });
    });

    let completed = false;
    const finish = () => {
        if (completed) return;
        completed = true;
        onDone?.();
    };

    const onEnd = event => {
        if (event.target !== stage || event.propertyName !== "height") {
            return;
        }

        stage.removeEventListener("transitionend", onEnd);
        finish();
    };

    stage.addEventListener("transitionend", onEnd);
    window.setTimeout(() => {
        stage.removeEventListener("transitionend", onEnd);
        stage.style.willChange = "";
        finish();
    }, 460);
}

function setTaskPeriodCollapsedState(group, isCollapsed) {
    if (!group) return;

    group.classList.toggle("is-collapsed", isCollapsed);

    const toggle = group.querySelector(".tasks-period-toggle");
    const chevron = group.querySelector(".tasks-period-chevron i");

    toggle?.setAttribute("aria-expanded", String(!isCollapsed));

    if (chevron) {
        chevron.classList.toggle("fa-chevron-down", isCollapsed);
        chevron.classList.toggle("fa-chevron-up", !isCollapsed);
    }
}

function playTaskPeriodStageEnter(stage) {
    if (!stage) return;

    const shell = stage.firstElementChild;
    stage.hidden = false;
    stage.classList.remove("is-hidden");

    const targetHeight = stage.scrollHeight;
    stage.style.overflow = "hidden";
    stage.style.height = "0px";
    stage.style.opacity = "0";
    stage.style.willChange = "height, opacity";
    stage.style.transition = "none";

    if (shell instanceof HTMLElement) {
        shell.style.opacity = "0";
        shell.style.transform = "translateY(-6px)";
        shell.style.transition = "none";
    }

    stage.offsetHeight;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            stage.style.transition = "height 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease";
            stage.style.height = `${targetHeight}px`;
            stage.style.opacity = "1";

            if (shell instanceof HTMLElement) {
                shell.style.transition = "transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease";
                shell.style.opacity = "1";
                shell.style.transform = "translateY(0)";
            }
        });
    });

    const cleanup = () => {
        stage.style.height = "";
        stage.style.opacity = "";
        stage.style.transition = "";
        stage.style.overflow = "";
        stage.style.willChange = "";

        if (shell instanceof HTMLElement) {
            shell.style.opacity = "";
            shell.style.transform = "";
            shell.style.transition = "";
        }
    };

    const onEnd = event => {
        if (event.target !== stage || event.propertyName !== "height") {
            return;
        }

        stage.removeEventListener("transitionend", onEnd);
        cleanup();
    };

    stage.addEventListener("transitionend", onEnd);
    window.setTimeout(() => {
        stage.removeEventListener("transitionend", onEnd);
        cleanup();
    }, 460);
}

function collapseTaskPeriodStage(stage, onDone) {
    if (!stage) {
        onDone?.();
        return;
    }

    const shell = stage.firstElementChild;
    const currentHeight = stage.scrollHeight;
    stage.hidden = false;
    stage.classList.remove("is-hidden");
    stage.style.overflow = "hidden";
    stage.style.height = `${currentHeight}px`;
    stage.style.opacity = "1";
    stage.style.willChange = "height, opacity";
    stage.style.transition = "none";

    if (shell instanceof HTMLElement) {
        shell.style.opacity = "1";
        shell.style.transform = "translateY(0)";
        shell.style.transition = "none";
    }

    stage.offsetHeight;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            stage.style.transition = "height 320ms cubic-bezier(0.32, 0, 0.2, 1), opacity 240ms ease";
            stage.style.height = "0px";
            stage.style.opacity = "0";

            if (shell instanceof HTMLElement) {
                shell.style.transition = "transform 240ms ease, opacity 220ms ease";
                shell.style.opacity = "0";
                shell.style.transform = "translateY(-6px)";
            }
        });
    });

    let completed = false;
    const finish = () => {
        if (completed) return;
        completed = true;
        stage.hidden = true;
        stage.classList.add("is-hidden");
        stage.style.height = "";
        stage.style.opacity = "";
        stage.style.transition = "";
        stage.style.overflow = "";
        stage.style.willChange = "";

        if (shell instanceof HTMLElement) {
            shell.style.opacity = "";
            shell.style.transform = "";
            shell.style.transition = "";
        }

        onDone?.();
    };

    const onEnd = event => {
        if (event.target !== stage || event.propertyName !== "height") {
            return;
        }

        stage.removeEventListener("transitionend", onEnd);
        finish();
    };

    stage.addEventListener("transitionend", onEnd);
    window.setTimeout(() => {
        stage.removeEventListener("transitionend", onEnd);
        finish();
    }, 500);
}

function renderTaskPeriodGroup(group) {
    const isCollapsed = collapsedTaskPeriodKeys.has(group.key);
    const taskCount = group.tasks.length;
    const groupTone = getTaskPeriodGroupTone(group);
    const groupIcon = getTaskPeriodGroupIcon(group);
    const pills = renderTaskPeriodPills(group.tasks);

    return `
        <section class="tasks-period-group ${groupTone} ${isCollapsed ? "is-collapsed" : ""}" data-period-group="${escapeTaskText(group.key)}">
            <button class="tasks-period-toggle" type="button" aria-expanded="${isCollapsed ? "false" : "true"}" onclick="toggleTaskPeriodGroup(event, '${escapeTaskText(group.key)}')">
                <div class="tasks-period-copy">
                    <div class="tasks-period-heading-row">
                        <span class="tasks-period-icon" aria-hidden="true">
                            <i class="fas ${groupIcon}"></i>
                        </span>
                        <strong class="tasks-period-title">${escapeTaskText(group.label)}</strong>
                        <span class="tasks-period-count">${escapeTaskText(taskCount)}</span>
                    </div>
                    <div class="tasks-period-meta-row">
                        <span class="tasks-period-summary">${escapeTaskText(group.hint)} · ${escapeTaskText(renderTaskPeriodSummary(group.tasks))}</span>
                        ${pills ? `<span class="tasks-period-pills">${pills}</span>` : ""}
                    </div>
                </div>
                <span class="tasks-period-chevron" aria-hidden="true">
                    <i class="fas fa-chevron-${isCollapsed ? "down" : "up"}"></i>
                </span>
            </button>

            <div class="tasks-period-stage${isCollapsed ? " is-hidden" : ""}" data-period-stage ${isCollapsed ? "hidden" : ""}>
                <div class="tasks-period-body">
                    ${renderTaskPeriodItems(group.tasks)}
                </div>
            </div>
        </section>
    `;
}

function selectTaskTableRow(event, taskId) {
    if (!taskId) return;

    const target = event?.target;
    if (target?.closest?.("button, a, input, select, textarea, .table-actions, .status-dropdown")) {
        return;
    }

    const nextId = Number(taskId);
    const container = document.getElementById("tasksBoard");
    const nextCard = target?.closest?.("[data-task-card]") || container?.querySelector?.(`[data-task-id='${nextId}']`);
    const currentCard = container?.querySelector?.("[data-task-card].is-expanded");
    const currentStage = currentCard?.querySelector?.("[data-expand-stage]");

    const openNextCard = () => {
        const task = tasks.find(x => Number(x.id) === nextId);
        if (!task || !nextCard) {
            expandedTaskId = 0;
            return;
        }

        expandedTaskId = nextId;
        nextCard.classList.add("is-expanded");
        nextCard.insertAdjacentHTML("beforeend", renderTaskExpandedRow(task));
        playTaskExpandStageEnter(nextCard);
    };

    if (Number(expandedTaskId) === nextId && currentCard && currentStage) {
        collapseTaskExpandStage(currentStage, () => {
            currentStage.closest(".task-card-expand")?.remove();
            currentCard.classList.remove("is-expanded");
            expandedTaskId = 0;
        });
        return;
    }

    if (currentCard && currentStage) {
        collapseTaskExpandStage(currentStage, () => {
            currentStage.closest(".task-card-expand")?.remove();
            currentCard.classList.remove("is-expanded");
            openNextCard();
        });
        return;
    }

    openNextCard();
}

function renderTasksTable() {
    const container = document.getElementById("tasksBoard");
    if (!container) return;

    const filteredTasks = getFilteredTasksList();
    renderTaskDeadlineDashboard(filteredTasks);

    if (expandedTaskId && !filteredTasks.some(task => Number(task.id) === Number(expandedTaskId))) {
        expandedTaskId = 0;
    }

    if (!filteredTasks.length) {
        container.innerHTML = `
            <div class="tasks-board-empty">
                <div class="tasks-board-empty-icon"><i class="fas fa-list-check"></i></div>
                <strong>По текущим фильтрам задач не найдено</strong>
                <p>Попробуйте сменить статус, проект или строку поиска, чтобы вернуть нужный список.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = buildTaskPeriods(filteredTasks)
        .map(group => renderTaskPeriodGroup(group))
        .join("");

    playTaskExpandStageEnter(container);
}

function filterTasks() {
    renderTasksTable();
}

function resetTaskFilters() {
    const taskStatusFilter = document.getElementById("taskStatusFilter");
    const taskPriorityFilter = document.getElementById("taskPriorityFilter");
    const taskProjectFilter = document.getElementById("taskProjectFilter");
    const taskSearch = document.getElementById("taskSearch");

    if (taskStatusFilter) taskStatusFilter.value = "all";
    if (taskPriorityFilter) taskPriorityFilter.value = "all";
    if (taskProjectFilter) taskProjectFilter.value = "all";
    if (taskSearch) taskSearch.value = "";

    filterTasks();
}

function toggleTaskPeriodGroup(event, periodKey) {
    event?.stopPropagation?.();
    const toggle = event?.currentTarget || event?.target?.closest?.(".tasks-period-toggle");
    const group = toggle?.closest?.("[data-period-group]");
    const stage = group?.querySelector?.("[data-period-stage]");

    if (!toggle || !group || !stage) {
        if (collapsedTaskPeriodKeys.has(periodKey)) {
            collapsedTaskPeriodKeys.delete(periodKey);
        } else {
            collapsedTaskPeriodKeys.add(periodKey);
        }
        renderTasksTable();
        return;
    }

    const isCollapsed = group.classList.contains("is-collapsed");

    if (isCollapsed) {
        collapsedTaskPeriodKeys.delete(periodKey);
        setTaskPeriodCollapsedState(group, false);
        playTaskPeriodStageEnter(stage);
        return;
    }

    collapsedTaskPeriodKeys.add(periodKey);
    setTaskPeriodCollapsedState(group, true);
    collapseTaskPeriodStage(stage);
}

function closeStatusMenus() {
    document.querySelectorAll(".status-menu").forEach(menu => {
        menu.classList.add("hidden");
    });
}

function toggleStatusMenu(button) {
    const dropdown = button?.closest(".status-dropdown");
    const menu = dropdown?.querySelector(".status-menu");

    if (!dropdown || !menu) return;

    const shouldOpen = menu.classList.contains("hidden");
    closeStatusMenus();

    if (shouldOpen) {
        menu.classList.remove("hidden");
    }
}

function changeStatus(button, newStatus) {
    const dropdown = button?.closest(".status-dropdown");
    if (!dropdown) return;

    const hiddenInput = dropdown.querySelector(".employee-status-value");
    const badge = dropdown.querySelector(".task-status-badge");
    const badgeText = badge?.querySelector(".status-badge-text");

    if (hiddenInput) {
        hiddenInput.value = newStatus;
    }

    if (badge) {
        badge.className = `status-badge ${getStatusBadgeClass(newStatus)} task-status-badge`;
    }

    if (badgeText) {
        badgeText.textContent = getStatusText(newStatus);
    }

    closeStatusMenus();
}

function showAddTaskModal(projectId = null, stageName = "") {
    if (isEmployee) return;

    const taskName = document.getElementById("taskName");
    const taskDescription = document.getElementById("taskDescription");
    const taskProjectSelect = document.getElementById("taskProjectSelect");
    const taskPriority = document.getElementById("taskPriority");
    const taskPlannedTime = document.getElementById("taskPlannedTime");
    const taskDeadline = document.getElementById("taskDeadline");

    if (taskName) taskName.value = "";
    if (taskDescription) taskDescription.value = "";
    if (taskPriority) taskPriority.value = "medium";
    if (taskPlannedTime) taskPlannedTime.value = "8";
    if (taskDeadline) taskDeadline.value = getDefaultTaskDeadlineValue();

    fillProjectSelect("taskProjectSelect", projectId);

    const selectedProjectId = Number(projectId || taskProjectSelect?.value || 0);

    if (taskProjectSelect && selectedProjectId > 0) {
        taskProjectSelect.value = String(selectedProjectId);
    }

    fillTaskAssigneeSelect(selectedProjectId, "taskAssignee");
    fillTaskStageSelect(selectedProjectId, "taskStageSelect", stageName || "");

    if (taskProjectSelect) {
        taskProjectSelect.onchange = function () {
            const currentProjectId = Number(this.value || 0);
            fillTaskAssigneeSelect(currentProjectId, "taskAssignee");
            fillTaskStageSelect(currentProjectId, "taskStageSelect", "");
        };
    }

    openModal("addTaskModal");
}

async function addTask() {
    if (isEmployee) return;

    const name = document.getElementById("taskName")?.value.trim() || "";
    if (!name) {
        showNotification("Введите название задачи");
        return;
    }

    const projectId = Number(document.getElementById("taskProjectSelect")?.value || 0);
    if (!projectId) {
        showNotification("Выберите проект");
        return;
    }

    const stageName = document.getElementById("taskStageSelect")?.value || "";
    if (!stageName) {
        showNotification("Выберите этап проекта");
        return;
    }

    const userId = Number(document.getElementById("taskAssignee")?.value || 0);
    if (!userId) {
        showNotification("Выберите исполнителя");
        return;
    }

    const dto = {
        name: name,
        description: buildTaskDescriptionPayload(document.getElementById("taskDescription")?.value.trim() || "", {}),
        projectId: projectId,
        userId: userId,
        priority: document.getElementById("taskPriority")?.value || "medium",
        status: "new",
        plannedTime: parseFloat(document.getElementById("taskPlannedTime")?.value || "0"),
        deadline: document.getElementById("taskDeadline")?.value || null,
        stageName: stageName
    };

    try {
        const res = await fetch("/api/tasks", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify(dto)
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка сервера");
            return;
        }

        const newTask = normalizeTask(data.task);
        tasks.unshift(newTask);

        closeModal("addTaskModal");

        fillTaskSelects();
        refreshProjectsStats();
        renderTasksTable();
        renderDashboard();
        renderDashboardTasks();
        renderProjects();

        if (typeof showProjectDetails === "function" && currentOpenedProjectId) {
            selectedProjectStageFilter = stageName || "";
            showProjectDetails(currentOpenedProjectId);
        }

        showNotification("Задача сохранена в БД");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

function openEditTaskModal(id) {
    if (isEmployee) return;

    if (typeof suspendProjectViewBeforeTaskModal === "function") {
        suspendProjectViewBeforeTaskModal(id);
    }

    const task = tasks.find(t => t.id === id);
    if (!task) {
        showNotification("Задача не найдена");
        return;
    }

    const editTaskId = document.getElementById("editTaskId");
    const editTaskName = document.getElementById("editTaskName");
    const editTaskDescription = document.getElementById("editTaskDescription");
    const editTaskPriority = document.getElementById("editTaskPriority");
    const editTaskStatus = document.getElementById("editTaskStatus");
    const editTaskPlannedTime = document.getElementById("editTaskPlannedTime");
    const editTaskDeadline = document.getElementById("editTaskDeadline");

    if (editTaskId) editTaskId.value = task.id;
    if (editTaskName) editTaskName.value = task.name || "";
    if (editTaskDescription) editTaskDescription.value = task.description || "";
    if (editTaskPriority) editTaskPriority.value = task.priority || "medium";
    if (editTaskStatus) editTaskStatus.value = task.status || "new";
    if (editTaskPlannedTime) editTaskPlannedTime.value = task.plannedTime || 0;
    if (editTaskDeadline) editTaskDeadline.value = task.deadlineRaw || "";

    fillProjectSelect("editTaskProject", task.projectId);

    const editProjectSelect = document.getElementById("editTaskProject");
    if (editProjectSelect) {
        editProjectSelect.value = String(task.projectId || 0);
    }

    fillTaskAssigneeSelect(task.projectId, "editTaskAssignee", task.userId);
    fillTaskStageSelect(task.projectId, "editTaskStageSelect", task.stageName || "");

    if (editProjectSelect) {
        editProjectSelect.onchange = function () {
            const currentProjectId = Number(this.value || 0);
            fillTaskAssigneeSelect(currentProjectId, "editTaskAssignee");
            fillTaskStageSelect(currentProjectId, "editTaskStageSelect", "");
        };
    }

    openModal("editTaskModal");
}

async function saveTaskChanges() {
    const taskId = Number(document.getElementById("editTaskId")?.value || 0);
    const currentTask = tasks.find(t => Number(t.id) === taskId);
    const stageName = document.getElementById("editTaskStageSelect")?.value || "";

    const dto = {
        id: taskId,
        name: document.getElementById("editTaskName")?.value.trim() || "",
        description: buildTaskDescriptionPayload(
            document.getElementById("editTaskDescription")?.value.trim() || "",
            currentTask?.taskMeta || {}
        ),
        projectId: Number(document.getElementById("editTaskProject")?.value || 0),
        userId: Number(document.getElementById("editTaskAssignee")?.value || 0),
        priority: document.getElementById("editTaskPriority")?.value || "medium",
        status: document.getElementById("editTaskStatus")?.value || "new",
        plannedTime: parseFloat(document.getElementById("editTaskPlannedTime")?.value || "0"),
        deadline: document.getElementById("editTaskDeadline")?.value || null,
        stageName: stageName
    };

    if (!dto.name) {
        showNotification("Введите название задачи");
        return;
    }

    if (!stageName) {
        showNotification("Выберите этап проекта");
        return;
    }

    if (!dto.userId) {
        showNotification("Выберите исполнителя");
        return;
    }

    try {
        const res = await fetch(`/api/tasks/${taskId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify(dto)
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка сохранения");
            return;
        }

        const updatedTask = normalizeTask(data.task);
        const index = tasks.findIndex(t => t.id === updatedTask.id);

        if (index !== -1) {
            tasks[index] = updatedTask;
        }

        closeModal("editTaskModal");
        renderTasksTable();
        renderDashboard();
        renderDashboardTasks();
        fillTaskSelects();

        refreshProjectsStats();
        renderProjects();

        if (typeof restoreProjectViewAfterTaskModal === "function") {
            restoreProjectViewAfterTaskModal();
        } else if (typeof showProjectDetails === "function") {
            showProjectDetails(dto.projectId);
        }

        showNotification("Изменения сохранены в БД");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

function openCompleteTaskModal(taskId) {
    const task = tasks.find(x => Number(x.id) === Number(taskId));
    if (!task) {
        showNotification("Задача не найдена");
        return;
    }

    const completeTaskId = document.getElementById("completeTaskId");
    const completeTaskTitle = document.getElementById("completeTaskTitle");
    const completeTaskReport = document.getElementById("completeTaskReport");

    if (completeTaskId) completeTaskId.value = String(task.id);
    if (completeTaskTitle) completeTaskTitle.textContent = task.name || "Задача";
    if (completeTaskReport) completeTaskReport.value = task.completionReportText || "";

    openModal("completeTaskModal");
}

async function submitTaskCompletionReport() {
    const taskId = Number(document.getElementById("completeTaskId")?.value || 0);
    const reportText = document.getElementById("completeTaskReport")?.value.trim() || "";
    const task = tasks.find(x => Number(x.id) === Number(taskId));

    if (!task) {
        showNotification("Задача не найдена");
        return;
    }

    if (!reportText) {
        showNotification("Добавьте отчёт по выполнению");
        return;
    }

    const nextMeta = {
        ...(task.taskMeta || {}),
        completionReport: {
            text: reportText,
            submittedAt: new Date().toISOString(),
            submittedBy: getTaskReporterName()
        }
    };

    try {
        const response = await fetch(`/api/tasks/${task.id}/review`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({
                id: task.id,
                description: buildTaskDescriptionPayload(task.description || "", nextMeta)
            })
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
            showNotification(result?.error || "Не удалось отправить задачу на проверку");
            return;
        }

        const updatedTask = normalizeTask(result.task);
        const index = tasks.findIndex(x => Number(x.id) === Number(updatedTask.id));
        if (index !== -1) {
            tasks[index] = updatedTask;
        }

        closeModal("completeTaskModal");
        fillTaskSelects();
        refreshProjectsStats();
        renderTasksTable();
        renderDashboard();
        renderDashboardTasks();
        renderProjects();

        showNotification("Отчёт отправлен менеджеру на проверку");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

function openDeleteTaskModal(id) {
    if (isEmployee) return;

    if (typeof suspendProjectViewBeforeTaskModal === "function") {
        suspendProjectViewBeforeTaskModal(id);
    }

    const task = tasks.find(t => t.id === id);
    if (!task) {
        showNotification("Задача не найдена");
        return;
    }

    const deleteTaskId = document.getElementById("deleteTaskId");
    const deleteTaskName = document.getElementById("deleteTaskName");

    if (deleteTaskId) deleteTaskId.value = task.id;
    if (deleteTaskName) deleteTaskName.textContent = task.name;

    openModal("deleteTaskModal");
}

async function confirmDeleteTask() {
    const id = Number(document.getElementById("deleteTaskId")?.value || 0);

    try {
        const res = await fetch(`/api/tasks/${id}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            }
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка удаления");
            return;
        }

        const deletedTask = tasks.find(t => t.id === id);
        const deletedProjectId = deletedTask ? deletedTask.projectId : 0;

        tasks = tasks.filter(t => t.id !== id);

        closeModal("deleteTaskModal");
        renderTasksTable();
        renderDashboard();
        renderDashboardTasks();
        fillTaskSelects();

        refreshProjectsStats();
        renderProjects();

        if (typeof restoreProjectViewAfterTaskModal === "function") {
            restoreProjectViewAfterTaskModal();
        } else if (deletedProjectId && typeof showProjectDetails === "function") {
            showProjectDetails(deletedProjectId);
        }

        showNotification("Задача удалена из БД");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

async function startTask(id) {
    let task = getAvailableTimerTasks().find(t => Number(t.id) === Number(id));

    if (!task && (isAdmin || isManager)) {
        task = (Array.isArray(tasks) ? tasks : []).find(t => Number(t.id) === Number(id));
    }

    if (!task) {
        showNotification("Задача недоступна для запуска");
        return;
    }

    if (task.status === "done") {
        showNotification("Завершённую задачу нельзя запустить");
        return;
    }

    setActiveTask(task);

    if (task.status === "new") {
        const dto = {
            id: task.id,
            name: task.name,
            description: buildTaskDescriptionPayload(task.description || "", task.taskMeta || {}),
            projectId: task.projectId,
            userId: task.userId || 0,
            priority: task.priority || "medium",
            status: "progress",
            plannedTime: Number(task.plannedTime || 0),
            deadline: task.deadlineRaw || null,
            stageName: task.stageName || ""
        };

        try {
            const res = await fetch(`/api/tasks/${task.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "RequestVerificationToken": getRequestVerificationToken()
                },
                body: JSON.stringify(dto)
            });

            const data = await res.json();

            if (!res.ok || !data.ok) {
                showNotification(data?.error || "Не удалось обновить статус задачи");
                return;
            }

            const updatedTask = normalizeTask(data.task);
            const index = tasks.findIndex(t => Number(t.id) === Number(updatedTask.id));

            if (index !== -1) {
                tasks[index] = updatedTask;
            }

            setActiveTask(updatedTask);
            fillTaskSelects();
            refreshProjectsStats();
            renderTasksTable();
            renderDashboard();
            renderDashboardTasks();
            renderProjects();
        } catch {
            showNotification("Ошибка сети/сервера");
            return;
        }
    }

    await startTracking();
    highlightBottomTracker();
    showNotification(`Запущена задача: ${task.name}`);
}

document.addEventListener("click", function (e) {
    if (!e.target.closest(".status-dropdown")) {
        closeStatusMenus();
    }
});
