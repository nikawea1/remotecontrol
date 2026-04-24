//projects.js



let currentOpenedProjectId = null;
let filteredProjects = Array.isArray(projects) ? [...projects] : [];
let projectStages = [];

function getProjectPresetKey(project) {
    const rawType = String(project?.projectType || project?.projectTypeName || "").toLowerCase();

    if (rawType === "linear" || rawType.includes("линей")) {
        return "linear";
    }

    if (rawType === "hybrid" || rawType.includes("гибрид")) {
        return "hybrid";
    }

    return "functional";
}

function getProjectStageNames(project, projectTasks = []) {
    const stageNames = Array.isArray(project?.stageNames)
        ? project.stageNames.map(x => (x || "").trim()).filter(Boolean)
        : [];

    const taskStageNames = [...new Set(
        (projectTasks || [])
            .map(task => (task.stageName || "").trim())
            .filter(Boolean)
    )];

    const presetStageNames = projectPresets[getProjectPresetKey(project)]?.stages || [];
    const baseStageNames = stageNames.length ? stageNames : presetStageNames;

    return [...new Set([...baseStageNames, ...taskStageNames])];
}

function getProjectCreatedSortValue(project) {
    const rawValue = project?.createdAt || project?.CreatedAt || "";
    const parsedValue = rawValue ? Date.parse(rawValue) : NaN;

    if (Number.isFinite(parsedValue)) {
        return parsedValue;
    }

    return Number(project?.id || 0);
}

function getProjectStageSnapshot(project) {
    const projectId = Number(project?.id || 0);
    const projectTasks = tasks.filter(t => Number(t.projectId) === projectId);
    const doneTasks = projectTasks.filter(t => t.status === "done").length;
    const stageNames = getProjectStageNames(project, projectTasks);
    const tasksByStages = stageNames.map(stageName => {
        const stageTasks = projectTasks.filter(t => (t.stageName || "") === stageName);
        const stageDone = stageTasks.filter(t => t.status === "done").length;
        const stageProgress = stageTasks.length > 0
            ? Math.round((stageDone / stageTasks.length) * 100)
            : 0;

        return {
            name: stageName,
            tasks: stageTasks,
            done: stageDone,
            total: stageTasks.length,
            progress: stageProgress
        };
    });

    const projectTypeKey = getProjectPresetKey(project);
    const currentStage = tasksByStages.find(stage => stage.total > 0 && stage.progress < 100)
        || tasksByStages.find(stage => stage.total === 0)
        || tasksByStages.find(stage => stage.progress < 100)
        || tasksByStages[tasksByStages.length - 1]
        || null;

    const currentStageIndex = currentStage
        ? tasksByStages.findIndex(stage => stage.name === currentStage.name)
        : -1;

    const nextStage = projectTypeKey === "linear" && currentStageIndex >= 0 && currentStageIndex < tasksByStages.length - 1
        ? tasksByStages[currentStageIndex + 1]
        : null;

    return {
        projectTypeKey,
        projectTasks,
        doneTasks,
        stageNames,
        tasksByStages,
        currentStage,
        currentStageIndex,
        nextStage
    };
}

function applyProjectSorting(projectList = filteredProjects) {
    const sortBy = document.getElementById("projectSort")?.value || "recent";

    projectList.sort((a, b) => {
        if (sortBy === "recent") return getProjectCreatedSortValue(b) - getProjectCreatedSortValue(a);
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "tasks") return (b.tasksCount || 0) - (a.tasksCount || 0);
        if (sortBy === "progress") return (b.progress || 0) - (a.progress || 0);
        return 0;
    });

    return projectList;
}

function refreshProjectsStats() {
    projects = projects.map(project => {
        const projectId = Number(project.id);
        const projectTasks = tasks.filter(t => Number(t.projectId) === projectId);
        const tasksCount = projectTasks.length;
        const doneCount = projectTasks.filter(t => t.status === "done").length;
        const progress = tasksCount > 0
            ? Math.round((doneCount / tasksCount) * 100)
            : 0;

        return {
            ...project,
            id: projectId,
            tasksCount: tasksCount,
            progress: progress
        };
    });

    filteredProjects = [...projects];
    applyProjectSorting(filteredProjects);
}

