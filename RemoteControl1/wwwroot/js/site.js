// Файл: RemoteControl1/wwwroot/js/site.js

window.remoteControlData = window.remoteControlData || {};

function toRemoteBoolean(value) {
    if (typeof value === "boolean") return value;
    return String(value || "").toLowerCase() === "true";
}

function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function getProjectTypeLabel(value) {
    const type = String(value || "").trim().toLowerCase();

    if (type === "linear" || type === "линейный") return "Линейный";
    if (type === "hybrid" || type === "гибридный") return "Гибридный";
    if (type === "functional" || type === "функциональный") return "Функциональный";

    return value || "Функциональный";
}

function getProjectTypeKey(value) {
    const type = String(value || "").trim().toLowerCase();

    if (type === "linear" || type.includes("линей")) return "linear";
    if (type === "hybrid" || type.includes("гибрид")) return "hybrid";

    return "functional";
}

function normalizeTask(task) {
    if (!task) return task;

    return {
        ...task,
        id: toNumber(task.id ?? task.Id),
        name: task.name ?? task.Name ?? task.title ?? task.Title ?? "",
        project: task.project ?? task.Project ?? task.projectName ?? task.ProjectName ?? "",
        projectId: toNumber(task.projectId ?? task.ProjectId),
        userId: toNumber(task.userId ?? task.UserId),
        stageName: task.stageName ?? task.StageName ?? "",
        status: task.status ?? task.Status ?? "new",
        priority: task.priority ?? task.Priority ?? "medium",
        deadline: task.deadline ?? task.Deadline ?? "",
        deadlineRaw: task.deadlineRaw ?? task.DeadlineRaw ?? "",
        description: task.description ?? task.Description ?? "",
        assignee: task.assignee ?? task.Assignee ?? "",
        plannedTime: toNumber(task.plannedTime ?? task.PlannedTime ?? task.plannedTimeHours ?? task.PlannedTimeHours)
    };
}

function normalizeProject(project) {
    if (!project) return project;

    const rawMemberIds = project.memberIds ?? project.MemberIds ?? [];
    const rawStageNames = project.stageNames ?? project.StageNames ?? [];
    const rawType = project.projectType ?? project.ProjectType ?? project.projectTypeName ?? project.ProjectTypeName ?? "functional";
    const projectType = getProjectTypeKey(rawType);

    return {
        ...project,
        id: toNumber(project.id ?? project.Id),
        name: project.name ?? project.Name ?? "",
        description: project.description ?? project.Description ?? "",
        createdAt: project.createdAt ?? project.CreatedAt ?? "",
        tasksCount: toNumber(project.tasksCount ?? project.TasksCount),
        progress: toNumber(project.progress ?? project.Progress),
        managerId: project.managerId != null || project.ManagerId != null
            ? toNumber(project.managerId ?? project.ManagerId)
            : null,
        managerName: project.managerName ?? project.ManagerName ?? "",
        memberIds: Array.isArray(rawMemberIds) ? rawMemberIds.map(Number) : [],
        membersCount: toNumber(project.membersCount ?? project.MembersCount),
        projectType,
        projectTypeName: getProjectTypeLabel(projectType),
        stageNames: Array.isArray(rawStageNames) ? rawStageNames : []
    };
}

function normalizeUser(user) {
    if (!user) return user;

    const isActiveValue = user.isActive ?? user.IsActive;
    const statusValue = user.status ?? user.Status ?? (isActiveValue === false ? "blocked" : "active");

    return {
        ...user,
        id: toNumber(user.id ?? user.Id),
        fullName: user.fullName ?? user.FullName ?? "",
        login: user.login ?? user.Login ?? "",
        email: user.email ?? user.Email ?? "",
        phone: user.phone ?? user.Phone ?? "",
        position: user.position ?? user.Position ?? "",
        role: String(user.role ?? user.Role ?? "employee").toLowerCase(),
        hourlyRate: toNumber(user.hourlyRate ?? user.HourlyRate ?? user.rate ?? user.Rate),
        rate: toNumber(user.rate ?? user.Rate ?? user.hourlyRate ?? user.HourlyRate),
        status: statusValue,
        tasksInProgress: toNumber(user.tasksInProgress ?? user.TasksInProgress),
        completedTasks: toNumber(user.completedTasks ?? user.CompletedTasks),
        overdueTasks: toNumber(user.overdueTasks ?? user.OverdueTasks),
        totalHours: toNumber(user.totalHours ?? user.TotalHours),
        plannedHours: toNumber(user.plannedHours ?? user.PlannedHours),
        workMode: user.workMode ?? user.WorkMode ?? "fixed",
        requiredDailyHours: toNumber(user.requiredDailyHours ?? user.RequiredDailyHours, 8),
        plannedStartTime: user.plannedStartTime ?? user.PlannedStartTime ?? "",
        plannedEndTime: user.plannedEndTime ?? user.PlannedEndTime ?? "",
        workDayHours: toNumber(user.workDayHours ?? user.WorkDayHours),
        trackedHours: toNumber(user.trackedHours ?? user.TrackedHours),
        idleHours: toNumber(user.idleHours ?? user.IdleHours),
        salaryHours: toNumber(user.salaryHours ?? user.SalaryHours),
        workloadDiff: toNumber(user.workloadDiff ?? user.WorkloadDiff),
        completionPercent: toNumber(user.completionPercent ?? user.CompletionPercent),
        productivityState: user.productivityState ?? user.ProductivityState ?? "normal",
        bonusPercent: toNumber(user.bonusPercent ?? user.BonusPercent),
        bonusAmount: toNumber(user.bonusAmount ?? user.BonusAmount)
    };
}

