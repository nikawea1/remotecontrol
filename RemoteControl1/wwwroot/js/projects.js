const rcProjectData = window.remoteControlData || {};

window.projects = Array.isArray(window.projects)
    ? window.projects
    : (Array.isArray(rcProjectData.projects) ? rcProjectData.projects : []);

window.tasks = Array.isArray(window.tasks)
    ? window.tasks
    : (Array.isArray(rcProjectData.tasks) ? rcProjectData.tasks : []);

window.users = Array.isArray(window.users)
    ? window.users
    : (Array.isArray(rcProjectData.users) ? rcProjectData.users : []);

window.isEmployee = typeof window.isEmployee === "boolean"
    ? window.isEmployee
    : String(rcProjectData.isEmployee) === "true";

let currentOpenedProjectId = null;
let currentProjectPreset = "functional";
let projectStageDraft = [];
let editProjectStageDraft = [];
let filteredProjects = [];

const projectPresets = {
    linear: {
        title: "Линейный",
        description: "Этапы идут по порядку",
        stages: ["Анализ", "Проектирование", "Разработка", "Тестирование", "Запуск"]
    },
    functional: {
        title: "Функциональный",
        description: "Этапы как направления работы",
        stages: ["Backend", "Frontend", "UI/UX", "QA", "Docs"]
    },
    hybrid: {
        title: "Гибридный",
        description: "Смешанная модель проекта",
        stages: [
            "Подготовка",
            "Разработка / Backend",
            "Разработка / Frontend",
            "Разработка / UI/UX",
            "Сдача / QA",
            "Сдача / Docs",
            "Сдача / Релиз"
        ]
    }
};

function getRequestVerificationTokenSafe() {
    if (typeof getRequestVerificationToken === "function") {
        return getRequestVerificationToken();
    }

    const input = document.querySelector('input[name="__RequestVerificationToken"]');
    return input ? input.value : "";
}

function normalizeProject(project) {
    if (!project) return project;

    return {
        ...project,
        id: Number(project.id || 0),
        managerId: project.managerId != null && project.managerId !== "" ? Number(project.managerId) : null,
        memberIds: Array.isArray(project.memberIds) ? project.memberIds.map(x => Number(x)) : [],
        stageNames: Array.isArray(project.stageNames) ? project.stageNames : [],
        progress: Number(project.progress || 0),
        tasksCount: Number(project.tasksCount || 0),
        membersCount: Number(project.membersCount || 0),
        projectTypeName: project.projectTypeName || project.projectType || "functional"
    };
}

function normalizeProjectType(type) {
    const value = String(type || "").toLowerCase();
    if (value === "linear") return "linear";
    if (value === "hybrid") return "hybrid";
    return "functional";
}

function getProjectTypeText(type) {
    const t = normalizeProjectType(type);
    if (t === "linear") return "Линейный";
    if (t === "hybrid") return "Гибридный";
    return "Функциональный";
}

function refreshProjectsStats() {
    window.projects = window.projects.map(project => {
        const p = normalizeProject(project);
        const projectId = Number(p.id);
        const projectTasks = window.tasks.filter(t => Number(t.projectId) === projectId);
        const tasksCount = projectTasks.length;

        let progress = 0;

        if (Array.isArray(p.stageNames) && p.stageNames.length > 0) {
            const stagePercents = p.stageNames.map(stageName => {
                const stageTasks = projectTasks.filter(t => String(t.stageName || "") === String(stageName || ""));
                if (!stageTasks.length) return 0;

                const doneCount = stageTasks.filter(t => t.status === "done").length;
                return Math.round((doneCount / stageTasks.length) * 100);
            });

            progress = stagePercents.length
                ? Math.round(stagePercents.reduce((sum, x) => sum + x, 0) / stagePercents.length)
                : 0;
        } else {
            const doneCount = projectTasks.filter(t => t.status === "done").length;
            progress = tasksCount > 0 ? Math.round((doneCount / tasksCount) * 100) : 0;
        }

        return {
            ...p,
            tasksCount,
            progress,
            membersCount: Array.isArray(p.memberIds) ? p.memberIds.length : Number(p.membersCount || 0)
        };
    });

    filteredProjects = [...window.projects];
}

