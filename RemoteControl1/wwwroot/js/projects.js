//projects.js


let currentOpenedProjectId = null;

function refreshProjectsStats() {
    projects = projects.map(project => {
        const projectId = Number(project.id);
        const projectTasks = tasks.filter(t => Number(t.projectId) === projectId);
        const tasksCount = projectTasks.length;

        let progress = 0;

        if (Array.isArray(project.stageNames) && project.stageNames.length > 0) {
            const stagePercents = project.stageNames.map(stageName => {
                const stageTasks = projectTasks.filter(t => (t.stageName || "") === stageName);

                if (stageTasks.length === 0) {
                    return 0;
                }

                const doneCount = stageTasks.filter(t => t.status === "done").length;
                return Math.round((doneCount / stageTasks.length) * 100);
            });

            progress = stagePercents.length > 0
                ? Math.round(stagePercents.reduce((sum, x) => sum + x, 0) / stagePercents.length)
                : 0;
        } else {
            const doneCount = projectTasks.filter(t => t.status === "done").length;
            progress = tasksCount > 0
                ? Math.round((doneCount / tasksCount) * 100)
                : 0;
        }

        return {
            ...project,
            id: projectId,
            tasksCount: tasksCount,
            progress: progress
        };
    });

    filteredProjects = [...projects];
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
        <div class="project-card" onclick="showProjectDetails(${project.id})">
            <div class="project-top">
                <div class="project-title-wrap">
                    <div class="project-name">${project.name}</div>
                    <div class="project-type-badge">
                        <i class="fas fa-layer-group"></i>
                        ${project.projectTypeName || "Проект"}
                    </div>
                </div>

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
                    <div class="value">${(project.progress || 0) >= 100 ? "Завершен" : "Активный"}</div>
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
                ${project.stageNames.slice(0, 4).map(stage => `
                    <span class="stage-chip">
                        <i class="fas fa-circle" style="font-size:8px;color:var(--primary)"></i>
                        ${stage}
                    </span>
                `).join("")}
                ${project.stageNames.length > 4 ? `
                    <span class="stage-chip">...</span>
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

    renderProjects();
}

function sortProjects() {
    const sortBy = document.getElementById("projectSort")?.value || "name";

    filteredProjects.sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "tasks") return (b.tasksCount || 0) - (a.tasksCount || 0);
        if (sortBy === "progress") return (b.progress || 0) - (a.progress || 0);
        return 0;
    });

    renderProjects();
}

function resetProjectFilters() {
    const projectSearch = document.getElementById("projectSearch");
    const projectSort = document.getElementById("projectSort");
    const projectStatusFilter = document.getElementById("projectStatusFilter");

    if (projectSearch) projectSearch.value = "";
    if (projectSort) projectSort.value = "name";
    if (projectStatusFilter) projectStatusFilter.value = "all";

    filteredProjects = [...projects];
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
    const modal = document.getElementById("addProjectModal");

    if (projectName) projectName.value = "";
    if (projectDescription) projectDescription.value = "";

    selectedProjectPreset = "functional";

    fillProjectManagerSelect();
    fillProjectMembersSelect([]);
    renderProjectPresetCards();
    renderProjectPresetStages();

    if (modal) modal.classList.add("show");
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
    renderProjectPresetCards();
    renderProjectPresetStages();
}

function renderProjectPresetStages() {
    const box = document.getElementById("projectPresetStagesPreview");
    if (!box) return;

    const preset = projectPresets[selectedProjectPreset];
    if (!preset) {
        box.innerHTML = "";
        return;
    }

    box.innerHTML = preset.stages.map((stage, index) => `
        <div class="stage-editor-item">
            <div>
                <strong>${stage}</strong>
                <div style="font-size:12px; color:var(--gray);">Порядок: ${index + 1}</div>
            </div>

            <div style="display:flex; gap:8px;">
                <button class="btn btn-sm btn-outline" type="button" title="Вверх">
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="btn btn-sm btn-outline" type="button" title="Вниз">
                    <i class="fas fa-arrow-down"></i>
                </button>
                <button class="btn btn-sm btn-outline" type="button" title="Переименовать">
                    <i class="fas fa-pen"></i>
                </button>
            </div>
        </div>
    `).join("");
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

function renderEditProjectStages() {
    const container = document.getElementById("editProjectStagesList");
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

    container.innerHTML = editProjectStages.map((stage, index) => `
        <div class="stage-editor-item">
            <div style="flex:1; min-width:0;">
                <input
                    type="text"
                    class="form-control"
                    value="${stage.replace(/"/g, "&quot;")}"
                    onchange="renameEditProjectStage(${index}, this.value)"
                    placeholder="Название этапа">
                <div style="font-size:12px; color:var(--gray); margin-top:6px;">
                    Порядок: ${index + 1}
                </div>
            </div>

            <div style="display:flex; gap:8px; flex-shrink:0;">
                <button class="btn btn-sm btn-outline" type="button" title="Вверх" onclick="moveEditProjectStageUp(${index})">
                    <i class="fas fa-arrow-up"></i>
                </button>

                <button class="btn btn-sm btn-outline" type="button" title="Вниз" onclick="moveEditProjectStageDown(${index})">
                    <i class="fas fa-arrow-down"></i>
                </button>

                <button class="btn btn-sm btn-danger" type="button" title="Удалить" onclick="removeEditProjectStage(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join("");
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