function normalizeActivity(item) {
    if (!item) return item;

    return {
        ...item,
        date: item.date ?? item.Date ?? "",
        task: item.task ?? item.Task ?? "",
        project: item.project ?? item.Project ?? "",
        hours: toNumber(item.hours ?? item.Hours),
        comment: item.comment ?? item.Comment ?? ""
    };
}

window.currentUserId = toNumber(window.remoteControlData.currentUserId ?? window.remoteControlData.CurrentUserId);
window.currentUserName = window.remoteControlData.currentUserName ?? "";
window.currentUserEmail = window.remoteControlData.currentUserEmail ?? "";
window.currentUserLogin = window.remoteControlData.currentUserLogin ?? "";
window.currentUserPhone = window.remoteControlData.currentUserPhone ?? "";
window.currentUserPosition = window.remoteControlData.currentUserPosition ?? "";
window.currentUserRate = toNumber(window.remoteControlData.currentUserRate);
window.currentUserIsActive = toRemoteBoolean(window.remoteControlData.currentUserIsActive);

window.currentUserRole = String(window.remoteControlData.currentUserRole ?? "employee").toLowerCase();
window.isAdmin = toRemoteBoolean(window.remoteControlData.isAdmin);
window.isManager = toRemoteBoolean(window.remoteControlData.isManager);
window.isEmployee = toRemoteBoolean(window.remoteControlData.isEmployee);

window.tasks = Array.isArray(window.remoteControlData.tasks)
    ? window.remoteControlData.tasks.map(normalizeTask)
    : [];

window.projects = Array.isArray(window.remoteControlData.projects)
    ? window.remoteControlData.projects.map(normalizeProject)
    : [];

window.users = Array.isArray(window.remoteControlData.users)
    ? window.remoteControlData.users.map(normalizeUser)
    : [];

window.activity = Array.isArray(window.remoteControlData.activity)
    ? window.remoteControlData.activity.map(normalizeActivity)
    : [];

window.workDays = Array.isArray(window.remoteControlData.workDays)
    ? window.remoteControlData.workDays
    : [];

window.calendarEvents = Array.isArray(window.remoteControlData.calendarEvents)
    ? window.remoteControlData.calendarEvents
    : [];

window.timeEntries = Array.isArray(window.remoteControlData.timeEntries)
    ? window.remoteControlData.timeEntries.map(normalizeActivity)
    : window.activity;

window.manualTimeRequests = window.manualTimeRequests || [];

window.seconds = window.seconds ?? 0;
window.timerInterval = window.timerInterval ?? null;
window.isTracking = window.isTracking ?? false;
window.isPaused = window.isPaused ?? false;
window.isWorkDayStarted = window.isWorkDayStarted ?? false;
window.activeTaskId = window.activeTaskId ?? null;
window.activeTaskName = window.activeTaskName ?? "";

function getRequestVerificationToken() {
    const input = document.querySelector('input[name="__RequestVerificationToken"]');
    return input ? input.value : "";
}

function showNotification(message) {
    const notification = document.getElementById("notification");
    const messageEl = document.getElementById("notificationMessage");

    if (messageEl) {
        messageEl.textContent = message;
    }

    if (notification) {
        notification.classList.remove("hidden");
        setTimeout(() => {
            notification.classList.add("hidden");
        }, 2000);
    } else {
        console.log(message);
    }
}

function toggleProfileDropdown() {
    const dropdown = document.getElementById("profileDropdown");
    if (!dropdown) return;

    dropdown.classList.toggle("show");
}

document.addEventListener("click", function (e) {
    const block = document.getElementById("headerUserBlock");
    const dropdown = document.getElementById("profileDropdown");

    if (!block || !dropdown) return;

    if (!block.contains(e.target)) {
        dropdown.classList.remove("show");
    }
});

async function logout() {
    try {
        const token = getRequestVerificationToken();

        const res = await fetch("/MainPage?handler=Logout", {
            method: "POST",
            headers: {
                "RequestVerificationToken": token
            }
        });

        const data = await res.json();

        if (res.ok && data.ok) {
            window.location.href = data.redirect || "/Auth";
            return;
        }
    } catch (e) {
        console.error(e);
    }

    window.location.href = "/Auth";
}