function renderProjects() {
    const container = document.getElementById("projectsList");
    if (!container) {
        return;
    }

    if (!filteredProjects.length) {
        container.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; margin-bottom:0;">
                <div style="color: var(--gray);">Проектов пока нет</div>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredProjects.map(project => `
        ${(() => {
            const snapshot = getProjectStageSnapshot(project);
            const currentStage = snapshot.currentStage;
            const currentStageLabel = currentStage ? currentStage.name : "Этап не определен";
            const currentStagePercent = currentStage ? currentStage.progress : 0;
            const statusText = (project.progress || 0) >= 100
                ? "Завершен"
                : (project.tasksCount || 0) > 0
                    ? "Активный"
                    : "Без задач";

            return `
        <div class="project-card" onclick="showProjectDetails(${project.id})">
            <div class="project-top">
                <div class="project-title-wrap">
                    <div class="project-name">${project.name}</div>
                    <div class="project-type-badge">
                        <i class="fas fa-layer-group"></i>
                        ${project.projectTypeName || "Проект"}
                    </div>
                </div>

                ${!isEmployee ? `
                    <div class="project-header-actions" onclick="event.stopPropagation()">
                        <button
                            class="btn btn-sm btn-outline"
                            type="button"
                            title="Редактировать проект"
                            onclick="openEditProjectModal(${project.id})">
                            <i class="fas fa-edit"></i>
                        </button>

                        <button
                            class="btn btn-sm btn-danger"
                            type="button"
                            title="Удалить проект"
                            onclick="openDeleteProjectModal(${project.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ""}
            </div>

            <div class="project-desc">
                ${project.description || "Без описания"}
            </div>

            <div class="project-main-metrics">
                <div class="metric-box">
                    <div class="label">Менеджер</div>
                    <div class="value">${project.managerName || "не указан"}</div>
                </div>

                <div class="metric-box">
                    <div class="label">Задач</div>
                    <div class="value">${project.tasksCount || 0}</div>
                </div>

                <div class="metric-box">
                    <div class="label">Текущий этап</div>
                    <div class="value">${currentStageLabel}</div>
                    <div class="sub">${currentStagePercent}% завершено</div>
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

            <div class="project-stages-preview">
                <div class="stages-preview-title">Этапы проекта</div>
                <div class="stages-preview-list">
                    ${(project.stageNames && project.stageNames.length)
                        ? `
                            ${project.stageNames.slice(0, 4).map(stage => `
                                <span class="stage-chip">
                                    <i class="fas fa-circle" style="font-size:8px;color:var(--primary)"></i>
                                    ${stage}
                                </span>
                            `).join("")}
                            ${project.stageNames.length > 4 ? `
                                <span class="stage-chip">+${project.stageNames.length - 4}</span>
                            ` : ""}
                        `
                        : `
                            <span class="stage-chip">
                                <i class="fas fa-circle" style="font-size:8px;color:var(--primary)"></i>
                                Этапы не заданы
                            </span>
                        `
                    }
                </div>
            </div>

            <div class="project-card-bottom">
                <div class="project-card-meta">
                    <span class="tiny-pill is-secondary">
                        <i class="fas fa-signal"></i>
                        ${statusText}
                    </span>

                    <span class="tiny-pill is-secondary">
                        <i class="fas fa-users"></i>
                        ${project.membersCount || 0}
                    </span>
                </div>

                <span class="project-open-indicator" aria-hidden="true">
                    <i class="fas fa-angle-right"></i>
                </span>
            </div>
        </div>
            `;
        })()}
    `).join("");
}

function filterProjects() {
    const searchText = document.getElementById("projectSearch")?.value.toLowerCase() || "";
    const statusFilter = document.getElementById("projectStatusFilter")?.value || "all";

    filteredProjects = projects.filter(project => {
        if (statusFilter === "active" && (project.progress || 0) >= 100) {
            return false;
        }

        if (statusFilter === "completed" && (project.progress || 0) < 100) {
            return false;
        }

        return project.name.toLowerCase().includes(searchText) ||
            (project.description || "").toLowerCase().includes(searchText);
    });

    applyProjectSorting(filteredProjects);
    renderProjects();
}

function sortProjects() {
    applyProjectSorting(filteredProjects);
    renderProjects();
}

function resetProjectFilters() {
    const projectSearch = document.getElementById("projectSearch");
    const projectSort = document.getElementById("projectSort");
    const projectStatusFilter = document.getElementById("projectStatusFilter");

    if (projectSearch) projectSearch.value = "";
    if (projectSort) projectSort.value = "recent";
    if (projectStatusFilter) projectStatusFilter.value = "all";

    filteredProjects = [...projects];
    applyProjectSorting(filteredProjects);
    renderProjects();
}

let selectedProjectPreset = "functional";
let selectedEditProjectPreset = "functional";
let editProjectStages = [];
let selectedProjectStageFilter = "";

const projectPresets = {
    hybrid: {
        key: "hybrid",
        title: "Гибридный",
        badge: "Гибридный",
        description: "Есть крупные блоки сверху и функциональные подпункты внутри них. Подходит для сложных продуктовых проектов.",
        stages: ["Подготовка", "Разработка / Backend", "Разработка / Frontend", "Сдача / QA", "Сдача / Релиз"]
    },
    functional: {
        key: "functional",
        title: "Функциональный",
        badge: "Функциональный",
        description: "Этапы — это направления работы. Команда движется параллельно по блокам.",
        stages: ["Backend", "Frontend", "UI/UX", "QA", "Docs"]
    },
    linear: {
        key: "linear",
        title: "Линейный",
        badge: "Линейный",
        description: "Этапы идут по порядку. Удобно показывать текущий этап, следующий шаг и завершённые блоки.",
        stages: ["Анализ", "Проектирование", "Разработка", "Тестирование", "Запуск"]
    }
};

function showAddProjectModal() {
    const projectName = document.getElementById("projectName");
    const projectDescription = document.getElementById("projectDescription");
    const projectMembersSearch = document.getElementById("projectMembersSearch");
    const newProjectStageName = document.getElementById("newProjectStageName");

    if (projectName) projectName.value = "";
    if (projectDescription) projectDescription.value = "";
    if (projectMembersSearch) projectMembersSearch.value = "";
    if (newProjectStageName) newProjectStageName.value = "";

    selectedProjectPreset = "functional";
    projectStages = [...(projectPresets[selectedProjectPreset]?.stages || [])];

    fillProjectManagerSelect();
    fillProjectMembersSelect([]);
    renderProjectPresetCards();
    renderProjectPresetStages();

    openModal("addProjectModal");
}

function renderProjectPresetCards() {
    const container = document.getElementById("projectPresetList");
    if (!container) return;

    container.innerHTML = Object.values(projectPresets).map(item => `
        <div class="template-card ${item.key === selectedProjectPreset ? "active" : ""}" onclick="selectProjectPreset('${item.key}')">
            <div class="template-top">
                <div class="template-name">${item.title}</div>
                <div class="template-badge">${item.stages.length} этапов</div>
            </div>

            <div class="template-description">${item.description}</div>

            <div class="template-stages">
                ${item.stages.map(stage => `
                    <span class="stage-chip">
                        <i class="fas fa-circle" style="font-size:8px;color:var(--primary)"></i>
                        ${stage}
                    </span>
                `).join("")}
            </div>
        </div>
    `).join("");
}

function selectProjectPreset(presetKey) {
    selectedProjectPreset = presetKey;
    projectStages = [...(projectPresets[presetKey]?.stages || [])];

    const input = document.getElementById("newProjectStageName");
    if (input) input.value = "";

    renderProjectPresetCards();
    renderProjectPresetStages();
}

function renderProjectPresetStages() {
    const box = document.getElementById("projectPresetStagesPreview");
    if (!box) return;

    if (!projectStages.length) {
        box.innerHTML = `
            <div class="stage-editor-item">
                <div>
                    <strong>Этапов пока нет</strong>
                    <div style="font-size:12px; color:var(--gray);">Добавь хотя бы один этап</div>
                </div>
            </div>
        `;
        return;
    }

    box.innerHTML = projectStages.map((stage, index) => `
        <div class="stage-editor-item">
            <div style="flex:1; min-width:0;">
                <input
                    type="text"
                    class="form-control"
                    value="${stage.replace(/"/g, "&quot;")}"
                    onchange="renameProjectStage(${index}, this.value)"
                    placeholder="Название этапа">
                <div style="font-size:12px; color:var(--gray); margin-top:6px;">
                    Порядок: ${index + 1}
                </div>
            </div>

            <div class="stage-editor-actions">
                <button class="btn btn-sm btn-outline" type="button" title="В начало" onclick="moveProjectStageToStart(${index})">
                    <i class="fas fa-angles-up"></i>
                </button>
                <button class="btn btn-sm btn-outline" type="button" title="Вверх" onclick="moveProjectStageUp(${index})">
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="btn btn-sm btn-outline" type="button" title="Вниз" onclick="moveProjectStageDown(${index})">
                    <i class="fas fa-arrow-down"></i>
                </button>
                <button class="btn btn-sm btn-outline" type="button" title="В конец" onclick="moveProjectStageToEnd(${index})">
                    <i class="fas fa-angles-down"></i>
                </button>
                <button class="btn btn-sm btn-danger" type="button" title="Удалить" onclick="removeProjectStage(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join("");
}