function openEditProjectModal(id) {
    const project = projects.find(p => Number(p.id) === Number(id));
    if (!project) {
        showNotification("Проект не найден");
        return;
    }

    suspendProjectViewModal();

    const editProjectId = document.getElementById("editProjectId");
    const editProjectName = document.getElementById("editProjectName");
    const editProjectDescription = document.getElementById("editProjectDescription");
    const modal = document.getElementById("editProjectModal");

    if (editProjectId) editProjectId.value = String(project.id);
    if (editProjectName) editProjectName.value = project.name || "";
    if (editProjectDescription) editProjectDescription.value = project.description || "";

    fillEditProjectManagerSelect(project.managerId || null);
    fillEditProjectMembersSelect(project.memberIds || []);

    const projectTypeKey =
        project.projectTypeName === "Линейный" ? "linear" :
            project.projectTypeName === "Гибридный" ? "hybrid" :
                "functional";

    selectedEditProjectPreset = projectTypeKey;

    const stageNames = Array.isArray(project.stageNames) ? [...project.stageNames] : [];
    editProjectStages = stageNames.length
        ? stageNames
        : [...(projectPresets[selectedEditProjectPreset]?.stages || [])];

    const newEditStageName = document.getElementById("newEditStageName");
    if (newEditStageName) {
        newEditStageName.value = "";
    }

    renderEditProjectPresetCards();
    renderEditProjectStages();

    if (modal) modal.classList.add("show");
}