function getRoleBadge(role) {
    const value = String(role || "").toLowerCase();

    if (value === "admin") {
        return '<span class="task-status status-done">Администратор</span>';
    }

    if (value === "manager") {
        return '<span class="task-status status-review">Руководитель</span>';
    }

    return '<span class="task-status status-inprogress">Сотрудник</span>';
}

function getUserStatusBadge(status) {
    return status === "blocked"
        ? '<span class="task-status status-new">Заблокирован</span>'
        : '<span class="task-status status-done">Активен</span>';
}

function getPriorityClass(priority) {
    const value = String(priority || "").toLowerCase();

    return ({
        high: "badge-danger",
        medium: "badge-warning",
        low: "badge-success"
    }[value]) || "badge-warning";
}

function getStatusClass(status) {
    const value = String(status || "").toLowerCase();

    return ({
        new: "badge-info",
        progress: "badge-warning",
        review: "badge-warning",
        done: "badge-success"
    }[value]) || "badge-warning";
}

function getStatusBadgeClass(status) {
    const value = String(status || "").toLowerCase();

    return ({
        new: "status-new",
        progress: "status-progress",
        review: "status-review",
        done: "status-done"
    }[value]) || "status-new";
}

function getStatusText(status) {
    const value = String(status || "").toLowerCase();

    if (value === "new") return "Новая";
    if (value === "progress") return "В работе";
    if (value === "review") return "На проверке";
    if (value === "done") return "Завершена";

    return "—";
}

function getPriorityText(priority) {
    const value = String(priority || "").toLowerCase();

    if (value === "high") return "Высокий";
    if (value === "medium") return "Средний";
    if (value === "low") return "Низкий";

    return "—";
}

function extractLastName(fullName) {
    return (fullName || "").split(" ")[0] || "";
}

function extractFirstName(fullName) {
    return (fullName || "").split(" ")[1] || "";
}

function extractMiddleName(fullName) {
    return (fullName || "").split(" ").slice(2).join(" ");
}

function getRoleText(role) {
    const value = String(role || "").toLowerCase();

    if (value === "admin") return "Администратор";
    if (value === "manager") return "Руководитель";
    return "Сотрудник";
}

function getStatusTextFull(isActive) {
    return isActive ? "Активен" : "Заблокирован";
}

function safeCall(fnName) {
    const fn = window[fnName];

    if (typeof fn !== "function") {
        return;
    }

    try {
        fn();
    } catch (e) {
        console.error(`Ошибка в ${fnName}:`, e);
    }
}

function initUsersPage() {
    const employeeSearch = document.getElementById("employeeSearch");
    if (employeeSearch) {
        employeeSearch.setAttribute("autocomplete", "off");
        employeeSearch.setAttribute("name", "users-filter-query");
        employeeSearch.setAttribute("autocapitalize", "off");
        employeeSearch.setAttribute("autocorrect", "off");
        employeeSearch.setAttribute("spellcheck", "false");
        employeeSearch.setAttribute("data-lpignore", "true");

        const unlockSearchField = () => {
            if (employeeSearch.hasAttribute("readonly")) {
                employeeSearch.removeAttribute("readonly");
            }
        };

        const clearUnexpectedSearchAutofill = () => {
            if (employeeSearch !== document.activeElement && employeeSearch.value) {
                employeeSearch.value = "";
            }
        };

        employeeSearch.addEventListener("focus", unlockSearchField, { once: true });
        employeeSearch.addEventListener("pointerdown", unlockSearchField, { once: true });

        clearUnexpectedSearchAutofill();
        [150, 500, 1200].forEach(delay => {
            setTimeout(() => {
                clearUnexpectedSearchAutofill();
                safeCall("renderUsersTable");
            }, delay);
        });

        window.addEventListener("pageshow", () => {
            clearUnexpectedSearchAutofill();
            safeCall("renderUsersTable");
        }, { once: true });
    }

    safeCall("renderAdminStats");
    safeCall("renderUsersTable");
    safeCall("renderWorkloadTable");
    safeCall("renderProductivityTable");
    safeCall("renderSalaryTable");
    safeCall("renderBonusesTable");
    safeCall("renderControlTab");
    safeCall("loadManualTimeRequests");
}

document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("tasksPage")) {
        safeCall("fillProjectFilter");
        safeCall("filterTasks");
    }

    if (document.getElementById("projectsPage")) {
        safeCall("refreshProjectsStats");
        safeCall("filterProjects");
    }

    if (document.getElementById("reportsPage")) {
        safeCall("initReportsPage");
    }

    if (document.getElementById("calendarPage")) {
        safeCall("initCalendarPage");
    }

    if (document.getElementById("profilePage")) {
        safeCall("initProfilePage");
    }

    if (document.getElementById("usersPage")) {
        safeCall("initUsersPage");
    }

    if (document.getElementById("trackerPage")) {
        safeCall("initTrackerPage");
    }

    if (document.getElementById("dashboardPage")) {
        safeCall("initDashboardPage");
    }
});