function getManagersForProjectSelect() {
    return window.users
        .filter(u => u.role === "manager" || u.role === "admin")
        .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "ru"));
}

function fillProjectManagerSelect(selectedId = null) {
    const select = document.getElementById("projectManagerSelect");
    if (!select) return;

    const managers = getManagersForProjectSelect();

    select.innerHTML =
        `<option value="">Выберите менеджера</option>` +
        managers.map(u => `<option value="${u.id}">${u.fullName}</option>`).join("");

    if (selectedId && [...select.options].some(x => Number(x.value) === Number(selectedId))) {
        select.value = String(selectedId);
    }
}

function fillEditProjectManagerSelect(selectedId = null) {
    const select = document.getElementById("editProjectManagerSelect");
    if (!select) return;

    const managers = getManagersForProjectSelect();

    select.innerHTML =
        `<option value="">Выберите менеджера</option>` +
        managers.map(u => `<option value="${u.id}">${u.fullName}</option>`).join("");

    if (selectedId && [...select.options].some(x => Number(x.value) === Number(selectedId))) {
        select.value = String(selectedId);
    }
}

function fillProjectMembersSelect(selectedIds = []) {
    const select = document.getElementById("projectMembersSelect");
    const search = document.getElementById("projectMembersSearch");
    if (!select) return;

    if (search) search.value = "";

    const availableUsers = window.users
        .filter(u => u.role !== "admin")
        .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "ru"));

    select.innerHTML = availableUsers
        .map(u => `<option value="${u.id}">${u.fullName} — ${u.position || "без должности"}</option>`)
        .join("");

    [...select.options].forEach(option => {
        option.selected = selectedIds.includes(Number(option.value));
    });
}

function fillEditProjectMembersSelect(selectedIds = []) {
    const select = document.getElementById("editProjectMembersSelect");
    const search = document.getElementById("editProjectMembersSearch");
    if (!select) return;

    if (search) search.value = "";

    const availableUsers = window.users
        .filter(u => u.role !== "admin")
        .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "ru"));

    select.innerHTML = availableUsers
        .map(u => `<option value="${u.id}">${u.fullName} — ${u.position || "без должности"}</option>`)
        .join("");

    [...select.options].forEach(option => {
        option.selected = selectedIds.includes(Number(option.value));
    });
}

function filterProjectMembersOptions(searchInputId, selectId) {
    const searchInput = document.getElementById(searchInputId);
    const select = document.getElementById(selectId);
    if (!searchInput || !select) return;

    const query = (searchInput.value || "").trim().toLowerCase();

    [...select.options].forEach(option => {
        const text = (option.textContent || "").toLowerCase();
        option.hidden = !!query && !text.includes(query);
    });
}

function renderProjectPresetCards(containerId, selectedType = "functional") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const current = normalizeProjectType(selectedType);

    container.innerHTML = Object.entries(projectPresets).map(([key, preset]) => `
        <div class="template-card ${current === key ? "active" : ""}" onclick="selectProjectPreset('${containerId}', '${key}')">
            <div class="template-top">
                <div class="template-name">${preset.title}</div>
                <div class="template-badge">${preset.stages.length} этапов</div>
            </div>
            <div class="template-description">${preset.description}</div>
            <div class="template-stages">
                ${preset.stages.map(stage => `<span class="stage-chip">${stage}</span>`).join("")}
            </div>
        </div>
    `).join("");
}

function renderProjectPresetStages(containerId, stages) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = stages.map((stage, index) => `
        <div class="stage-editor-item">
            <div>
                <strong>${index + 1}. ${stage}</strong>
            </div>
        </div>
    `).join("");
}

function renderEditProjectStagesPreview() {
    renderProjectPresetStages("editProjectStagesPreview", editProjectStageDraft);
}

function selectProjectPreset(containerId, type) {
    const normalized = normalizeProjectType(type);

    if (containerId === "projectPresetList") {
        currentProjectPreset = normalized;
        projectStageDraft = [...projectPresets[normalized].stages];
        renderProjectPresetCards("projectPresetList", normalized);
        renderProjectPresetStages("projectPresetStagesPreview", projectStageDraft);
        return;
    }

    editProjectStageDraft = [...projectPresets[normalized].stages];
    renderProjectPresetCards("editProjectPresetList", normalized);
    renderEditProjectStagesPreview();
}