function addProjectStage() {
    const input = document.getElementById("newProjectStageName");
    if (!input) return;

    const name = (input.value || "").trim();
    if (!name) {
        showNotification("Введите название этапа");
        return;
    }

    if (projectStages.some(x => x.toLowerCase() === name.toLowerCase())) {
        showNotification("Такой этап уже есть");
        return;
    }

    projectStages.push(name);
    input.value = "";
    renderProjectPresetStages();
}

function renameProjectStage(index, value) {
    const name = (value || "").trim();

    if (!name) {
        showNotification("Название этапа не может быть пустым");
        renderProjectPresetStages();
        return;
    }

    const duplicate = projectStages.some((x, i) =>
        i !== index && x.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
        showNotification("Такой этап уже существует");
        renderProjectPresetStages();
        return;
    }

    projectStages[index] = name;
}

function removeProjectStage(index) {
    if (index < 0 || index >= projectStages.length) return;

    projectStages.splice(index, 1);
    renderProjectPresetStages();
}

function moveProjectStageUp(index) {
    if (index <= 0) return;

    [projectStages[index - 1], projectStages[index]] =
        [projectStages[index], projectStages[index - 1]];

    renderProjectPresetStages();
}

function moveProjectStageDown(index) {
    if (index < 0 || index >= projectStages.length - 1) return;

    [projectStages[index + 1], projectStages[index]] =
        [projectStages[index], projectStages[index + 1]];

    renderProjectPresetStages();
}

function moveProjectStageToStart(index) {
    if (index <= 0 || index >= projectStages.length) return;

    const [stage] = projectStages.splice(index, 1);
    projectStages.unshift(stage);
    renderProjectPresetStages();
}

function moveProjectStageToEnd(index) {
    if (index < 0 || index >= projectStages.length - 1) return;

    const [stage] = projectStages.splice(index, 1);
    projectStages.push(stage);
    renderProjectPresetStages();
}

function renderEditProjectPresetCards() {
    const container = document.getElementById("editProjectPresetList");
    if (!container) return;

    container.innerHTML = Object.values(projectPresets).map(item => ` 
        <div class="template-card ${item.key === selectedEditProjectPreset ? "active" : ""}" onclick="selectEditProjectPreset('${item.key}')">
            <div class="template-top">
                <div class="template-name">${item.title}</div>
                <div class="template-badge">${item.stages.length} этапов</div>
            </div>

            <div class="template-description">${item.description}</div>

            <div class="template-stages">
                ${item.stages.map(stage => `
                    <span class="stage-chip">
                        <i class="fas fa-circle" style="font-size:8px;color:var(--primary)"></i>
                        ${stage}
                    </span>
                `).join("")}
            </div>
        </div>
    `).join("");
}

function selectEditProjectPreset(presetKey) {
    selectedEditProjectPreset = presetKey;
    editProjectStages = [...(projectPresets[presetKey]?.stages || [])];

    const input = document.getElementById("newEditStageName");
    if (input) input.value = "";

    renderEditProjectPresetCards();
    renderEditProjectStages();
}

function getEditedProjectId() {
    return Number(document.getElementById("editProjectId")?.value || 0);
}

function getProjectStageTaskCount(projectId, stageName) {
    const pid = Number(projectId || 0);
    const normalizedStage = String(stageName || "").trim().toLowerCase();

    if (!pid || !normalizedStage) return 0;

    return tasks.filter(task =>
        Number(task.projectId) === pid &&
        String(task.stageName || "").trim().toLowerCase() === normalizedStage
    ).length;
}