async function addProject() {
    const name = document.getElementById("projectName")?.value.trim() || "";
    const description = document.getElementById("projectDescription")?.value.trim() || "";

    if (!name) {
        showNotification("Введите название проекта");
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
        stageNames: [...(projectPresets[selectedProjectPreset]?.stages || [])]
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

        const project = normalizeProject(data.project);

        projects.unshift(project);
        filteredProjects = [...projects];

        closeModal("addProjectModal");

        fillProjectFilter();
        fillProjectSelect("taskProjectSelect");
        fillProjectSelect("editTaskProject");
        renderProjects();
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

        const updatedProject = normalizeProject(data.project);
        const index = projects.findIndex(p => Number(p.id) === Number(updatedProject.id));

        if (index !== -1) {
            projects[index] = updatedProject;
        }

        filteredProjects = [...projects];

        closeModal("editProjectModal");
        restoreProjectViewModal();

        editProjectStages = [];

        renderProjects();
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
    const project = projects.find(p => Number(p.id) === Number(id));

    if (!project) {
        showNotification("Проект не найден");
        return;
    }

    const linkedTasksCount = tasks.filter(t => Number(t.projectId) === Number(id)).length;

    const deleteProjectId = document.getElementById("deleteProjectId");
    const deleteProjectName = document.getElementById("deleteProjectName");
    const deleteProjectTasksCount = document.getElementById("deleteProjectTasksCount");
    const modal = document.getElementById("deleteProjectModal");

    if (deleteProjectId) deleteProjectId.value = project.id;
    if (deleteProjectName) deleteProjectName.textContent = project.name;
    if (deleteProjectTasksCount) deleteProjectTasksCount.textContent = linkedTasksCount;
    if (modal) modal.classList.add("show");
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
        renderProjects();
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

    const projectTasks = tasks.filter(t => Number(t.projectId) === Number(project.id));
    const doneTasks = projectTasks.filter(t => t.status === "done").length;

    let stageNames = Array.isArray(project.stageNames) && project.stageNames.length
        ? project.stageNames
        : [];

    if (!stageNames.length) {
        const projectName = (project.name || "").toLowerCase();

        if (projectName.includes("студент")) {
            stageNames = ["Backend", "Frontend", "UI/UX", "QA"];
        } else if (projectName.includes("crm")) {
            stageNames = ["Анализ", "Проектирование", "Разработка", "Тестирование", "Запуск"];
        } else {
            stageNames = ["Подготовка", "Разработка", "Тестирование", "Релиз"];
        }
    }

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

    const hasSelectedStage = tasksByStages.some(x => x.name === selectedProjectStageFilter);

    if (selectedProjectStageFilter && !hasSelectedStage) {
        selectedProjectStageFilter = "";
    }

    const visibleStages = selectedProjectStageFilter
        ? tasksByStages.filter(x => x.name === selectedProjectStageFilter)
        : tasksByStages;

    const currentStage = tasksByStages.find(x => x.progress < 100) || tasksByStages[0] || null;
    const currentStageIndex = currentStage
        ? tasksByStages.findIndex(x => x.name === currentStage.name)
        : -1;

    const nextStage = currentStageIndex >= 0 && currentStageIndex < tasksByStages.length - 1
        ? tasksByStages[currentStageIndex + 1]
        : null;

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
                    <div class="sub">по этапам проекта</div>
                </div>

                <div class="summary-mini">
                    <div class="label">Текущий этап</div>
                    <div class="value">${currentStage ? currentStage.name : "—"}</div>
                    <div class="sub">первый незавершённый</div>
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
                        <span>Добавить, удалить, переименовать</span>
                    </div>
                </div>

                <div class="action-card" onclick="setProjectStageFilter(${project.id}, '')" style="cursor:pointer;">
                    <i class="fas fa-filter"></i>
                    <div>
                        <strong>Показать все этапы</strong>
                        <span>Сбросить текущий фильтр этапа</span>
                    </div>
                </div>

                <div class="action-card">
                    <i class="fas fa-users"></i>
                    <div>
                        <strong>Состав команды</strong>
                        <span>Подключить участников проекта</span>
                    </div>
                </div>

                <div class="action-card">
                    <i class="fas fa-file-export"></i>
                    <div>
                        <strong>Экспорт по проекту</strong>
                        <span>Выгрузка задач, часов и сводки</span>
                    </div>
                </div>

                <div class="action-card">
                    <i class="fas fa-arrows-up-down-left-right"></i>
                    <div>
                        <strong>Перенос задач</strong>
                        <span>Потом сюда можно добавить drag & drop</span>
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

        if (stage.progress === 100) {
            cls = "done";
        } else if (index === currentStageIndex) {
            cls = "current";
        } else if (index === currentStageIndex + 1) {
            cls = "next";
        }

        return `
                        <div class="timeline-step ${cls}">
                            <div class="timeline-top">
                                <div class="timeline-index">Этап ${index + 1}</div>
                                <div class="timeline-percent">${stage.progress}%</div>
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
                                        <div class="task-row">
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

                                <button class="btn btn-outline" type="button" onclick="showAddTaskModal(${project.id}, '${stage.name.replace(/'/g, "\\'")}')">
                                    Добавить задачу в этап
                                </button>
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

                <button class="btn btn-outline" type="button" onclick="event.stopPropagation(); openEditProjectModal(${project.id})">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
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

    document.body.style.overflow = "hidden";
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

    document.body.style.overflow = "";
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
}

function filterProjectMembersOptions(searchInputId, selectId) {
    const searchInput = document.getElementById(searchInputId);
    const select = document.getElementById(selectId);
    if (!searchInput || !select) return;

    const query = (searchInput.value || "").trim().toLowerCase();

    [...select.options].forEach(option => {
        const text = (option.textContent || "").toLowerCase();
        option.hidden = query && !text.includes(query);
    });
}