function showAddProjectModal() {
    currentProjectPreset = "functional";
    projectStageDraft = [...projectPresets.functional.stages];

    const projectName = document.getElementById("projectName");
    const projectDescription = document.getElementById("projectDescription");

    if (projectName) projectName.value = "";
    if (projectDescription) projectDescription.value = "";

    fillProjectManagerSelect();
    fillProjectMembersSelect([]);
    renderProjectPresetCards("projectPresetList", currentProjectPreset);
    renderProjectPresetStages("projectPresetStagesPreview", projectStageDraft);

    openModal("addProjectModal");
}

async function addProject() {
    const name = document.getElementById("projectName")?.value.trim() || "";
    const description = document.getElementById("projectDescription")?.value.trim() || "";
    const managerId = Number(document.getElementById("projectManagerSelect")?.value || 0);
    const memberIds = [...(document.getElementById("projectMembersSelect")?.selectedOptions || [])].map(x => Number(x.value));

    if (!name) {
        showNotification("Введите название проекта");
        return;
    }

    const dto = {
        name,
        description,
        managerId: managerId || null,
        memberIds,
        projectType: currentProjectPreset,
        stageNames: projectStageDraft
    };

    try {
        const res = await fetch("/MainPage?handler=AddProject", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationTokenSafe()
            },
            body: JSON.stringify(dto)
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось создать проект");
            return;
        }

        if (data.project) {
            window.projects.unshift(normalizeProject(data.project));
            refreshProjectsStats();
            filterProjects();
        }

        closeModal("addProjectModal");
        showNotification("Проект создан");
    } catch (e) {
        console.error(e);
        showNotification("Ошибка сети");
    }
}

function openEditProjectModal(id) {
    const project = window.projects.find(p => Number(p.id) === Number(id));
    if (!project) return;

    currentOpenedProjectId = Number(id);

    document.getElementById("editProjectId").value = project.id;
    document.getElementById("editProjectName").value = project.name || "";
    document.getElementById("editProjectDescription").value = project.description || "";

    fillEditProjectManagerSelect(project.managerId);
    fillEditProjectMembersSelect(project.memberIds || []);

    const type = normalizeProjectType(project.projectTypeName);
    editProjectStageDraft = Array.isArray(project.stageNames) && project.stageNames.length
        ? [...project.stageNames]
        : [...projectPresets[type].stages];

    renderProjectPresetCards("editProjectPresetList", type);
    renderEditProjectStagesPreview();

    openModal("editProjectModal");
}

function addEditProjectStage() {
    const input = document.getElementById("newEditStageName");
    if (!input) return;

    const value = (input.value || "").trim();
    if (!value) return;

    editProjectStageDraft.push(value);
    input.value = "";
    renderEditProjectStagesPreview();
}

async function saveProjectChanges() {
    const id = Number(document.getElementById("editProjectId")?.value || 0);
    const name = document.getElementById("editProjectName")?.value.trim() || "";
    const description = document.getElementById("editProjectDescription")?.value.trim() || "";
    const managerId = Number(document.getElementById("editProjectManagerSelect")?.value || 0);
    const memberIds = [...(document.getElementById("editProjectMembersSelect")?.selectedOptions || [])].map(x => Number(x.value));

    if (!name) {
        showNotification("Введите название проекта");
        return;
    }

    const dto = {
        id,
        name,
        description,
        managerId: managerId || null,
        memberIds,
        stageNames: editProjectStageDraft
    };

    try {
        const res = await fetch("/MainPage?handler=UpdateProject", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationTokenSafe()
            },
            body: JSON.stringify(dto)
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось сохранить изменения");
            return;
        }

        if (data.project) {
            const updated = normalizeProject(data.project);
            const index = window.projects.findIndex(x => Number(x.id) === Number(updated.id));
            if (index !== -1) {
                window.projects[index] = updated;
            }
            refreshProjectsStats();
            filterProjects();
        }

        closeModal("editProjectModal");
        restoreProjectViewModal();
        showNotification("Проект обновлён");
    } catch (e) {
        console.error(e);
        showNotification("Ошибка сети");
    }
}