function renderEditProjectStages() {
    const container =
        document.getElementById("editProjectStagesList") ||
        document.getElementById("editProjectStagesPreview");

    if (!container) return;

    if (!editProjectStages.length) {
        container.innerHTML = `
            <div class="stage-editor-item">
                <div>
                    <strong>Этапов пока нет</strong>
                    <div style="font-size:12px; color:var(--gray);">Добавь хотя бы один этап</div>
                </div>
            </div>
        `;
        return;
    }

    const editedProjectId = getEditedProjectId();

    container.innerHTML = editProjectStages.map((stage, index) => {
        const stageTaskCount = getProjectStageTaskCount(editedProjectId, stage);
        const isLocked = stageTaskCount > 0;

        return `
        <div class="stage-editor-item">
            <div style="flex:1; min-width:0;">
                <input
                    type="text"
                    class="form-control ${isLocked ? "stage-input-locked" : ""}"
                    value="${stage.replace(/"/g, "&quot;")}"
                    onchange="renameEditProjectStage(${index}, this.value)"
                    ${isLocked ? "readonly" : ""}
                    placeholder="Название этапа">
                <div style="font-size:12px; color:var(--gray); margin-top:6px;">
                    Порядок: ${index + 1}${isLocked ? ` · ${stageTaskCount} задач · название защищено` : ""}
                </div>
            </div>

            <div class="stage-editor-actions">
                <button class="btn btn-sm btn-outline" type="button" title="В начало" onclick="moveEditProjectStageToStart(${index})">
                    <i class="fas fa-angles-up"></i>
                </button>
                <button class="btn btn-sm btn-outline" type="button" title="Вверх" onclick="moveEditProjectStageUp(${index})">
                    <i class="fas fa-arrow-up"></i>
                </button>

                <button class="btn btn-sm btn-outline" type="button" title="Вниз" onclick="moveEditProjectStageDown(${index})">
                    <i class="fas fa-arrow-down"></i>
                </button>

                <button class="btn btn-sm btn-outline" type="button" title="В конец" onclick="moveEditProjectStageToEnd(${index})">
                    <i class="fas fa-angles-down"></i>
                </button>

                <button class="btn btn-sm btn-danger" type="button" title="${isLocked ? "Нельзя удалить этап с задачами" : "Удалить"}" ${isLocked ? "disabled" : ""} onclick="removeEditProjectStage(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    }).join("");
}

function addEditProjectStage() {
    const input = document.getElementById("newEditStageName");
    if (!input) return;

    const name = (input.value || "").trim();
    if (!name) {
        showNotification("Введите название этапа");
        return;
    }

    if (editProjectStages.some(x => x.toLowerCase() === name.toLowerCase())) {
        showNotification("Такой этап уже есть");
        return;
    }

    editProjectStages.push(name);
    input.value = "";
    renderEditProjectStages();
}

function renameEditProjectStage(index, value) {
    const name = (value || "").trim();

    if (getProjectStageTaskCount(getEditedProjectId(), editProjectStages[index]) > 0) {
        showNotification("Этап с задачами нельзя переименовать без переноса задач");
        renderEditProjectStages();
        return;
    }

    if (!name) {
        showNotification("Название этапа не может быть пустым");
        renderEditProjectStages();
        return;
    }

    const duplicate = editProjectStages.some((x, i) =>
        i !== index && x.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
        showNotification("Такой этап уже существует");
        renderEditProjectStages();
        return;
    }

    editProjectStages[index] = name;
}

function removeEditProjectStage(index) {
    if (index < 0 || index >= editProjectStages.length) return;

    if (getProjectStageTaskCount(getEditedProjectId(), editProjectStages[index]) > 0) {
        showNotification("Нельзя удалить этап, в котором уже есть задачи");
        return;
    }

    editProjectStages.splice(index, 1);
    renderEditProjectStages();
}

function moveEditProjectStageUp(index) {
    if (index <= 0) return;

    [editProjectStages[index - 1], editProjectStages[index]] =
        [editProjectStages[index], editProjectStages[index - 1]];

    renderEditProjectStages();
}

function moveEditProjectStageDown(index) {
    if (index < 0 || index >= editProjectStages.length - 1) return;

    [editProjectStages[index + 1], editProjectStages[index]] =
        [editProjectStages[index], editProjectStages[index + 1]];

    renderEditProjectStages();
}

function moveEditProjectStageToStart(index) {
    if (index <= 0 || index >= editProjectStages.length) return;

    const [stage] = editProjectStages.splice(index, 1);
    editProjectStages.unshift(stage);
    renderEditProjectStages();
}

function moveEditProjectStageToEnd(index) {
    if (index < 0 || index >= editProjectStages.length - 1) return;

    const [stage] = editProjectStages.splice(index, 1);
    editProjectStages.push(stage);
    renderEditProjectStages();
}

function openEditProjectModal(id) {
    if (isEmployee) return;

    const project = projects.find(p => Number(p.id) === Number(id));
    if (!project) {
        showNotification("Проект не найден");
        return;
    }

    suspendProjectViewModal();

    const editProjectId = document.getElementById("editProjectId");
    const editProjectName = document.getElementById("editProjectName");
    const editProjectDescription = document.getElementById("editProjectDescription");
    const editProjectMembersSearch = document.getElementById("editProjectMembersSearch");

    if (editProjectId) editProjectId.value = String(project.id);
    if (editProjectName) editProjectName.value = project.name || "";
    if (editProjectDescription) editProjectDescription.value = project.description || "";
    if (editProjectMembersSearch) editProjectMembersSearch.value = "";

    fillEditProjectManagerSelect(project.managerId || null);
    fillEditProjectMembersSelect(project.memberIds || []);

    selectedEditProjectPreset = getProjectPresetKey(project);
    editProjectStages = getProjectStageNames(project);

    const newEditStageName = document.getElementById("newEditStageName");
    if (newEditStageName) {
        newEditStageName.value = "";
    }

    renderEditProjectPresetCards();
    renderEditProjectStages();

    openModal("editProjectModal");
}


async function addProject() {
    const name = document.getElementById("projectName")?.value.trim() || "";
    const description = document.getElementById("projectDescription")?.value.trim() || "";

    if (!name) {
        showNotification("Введите название проекта");
        return;
    }

    if (!projectStages.length) {
        showNotification("Добавьте хотя бы один этап");
        return;
    }

    const managerSelect = document.getElementById("projectManagerSelect");
    const membersSelect = document.getElementById("projectMembersSelect");

    const managerId = managerSelect ? Number(managerSelect.value || 0) : null;
    const memberIds = membersSelect
        ? [...membersSelect.selectedOptions].map(x => Number(x.value))
        : [];

    const dto = {
        name,
        description,
        managerId: managerId && managerId > 0 ? managerId : null,
        memberIds,
        projectType: selectedProjectPreset,
        stageNames: [...projectStages]
    };

    try {
        const res = await fetch("/MainPage?handler=AddProject", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify(dto)
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка создания проекта");
            return;
        }

        const project = normalizeProject({
            ...data.project,
            projectType: selectedProjectPreset
        });

        projects.unshift(project);
        filteredProjects = [...projects];

        closeModal("addProjectModal");

        fillProjectFilter();
        fillProjectSelect("taskProjectSelect");
        fillProjectSelect("editTaskProject");
        refreshProjectsStats();
        filterProjects();
        renderDashboard();

        showNotification("Проект сохранен");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}
async function saveProjectChanges() {
    const id = Number(document.getElementById("editProjectId")?.value || 0);
    const name = document.getElementById("editProjectName")?.value.trim() || "";
    const description = document.getElementById("editProjectDescription")?.value.trim() || "";

    if (!id) {
        showNotification("Проект не найден");
        return;
    }

    if (!name) {
        showNotification("Введите название проекта");
        return;
    }

    if (!editProjectStages.length) {
        showNotification("Добавьте хотя бы один этап");
        return;
    }

    const managerSelect = document.getElementById("editProjectManagerSelect");
    const membersSelect = document.getElementById("editProjectMembersSelect");

    const managerId = managerSelect ? Number(managerSelect.value || 0) : null;
    const memberIds = membersSelect
        ? [...membersSelect.selectedOptions].map(x => Number(x.value))
        : [];

    const dto = {
        id,
        name,
        description,
        managerId: managerId && managerId > 0 ? managerId : null,
        memberIds,
        projectType: selectedEditProjectPreset,
        stageNames: [...editProjectStages]
    };

    try {
        const res = await fetch("/MainPage?handler=UpdateProject", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify(dto)
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка сохранения проекта");
            return;
        }

        const updatedProject = normalizeProject({
            ...data.project,
            projectType: selectedEditProjectPreset
        });
        const index = projects.findIndex(p => Number(p.id) === Number(updatedProject.id));

        if (index !== -1) {
            projects[index] = updatedProject;
        }

        filteredProjects = [...projects];

        closeModal("editProjectModal");
        restoreProjectViewModal();

        editProjectStages = [];

        refreshProjectsStats();
        filterProjects();
        fillProjectFilter();
        fillProjectSelect("taskProjectSelect");
        fillProjectSelect("editTaskProject");
        renderDashboard();

        showNotification("Проект обновлен");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}
function openDeleteProjectModal(id) {
    if (isEmployee) return;

    const project = projects.find(p => Number(p.id) === Number(id));

    if (!project) {
        showNotification("Проект не найден");
        return;
    }

    const linkedTasksCount = tasks.filter(t => Number(t.projectId) === Number(id)).length;

    const deleteProjectId = document.getElementById("deleteProjectId");
    const deleteProjectName = document.getElementById("deleteProjectName");
    const deleteProjectTasksCount = document.getElementById("deleteProjectTasksCount");

    if (deleteProjectId) deleteProjectId.value = project.id;
    if (deleteProjectName) deleteProjectName.textContent = project.name;
    if (deleteProjectTasksCount) deleteProjectTasksCount.textContent = linkedTasksCount;
    openModal("deleteProjectModal");
}

async function confirmDeleteProject() {
    const id = Number(document.getElementById("deleteProjectId")?.value || 0);

    try {
        const res = await fetch("/MainPage?handler=DeleteProject", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({ id: id })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка удаления проекта");
            return;
        }

        projects = projects.filter(p => Number(p.id) !== id);
        tasks = tasks.filter(t => Number(t.projectId) !== id);
        filteredProjects = [...projects];

        closeModal("deleteProjectModal");

        fillProjectFilter();
        fillProjectSelect("taskProjectSelect");
        fillProjectSelect("editTaskProject");
        fillTaskSelects();

        refreshProjectsStats();
        filterProjects();
        renderTasksTable();
        renderDashboard();
        renderDashboardTasks();

        showNotification("Проект и связанные задачи удалены");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}


let suspendedProjectViewId = null;

let suspendedProjectTaskProjectId = null;

function suspendProjectViewBeforeTaskModal(taskId) {
    const task = tasks.find(t => Number(t.id) === Number(taskId));
    if (!task) return;

    const modal = document.getElementById("projectViewModal");
    const overlay = document.getElementById("projectViewOverlay");

    if (!modal || !overlay) return;

    if (modal.classList.contains("show")) {
        suspendedProjectTaskProjectId = Number(task.projectId || 0);
        modal.classList.remove("show");
        overlay.classList.remove("show");
    }
}

function restoreProjectViewAfterTaskModal() {
    if (!suspendedProjectTaskProjectId) return;

    const projectId = suspendedProjectTaskProjectId;
    suspendedProjectTaskProjectId = null;

    showProjectDetails(projectId);
}

function suspendProjectViewModal() {
    const modal = document.getElementById("projectViewModal");
    const overlay = document.getElementById("projectViewOverlay");

    if (!modal || !overlay) return;

    if (modal.classList.contains("show")) {
        suspendedProjectViewId = Number(modal.dataset.projectId || 0);

        modal.classList.remove("show");
        overlay.classList.remove("show");
    }
}

function restoreProjectViewModal() {
    if (!suspendedProjectViewId) return;

    const id = suspendedProjectViewId;
    suspendedProjectViewId = null;

    showProjectDetails(id);
}

function setProjectStageFilter(projectId, stageName = "") {
    selectedProjectStageFilter = stageName || "";
    showProjectDetails(projectId);
}

function showProjectDetails(id) {
    const openedAnotherProject = Number(currentOpenedProjectId || 0) !== Number(id);

    currentOpenedProjectId = id;

    if (openedAnotherProject) {
        selectedProjectStageFilter = "";
    }

    const project = projects.find(x => Number(x.id) === Number(id));

    if (!project) {
        showNotification("Проект не найден");
        return;
    }

    const {
        projectTasks,
        doneTasks,
        tasksByStages,
        projectTypeKey,
        currentStage,
        currentStageIndex,
        nextStage
    } = getProjectStageSnapshot(project);

    const hasSelectedStage = tasksByStages.some(x => x.name === selectedProjectStageFilter);

    if (selectedProjectStageFilter && !hasSelectedStage) {
        selectedProjectStageFilter = "";
    }

    const visibleStages = selectedProjectStageFilter
        ? tasksByStages.filter(x => x.name === selectedProjectStageFilter)
        : tasksByStages;

    const projectTypeName = project.projectTypeName || "Функциональный";
    const managerName = project.managerName || "Менеджер не указан";
    const membersCount = Number(project.membersCount || 0);
    const progress = Number(project.progress || 0);

    const summaryCards = `
        <div class="detail-block">
            <div class="summary-grid grid-4">
                <div class="summary-mini">
                    <div class="label">Общий прогресс</div>
                    <div class="value">${progress}%</div>
                    <div class="sub">по задачам проекта</div>
                </div>

                <div class="summary-mini">
                    <div class="label">Текущий этап</div>
                    <div class="value">${currentStage ? `${currentStage.name} · ${currentStage.progress}%` : "—"}</div>
                    <div class="sub">первый незавершённый этап</div>
                </div>

                <div class="summary-mini">
                    <div class="label">Следующий этап</div>
                    <div class="value">${nextStage ? nextStage.name : "—"}</div>
                    <div class="sub">идёт после текущего</div>
                </div>

                <div class="summary-mini">
                    <div class="label">Задач завершено</div>
                    <div class="value">${doneTasks} / ${projectTasks.length}</div>
                    <div class="sub">локальная сводка</div>
                </div>
            </div>
        </div>
    `;

    const actionBlock = `
        <div class="detail-block">
            <h3 class="detail-block-title">
                <i class="fas fa-bolt"></i>
                Быстрые действия
            </h3>

            <div class="action-grid">
                ${!isEmployee ? `
                    <div class="action-card" onclick="showAddTaskModal(${project.id}, '${selectedProjectStageFilter ? selectedProjectStageFilter.replace(/'/g, "\\'") : ""}')" style="cursor:pointer;">
                        <i class="fas fa-plus"></i>
                        <div>
                            <strong>Добавить задачу</strong>
                            <span>Сразу в нужный этап проекта</span>
                        </div>
                    </div>

                    <div class="action-card" onclick="openEditProjectModal(${project.id})" style="cursor:pointer;">
                        <i class="fas fa-sitemap"></i>
                        <div>
                            <strong>Редактировать этапы</strong>
                            <span>Добавить, удалить, переименовать, перенести</span>
                        </div>
                    </div>
                ` : ""}

                <div class="action-card" onclick="setProjectStageFilter(${project.id}, '')" style="cursor:pointer;">
                    <i class="fas fa-filter"></i>
                    <div>
                        <strong>Показать все этапы</strong>
                        <span>Сбросить текущий фильтр этапа</span>
                    </div>
                </div>

                <div class="action-card future-action">
                    <i class="fas fa-users"></i>
                    <div>
                        <strong>Состав команды</strong>
                        <span>Подключить участников проекта</span>
                    </div>
                </div>

                <div class="action-card future-action">
                    <i class="fas fa-file-export"></i>
                    <div>
                        <strong>Экспорт по проекту</strong>
                        <span>Выгрузка задач, часов и сводки</span>
                    </div>
                </div>

                <div class="action-card future-action">
                    <i class="fas fa-arrows-up-down-left-right"></i>
                    <div>
                        <strong>Перенос задач</strong>
                        <span>Потом сюда можно добавить drag & drop</span>
                    </div>
                </div>

                <div class="action-card future-action">
                    <i class="fas fa-calendar-check"></i>
                    <div>
                        <strong>Календарь проекта</strong>
                        <span>События, митапы и дедлайны</span>
                    </div>
                </div>

                <div class="action-card future-action">
                    <i class="fas fa-triangle-exclamation"></i>
                    <div>
                        <strong>Риски и просрочки</strong>
                        <span>Сводка проблемных задач</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    const timelineBlock = `
        <div class="detail-block">
            <div class="detail-block-title">
                <i class="fas fa-route"></i>
                Этапы проекта
            </div>

            <div class="inline-pills" style="margin-bottom:14px;">
                <button
                    class="btn ${!selectedProjectStageFilter ? "btn-primary" : "btn-outline"}"
                    type="button"
                    onclick="setProjectStageFilter(${project.id}, '')">
                    Все этапы
                </button>

                ${tasksByStages.map(stage => `
                    <button
                        class="btn ${selectedProjectStageFilter === stage.name ? "btn-primary" : "btn-outline"}"
                        type="button"
                        onclick="setProjectStageFilter(${project.id}, '${stage.name.replace(/'/g, "\\'")}')">
                        ${stage.name}
                    </button>
                `).join("")}
            </div>

            <div class="stage-timeline">
                ${tasksByStages.map((stage, index) => {
        let cls = "";

        if (stage.total > 0 && stage.progress === 100) {
            cls = "done";
        } else if (index === currentStageIndex) {
            cls = "current";
        } else if (projectTypeKey === "linear" && index === currentStageIndex + 1) {
            cls = "next";
        } else if (stage.total === 0) {
            cls = "empty";
        } else {
            cls = "waiting";
        }

        const stageStatusText = cls === "done"
            ? "Готов"
            : cls === "current"
                ? "Текущий"
                : cls === "next"
                    ? "Следующий"
                    : cls === "empty"
                        ? "Без задач"
                        : "В очереди";

        return `
                        <div class="timeline-step ${cls}" style="cursor:pointer;" onclick="setProjectStageFilter(${project.id}, '${stage.name.replace(/'/g, "\\'")}')">
                            <div class="timeline-top">
                                <div class="timeline-index">Этап ${index + 1}</div>
                                <div class="timeline-meta">
                                    <span class="timeline-status">${stageStatusText}</span>
                                    <span class="timeline-percent">${stage.progress}%</span>
                                </div>
                            </div>

                            <div class="timeline-name">${stage.name}</div>

                            <div class="progress-bar" style="height:6px; margin-top:10px;">
                                <div class="progress-fill" style="width:${stage.progress}%"></div>
                            </div>
                        </div>
                    `;
    }).join("")}
            </div>
        </div>
    `;

    const sectionsBlock = `
        <div class="detail-block">
            <div class="detail-block-title">
                <i class="fas fa-columns"></i>
                ${selectedProjectStageFilter ? `Задачи этапа: ${selectedProjectStageFilter}` : "Задачи по этапам"}
            </div>

            <div class="stage-sections">
                ${visibleStages.map(stage => `
                    <div class="stage-section">
                        <div class="stage-section-inner">
                            <div class="stage-section-header">
                                <div>
                                    <div class="stage-section-name">${stage.name}</div>
                                    <div class="stage-section-sub">Завершено задач: ${stage.done} из ${stage.total}</div>
                                </div>

                                <div class="local-progress-pill">${stage.progress}%</div>
                            </div>

                            <div class="progress-bar">
                                <div class="progress-fill" style="width:${stage.progress}%"></div>
                            </div>

                            <div class="tasks-grid-in-stage">
                                ${stage.tasks.length > 0
            ? stage.tasks.map(task => `
                                        <div class="task-row task-status-${task.status || "new"}">
                                            <div>
                                                <div class="task-row-title">${task.name}</div>
                                                <div class="task-row-sub">Исполнитель: ${task.assignee || "не назначен"}</div>
                                            </div>

                                            <div class="status-badge status-${task.status || "new"}">
                                                ${getStatusText(task.status || "new")}
                                            </div>

                                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
                                                <div class="mini-tag">${stage.name}</div>

                                                ${(isAdmin || isManager) ? `
                                                    <button class="btn btn-sm btn-outline" type="button" title="Редактировать задачу"
                                                        onclick="event.stopPropagation(); openEditTaskModal(${task.id})">
                                                        <i class="fas fa-edit"></i>
                                                    </button>

                                                    <button class="btn btn-sm btn-danger" type="button" title="Удалить задачу"
                                                        onclick="event.stopPropagation(); openDeleteTaskModal(${task.id})">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                ` : ""}

                                                ${(isEmployee || isAdmin || isManager) ? `
                                                    <button class="btn btn-sm btn-success" type="button" title="Запустить задачу"
                                                        onclick="event.stopPropagation(); startTask(${task.id})">
                                                        <i class="fas fa-play"></i>
                                                    </button>
                                                ` : ""}
                                            </div>
                                        </div>
                                    `).join("")
            : `
                                        <div class="task-row">
                                            <div>
                                                <div class="task-row-title">Задач пока нет</div>
                                                <div class="task-row-sub">На этом этапе пока нет задач</div>
                                            </div>

                                            <div class="status-badge status-new">Пусто</div>
                                            <div class="mini-tag">${stage.name}</div>
                                        </div>
                                    `
        }
                            </div>

                            <div class="stage-tools">
                                <div class="inline-pills">
                                    <button
                                        class="btn ${selectedProjectStageFilter === stage.name ? "btn-primary" : "btn-outline"}"
                                        type="button"
                                        onclick="setProjectStageFilter(${project.id}, '${stage.name.replace(/'/g, "\\'")}')">
                                        <i class="fas fa-filter"></i>
                                        Только этот этап
                                    </button>

                                    <span class="tiny-pill">
                                        <i class="fas fa-list-check"></i>
                                        ${stage.total} задач
                                    </span>
                                </div>

                                ${!isEmployee ? `
                                    <button class="btn btn-outline" type="button" onclick="showAddTaskModal(${project.id}, '${stage.name.replace(/'/g, "\\'")}')">
                                        Добавить задачу в этап
                                    </button>
                                ` : ""}
                            </div>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;

    const html = `
        <div class="detail-hero">
            <div class="detail-hero-top">
                <div>
                    <h2>${project.name}</h2>
                    <p>${project.description || "Без описания"}</p>
                </div>

                ${!isEmployee ? `
                    <button class="btn btn-outline" type="button" onclick="event.stopPropagation(); openEditProjectModal(${project.id})">
                        <i class="fas fa-edit"></i> Редактировать
                    </button>
                ` : ""}
            </div>

            <div class="detail-pills">
                <div class="detail-pill">
                    <i class="fas fa-layer-group"></i>${projectTypeName}
                </div>

                <div class="detail-pill">
                    <i class="fas fa-user-tie"></i>${managerName}
                </div>

                <div class="detail-pill">
                    <i class="fas fa-users"></i>Команда: ${membersCount}
                </div>

                <div class="detail-pill">
                    <i class="fas fa-list-check"></i>Задач: ${projectTasks.length}
                </div>
            </div>
        </div>

        <div class="project-view-main-layout">
            <div class="project-view-left-column">
                ${summaryCards}
                ${timelineBlock}
            </div>

            <div class="project-view-right-column">
                ${actionBlock}
            </div>
        </div>

        ${sectionsBlock}
    `;

    const title = document.getElementById("projectViewModalTitle");
    const content = document.getElementById("projectViewModalContent");
    const overlay = document.getElementById("projectViewOverlay");
    const modal = document.getElementById("projectViewModal");

    if (title) {
        title.textContent = project.name;
    }

    if (content) {
        content.innerHTML = html;
    }

    if (overlay) {
        overlay.classList.add("show");
    }

    if (modal) {
        modal.dataset.projectId = String(project.id);
        modal.classList.add("show");
    }

    if (typeof lockBodyScroll === "function") {
        lockBodyScroll();
    } else {
        document.body.style.overflow = "hidden";
    }
}

