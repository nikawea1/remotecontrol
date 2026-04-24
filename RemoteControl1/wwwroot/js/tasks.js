// Файл: RemoteControl1/wwwroot/js/tasks.js

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

async function saveEmployeeTaskStatus(taskId) {
    const statusInput = document.getElementById(`employeeStatus_${taskId}`);
    if (!statusInput) return;

    const newStatus = statusInput.value;
    const task = tasks.find(x => Number(x.id) === Number(taskId));
    if (!task) return;

    try {
        const response = await fetch("/MainPage?handler=UpdateTask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({
                id: task.id,
                name: task.name,
                description: task.description || "",
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

function selectTaskTableRow(event, row) {
    if (!row) return;

    const target = event?.target;
    if (target?.closest?.("button, a, input, select, textarea, .table-actions, .status-dropdown")) {
        return;
    }

    const table = row.closest("table");
    const wasSelected = row.classList.contains("is-selected");

    table?.querySelectorAll("tbody tr.is-selected").forEach(x => x.classList.remove("is-selected"));

    if (!wasSelected) {
        row.classList.add("is-selected");
    }
}

function renderTasksTable() {
    const container = document.getElementById("tasksTable");
    if (!container) return;

    const filterStatus = document.getElementById("taskStatusFilter")?.value || "all";
    const filterPriority = document.getElementById("taskPriorityFilter")?.value || "all";
    const filterProject = document.getElementById("taskProjectFilter")?.value || "all";
    const searchText = document.getElementById("taskSearch")?.value.toLowerCase() || "";

    const filteredTasks = tasks.filter(task => {
        if (filterStatus !== "all" && task.status !== filterStatus) return false;
        if (filterPriority !== "all" && task.priority !== filterPriority) return false;
        if (filterProject !== "all" && task.projectId !== Number(filterProject)) return false;
        if (searchText && !task.name.toLowerCase().includes(searchText)) return false;
        return true;
    });

    if (!filteredTasks.length) {
        container.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; color: var(--gray);">Задачи не найдены</td>
            </tr>
        `;
        return;
    }

    container.innerHTML = filteredTasks.map(task => `
        <tr onclick="selectTaskTableRow(event, this)">
            <td title="ID ${escapeTaskText(task.id)}">${escapeTaskText(task.id)}</td>
            <td title="${escapeTaskText(task.name || "-")}"><strong>${escapeTaskText(task.name || "-")}</strong></td>
            <td title="${escapeTaskText(task.project || "-")}">${escapeTaskText(task.project || "-")}</td>
            <td title="${escapeTaskText(task.stageName || "-")}">${escapeTaskText(task.stageName || "-")}</td>
            <td><span class="badge ${getPriorityClass(task.priority)}">${getPriorityText(task.priority)}</span></td>
            <td title="${escapeTaskText(task.deadline || "-")}">${escapeTaskText(task.deadline || "")}</td>
            <td>
                ${isEmployee
            ? `<div class="task-status-cell">
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
                       </div>`
            : `<span class="task-status ${getStatusBadgeClass(task.status)}">${getStatusText(task.status)}</span>`
        }
            </td>
            <td title="${escapeTaskText(task.assignee || "-")}"><span class="task-assignee-name">${escapeTaskText(task.assignee || "")}</span></td>
            <td>
                <div class="table-actions">
                    ${isEmployee
            ? `<button class="btn btn-sm btn-primary" onclick="saveEmployeeTaskStatus(${task.id})" title="Сохранить статус">
                                <i class="fas fa-save"></i>
                           </button>`
            : `<button class="btn btn-sm btn-outline" onclick="openEditTaskModal(${task.id})" title="Редактировать">
                                <i class="fas fa-edit"></i>
                           </button>
                           <button class="btn btn-sm btn-danger" onclick="openDeleteTaskModal(${task.id})" title="Удалить">
                                <i class="fas fa-trash"></i>
                           </button>`
        }

                    ${(isEmployee || isManager || isAdmin) ? `
                        <button class="btn btn-sm btn-success" onclick="startTask(${task.id})" title="Начать">
                            <i class="fas fa-play"></i>
                        </button>
                    ` : ``}
                </div>
            </td>
        </tr>
    `).join("");
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
        description: document.getElementById("taskDescription")?.value.trim() || "",
        projectId: projectId,
        userId: userId,
        priority: document.getElementById("taskPriority")?.value || "medium",
        status: "new",
        plannedTime: parseFloat(document.getElementById("taskPlannedTime")?.value || "0"),
        deadline: document.getElementById("taskDeadline")?.value || null,
        stageName: stageName
    };

    try {
        const res = await fetch("/MainPage?handler=AddTask", {
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
    const stageName = document.getElementById("editTaskStageSelect")?.value || "";

    const dto = {
        id: Number(document.getElementById("editTaskId")?.value || 0),
        name: document.getElementById("editTaskName")?.value.trim() || "",
        description: document.getElementById("editTaskDescription")?.value.trim() || "",
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
        const res = await fetch("/MainPage?handler=UpdateTask", {
            method: "POST",
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
        const res = await fetch("/MainPage?handler=DeleteTask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({ id: id })
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
    const task = getAvailableTimerTasks().find(t => Number(t.id) === Number(id));

    if (!task) {
        showNotification("Задача не найдена");
        return;
    }

    setActiveTask(task);

    if (task.status === "new") {
        const dto = {
            id: task.id,
            name: task.name,
            description: task.description || "",
            projectId: task.projectId,
            userId: task.userId || 0,
            priority: task.priority || "medium",
            status: "progress",
            plannedTime: Number(task.plannedTime || 0),
            deadline: task.deadlineRaw || null,
            stageName: task.stageName || ""
        };

        try {
            const res = await fetch("/MainPage?handler=UpdateTask", {
                method: "POST",
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