function openDeleteProjectModal(id) {
    const project = window.projects.find(p => Number(p.id) === Number(id));
    if (!project) return;

    document.getElementById("deleteProjectId").value = project.id;
    document.getElementById("deleteProjectName").textContent = project.name || "";
    document.getElementById("deleteProjectTasksCount").textContent =
        window.tasks.filter(t => Number(t.projectId) === Number(project.id)).length;

    openModal("deleteProjectModal");
}

async function confirmDeleteProject() {
    const id = Number(document.getElementById("deleteProjectId")?.value || 0);

    try {
        const res = await fetch("/MainPage?handler=DeleteProject", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationTokenSafe()
            },
            body: JSON.stringify({ id })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось удалить проект");
            return;
        }

        window.projects = window.projects.filter(p => Number(p.id) !== Number(id));
        refreshProjectsStats();
        filterProjects();

        closeModal("deleteProjectModal");
        closeProjectViewModal();
        showNotification("Проект удалён");
    } catch (e) {
        console.error(e);
        showNotification("Ошибка сети");
    }
}

function getProjectStatus(project) {
    return Number(project.progress || 0) >= 100 ? "completed" : "active";
}

function filterProjects() {
    const search = (document.getElementById("projectSearch")?.value || "").trim().toLowerCase();
    const status = document.getElementById("projectStatusFilter")?.value || "all";

    filteredProjects = window.projects.filter(project => {
        const matchSearch =
            !search ||
            (project.name || "").toLowerCase().includes(search) ||
            (project.description || "").toLowerCase().includes(search);

        const matchStatus = status === "all" || getProjectStatus(project) === status;

        return matchSearch && matchStatus;
    });

    sortProjects();
}

function sortProjects() {
    const sort = document.getElementById("projectSort")?.value || "name";

    filteredProjects.sort((a, b) => {
        if (sort === "tasks") {
            return Number(b.tasksCount || 0) - Number(a.tasksCount || 0);
        }

        if (sort === "progress") {
            return Number(b.progress || 0) - Number(a.progress || 0);
        }

        return (a.name || "").localeCompare(b.name || "", "ru");
    });

    renderProjects();
}

function resetProjectFilters() {
    const search = document.getElementById("projectSearch");
    const sort = document.getElementById("projectSort");
    const status = document.getElementById("projectStatusFilter");

    if (search) search.value = "";
    if (sort) sort.value = "name";
    if (status) status.value = "all";

    filteredProjects = [...window.projects];
    sortProjects();
}

function getProjectTypeBadgeText(project) {
    return getProjectTypeText(project.projectTypeName);
}