function closeProjectViewModal() {
    const overlay = document.getElementById("projectViewOverlay");
    const modal = document.getElementById("projectViewModal");
    const content = document.getElementById("projectViewModalContent");

    if (overlay) {
        overlay.classList.remove("show");
    }

    if (modal) {
        modal.classList.remove("show");
    }

    if (content) {
        content.innerHTML = "";
    }

    if (typeof unlockBodyScroll === "function") {
        unlockBodyScroll();
    } else {
        document.body.style.overflow = "";
    }
}


function getManagersForProjectSelect() {
    return users.filter(u => u.role === "manager" || u.role === "admin");
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

    const availableUsers = users
        .filter(u => u.status === "active" && u.role !== "admin")
        .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "ru"));

    select.innerHTML = availableUsers
        .map(u => `<option value="${u.id}">${u.fullName} — ${u.position || "без должности"}</option>`)
        .join("");

    [...select.options].forEach(option => {
        option.selected = selectedIds.includes(Number(option.value));
    });

    renderProjectMembersPicker("projectMembersSearch", "projectMembersSelect");
}
function fillEditProjectMembersSelect(selectedIds = []) {
    const select = document.getElementById("editProjectMembersSelect");
    const search = document.getElementById("editProjectMembersSearch");
    if (!select) return;

    if (search) search.value = "";

    const availableUsers = users
        .filter(u => u.status === "active" && u.role !== "admin")
        .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "ru"));

    select.innerHTML = availableUsers
        .map(u => `<option value="${u.id}">${u.fullName} — ${u.position || "без должности"}</option>`)
        .join("");

    [...select.options].forEach(option => {
        option.selected = selectedIds.includes(Number(option.value));
    });

    renderProjectMembersPicker("editProjectMembersSearch", "editProjectMembersSelect");
}