function renderProjects() {
    const container = document.getElementById("projectsList");
    if (!container) return;

    if (!filteredProjects.length) {
        container.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; margin-bottom:0;">
                <div style="color: var(--gray);">Проектов пока нет</div>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredProjects.map(project => `
        <div class="project-card" onclick="showProjectDetails(${project.id})">
            <div class="project-top">
                <div class="project-title-wrap">
                    <div class="project-name">${project.name}</div>
                    <div class="project-type-badge">
                        <i class="fas fa-layer-group"></i>
                        ${getProjectTypeBadgeText(project)}
                    </div>
                </div>

                <div class="project-header-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-sm btn-outline" type="button" title="Открыть проект" onclick="showProjectDetails(${project.id})">
                        <i class="fas fa-eye"></i>
                    </button>

                    ${!window.isEmployee ? `
                        <button class="btn btn-sm btn-outline" type="button" title="Редактировать проект" onclick="openEditProjectModal(${project.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" type="button" title="Удалить проект" onclick="openDeleteProjectModal(${project.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ``}
                </div>
            </div>

            <div class="project-desc">${project.description || "Без описания"}</div>

            <div class="project-main-metrics">
                <div class="metric-box">
                    <div class="label">Менеджер</div>
                    <div class="value">${project.managerName || "—"}</div>
                </div>

                <div class="metric-box">
                    <div class="label">Задач</div>
                    <div class="value">${project.tasksCount || 0}</div>
                </div>

                <div class="metric-box">
                    <div class="label">Готовность</div>
                    <div class="value">${project.progress || 0}%</div>
                </div>
            </div>

            <div class="project-progress-box">
                <div class="project-progress-top">
                    <div class="project-progress-label">Общий прогресс проекта</div>
                    <div class="project-progress-value">${project.progress || 0}%</div>
                </div>

                <div class="progress-bar">
                    <div class="progress-fill" style="width:${project.progress || 0}%"></div>
                </div>
            </div>

            <div class="project-secondary">
                <div class="metric-box">
                    <div class="label">Статус</div>
                    <div class="value">${getProjectStatus(project) === "completed" ? "Завершен" : "Активный"}</div>
                </div>

                <div class="metric-box">
                    <div class="label">Участники</div>
                    <div class="value">${project.membersCount || 0}</div>
                </div>
            </div>

            <div class="project-stages-preview">
                <div class="stages-preview-title">Этапы проекта</div>
                <div class="stages-preview-list">
                    ${(project.stageNames && project.stageNames.length)
            ? `
                            ${project.stageNames.slice(0, 4).map(stage => `<span class="stage-chip">${stage}</span>`).join("")}
                            ${project.stageNames.length > 4 ? `<span class="stage-chip">...</span>` : ""}
                        `
            : `<span class="stage-chip">Этапы не заданы</span>`
        }
                </div>
            </div>

            <div class="project-card-bottom">
                <div class="inline-pills">
                    <span class="tiny-pill">
                        <i class="fas fa-users"></i>
                        ${project.membersCount || 0} участников
                    </span>

                    <span class="tiny-pill">
                        <i class="fas fa-list-check"></i>
                        ${project.tasksCount || 0} задач
                    </span>
                </div>

                <span class="open-hint">
                    <span>Развернуть проект</span>
                    <i class="fas fa-arrow-right"></i>
                </span>
            </div>
        </div>
    `).join("");
}

function getProjectTasks(projectId) {
    return window.tasks.filter(t => Number(t.projectId) === Number(projectId));
}

function getStageProgress(projectId, stageName) {
    const stageTasks = window.tasks.filter(t =>
        Number(t.projectId) === Number(projectId) &&
        String(t.stageName || "") === String(stageName || "")
    );

    if (!stageTasks.length) return 0;

    const doneCount = stageTasks.filter(t => t.status === "done").length;
    return Math.round((doneCount / stageTasks.length) * 100);
}

function getCurrentStage(project) {
    const stages = Array.isArray(project.stageNames) ? project.stageNames : [];
    if (!stages.length) return "";

    for (const stage of stages) {
        const stageTasks = window.tasks.filter(t =>
            Number(t.projectId) === Number(project.id) &&
            String(t.stageName || "") === String(stage)
        );

        if (!stageTasks.length) return stage;

        const allDone = stageTasks.every(t => t.status === "done");
        if (!allDone) return stage;
    }

    return stages[stages.length - 1] || "";
}

function getNextStage(project) {
    const stages = Array.isArray(project.stageNames) ? project.stageNames : [];
    const current = getCurrentStage(project);
    const index = stages.findIndex(x => x === current);

    if (index === -1) return "";
    return stages[index + 1] || "";
}

function buildProjectViewContent(project) {
    const projectTasks = getProjectTasks(project.id);
    const currentStage = getCurrentStage(project);
    const nextStage = getNextStage(project);

    return `
        <div class="detail-hero">
            <div class="detail-hero-top">
                <div>
                    <h2>${project.name}</h2>
                    <p>${project.description || "Без описания"}</p>
                </div>
            </div>

            <div class="detail-pills">
                <span class="detail-pill"><i class="fas fa-layer-group"></i> ${getProjectTypeText(project.projectTypeName)}</span>
                <span class="detail-pill"><i class="fas fa-user-tie"></i> ${project.managerName || "Менеджер не назначен"}</span>
                <span class="detail-pill"><i class="fas fa-users"></i> ${project.membersCount || 0} участников</span>
                <span class="detail-pill"><i class="fas fa-chart-line"></i> ${project.progress || 0}% готовности</span>
            </div>
        </div>

        <div class="detail-block">
            <div class="summary-grid grid-4">
                <div class="summary-mini">
                    <div class="label">Общий прогресс</div>
                    <div class="value">${project.progress || 0}%</div>
                    <div class="sub">по задачам проекта</div>
                </div>

                <div class="summary-mini">
                    <div class="label">Текущий этап</div>
                    <div class="value">${currentStage || "—"}</div>
                    <div class="sub">первый незавершённый</div>
                </div>

                <div class="summary-mini">
                    <div class="label">Следующий этап</div>
                    <div class="value">${nextStage || "—"}</div>
                    <div class="sub">идёт после текущего</div>
                </div>

                <div class="summary-mini">
                    <div class="label">Задач завершено</div>
                    <div class="value">${projectTasks.filter(t => t.status === "done").length} / ${projectTasks.length}</div>
                    <div class="sub">локальная сводка</div>
                </div>
            </div>
        </div>

        ${Array.isArray(project.stageNames) && project.stageNames.length ? `
            <div class="detail-block">
                <h3 class="detail-block-title">
                    <i class="fas fa-stream"></i>
                    Этапы проекта
                </h3>

                <div class="stage-timeline">
                    ${project.stageNames.map((stage, index) => {
        const progress = getStageProgress(project.id, stage);
        const cls = stage === currentStage ? "current" : (progress >= 100 ? "done" : (stage === nextStage ? "next" : ""));
        return `
                            <div class="timeline-step ${cls}">
                                <div class="timeline-top">
                                    <span class="timeline-index">Этап ${index + 1}</span>
                                    <span class="timeline-percent">${progress}%</span>
                                </div>
                                <div class="timeline-name">${stage}</div>
                            </div>
                        `;
    }).join("")}
                </div>
            </div>
        ` : ""}

        <div class="detail-block">
            <h3 class="detail-block-title">
                <i class="fas fa-tasks"></i>
                Задачи по этапам
            </h3>

            <div class="stage-sections">
                ${(Array.isArray(project.stageNames) ? project.stageNames : []).map(stage => {
        const stageTasks = projectTasks.filter(t => String(t.stageName || "") === String(stage));
        const progress = getStageProgress(project.id, stage);

        return `
                        <div class="stage-section">
                            <div class="stage-section-inner">
                                <div class="stage-section-header">
                                    <div>
                                        <div class="stage-section-name">${stage}</div>
                                        <div class="stage-section-sub">${stageTasks.length} задач</div>
                                    </div>
                                    <div class="local-progress-pill">${progress}%</div>
                                </div>

                                <div class="tasks-grid-in-stage">
                                    ${stageTasks.length ? stageTasks.map(task => `
                                        <div class="task-row">
                                            <div>
                                                <div class="task-row-title">${task.name}</div>
                                                <div class="task-row-sub">${task.description || "Без описания"}</div>
                                            </div>

                                            <div class="mini-tag">${typeof getStatusText === "function" ? getStatusText(task.status) : task.status}</div>

                                            <div class="table-actions">
                                                <button class="btn btn-sm btn-outline" type="button" onclick="event.stopPropagation(); openEditTaskModal(${task.id})">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                                <button class="btn btn-sm btn-danger" type="button" onclick="event.stopPropagation(); openDeleteTaskModal(${task.id})">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    `).join("") : `
                                        <div style="color: var(--gray);">В этом этапе пока нет задач</div>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
    }).join("")}
            </div>
        </div>
    `;
}

function showProjectDetails(id) {
    const project = window.projects.find(p => Number(p.id) === Number(id));
    if (!project) return;

    currentOpenedProjectId = Number(id);

    const title = document.getElementById("projectViewModalTitle");
    const content = document.getElementById("projectViewModalContent");

    if (title) title.textContent = project.name || "Просмотр проекта";
    if (content) content.innerHTML = buildProjectViewContent(project);

    document.getElementById("projectViewOverlay")?.classList.add("show");
    document.getElementById("projectViewModal")?.classList.add("show");
    document.body.style.overflow = "hidden";
}

function closeProjectViewModal() {
    document.getElementById("projectViewOverlay")?.classList.remove("show");
    document.getElementById("projectViewModal")?.classList.remove("show");
    document.body.style.overflow = "";
}

function restoreProjectViewModal() {
    if (currentOpenedProjectId) {
        showProjectDetails(currentOpenedProjectId);
    }
}

function restoreProjectViewAfterTaskModal() {
    restoreProjectViewModal();
}

document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("projectsPage")) return;

    window.projects = window.projects.map(normalizeProject);
    refreshProjectsStats();
    fillProjectManagerSelect();
    fillEditProjectManagerSelect();
    fillProjectMembersSelect([]);
    fillEditProjectMembersSelect([]);
    filterProjects();
});