function filterProjectMembersOptions(searchInputId, selectId) {
    renderProjectMembersPicker(searchInputId, selectId);
}

function getProjectMembersUiConfig(selectId) {
    if (selectId === "projectMembersSelect") {
        return {
            pickerId: "projectMembersPicker",
            selectedId: "projectMembersSelected",
            searchId: "projectMembersSearch"
        };
    }

    if (selectId === "editProjectMembersSelect") {
        return {
            pickerId: "editProjectMembersPicker",
            selectedId: "editProjectMembersSelected",
            searchId: "editProjectMembersSearch"
        };
    }

    return null;
}

function toggleProjectMemberSelection(selectId, userId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const option = [...select.options].find(x => Number(x.value) === Number(userId));
    if (!option) return;

    option.selected = !option.selected;

    const ui = getProjectMembersUiConfig(selectId);
    if (!ui) return;

    renderProjectMembersPicker(ui.searchId, selectId);
}

function renderProjectMembersPicker(searchInputId, selectId) {
    const searchInput = document.getElementById(searchInputId);
    const select = document.getElementById(selectId);
    const ui = getProjectMembersUiConfig(selectId);
    const picker = ui ? document.getElementById(ui.pickerId) : null;
    const selectedContainer = ui ? document.getElementById(ui.selectedId) : null;

    if (!searchInput || !select || !picker || !selectedContainer) return;

    const query = (searchInput.value || "").trim().toLowerCase();
    const allOptions = [...select.options].map(option => ({
        id: Number(option.value),
        text: option.textContent || "",
        selected: option.selected
    }));

    const selectedOptions = allOptions.filter(option => option.selected);
    const visibleOptions = allOptions.filter(option =>
        !query || option.text.toLowerCase().includes(query)
    );

    selectedContainer.innerHTML = selectedOptions.length
        ? selectedOptions.map(option => `
            <button
                class="member-chip"
                type="button"
                onclick="event.stopPropagation(); toggleProjectMemberSelection('${selectId}', ${option.id})">
                <span>${option.text.split(" — ")[0]}</span>
                <i class="fas fa-times"></i>
            </button>
        `).join("")
        : `<div class="member-picker-empty">Пока никто не выбран</div>`;

    picker.innerHTML = visibleOptions.length
        ? visibleOptions.map(option => {
            const [name, position] = option.text.split(" — ");

            return `
                <button
                    class="member-picker-item ${option.selected ? "is-selected" : ""}"
                    type="button"
                    onclick="toggleProjectMemberSelection('${selectId}', ${option.id})">
                    <div class="member-picker-info">
                        <div class="member-picker-name">${name || "Сотрудник"}</div>
                        <div class="member-picker-sub">${position || "без должности"}</div>
                    </div>
                    <span class="member-picker-check">
                        <i class="fas ${option.selected ? "fa-check" : "fa-plus"}"></i>
                    </span>
                </button>
            `;
        }).join("")
        : `<div class="member-picker-empty">По этому запросу никого не найдено</div>`;
}
