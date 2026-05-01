// Файл: RemoteControl1/wwwroot/js/site.js

window.remoteControlData = window.remoteControlData || {};

(function setupRemoteLucideIcons() {
    const iconMap = {
        "fa-home": "home",
        "fa-house": "home",
        "fa-house-chimney": "home",
        "fa-gauge-high": "gauge",
        "fa-tachometer-alt": "gauge",
        "fa-tasks": "check-square",
        "fa-list-check": "check-square",
        "fa-project-diagram": "folder-kanban",
        "fa-diagram-project": "folder-kanban",
        "fa-layer-group": "folder-kanban",
        "fa-stopwatch": "clock",
        "fa-clock": "clock",
        "fa-chart-bar": "file-text",
        "fa-chart-simple": "file-text",
        "fa-file-alt": "file-text",
        "fa-file-lines": "file-text",
        "fa-file-csv": "file-spreadsheet",
        "fa-file-excel": "file-spreadsheet",
        "fa-file-word": "file-text",
        "fa-file-pdf": "file-text",
        "fa-print": "printer",
        "fa-calendar": "calendar",
        "fa-calendar-alt": "calendar",
        "fa-calendar-days": "calendar",
        "fa-users": "users",
        "fa-user-group": "users",
        "fa-user": "user",
        "fa-user-circle": "circle-user",
        "fa-bell": "bell",
        "fa-table-columns": "layout-dashboard",
        "fa-sparkles": "sparkles",
        "fa-moon": "moon",
        "fa-sun": "sun",
        "fa-sign-out-alt": "log-out",
        "fa-right-from-bracket": "log-out",
        "fa-cog": "settings",
        "fa-gear": "settings",
        "fa-sliders": "sliders-horizontal",
        "fa-palette": "palette",
        "fa-bars": "menu",
        "fa-chevron-up": "chevron-up",
        "fa-chevron-down": "chevron-down",
        "fa-chevron-left": "chevron-left",
        "fa-chevron-right": "chevron-right",
        "fa-plus": "plus",
        "fa-filter": "filter",
        "fa-search": "search",
        "fa-magnifying-glass": "search",
        "fa-edit": "pencil",
        "fa-pen-to-square": "pencil",
        "fa-trash": "trash-2",
        "fa-trash-alt": "trash-2",
        "fa-trash-can": "trash-2",
        "fa-save": "save",
        "fa-floppy-disk": "save",
        "fa-eye": "eye",
        "fa-eye-slash": "eye-off",
        "fa-lock": "lock",
        "fa-lock-open": "unlock",
        "fa-mail": "mail",
        "fa-envelope": "mail",
        "fa-phone": "phone",
        "fa-play": "play",
        "fa-pause": "pause",
        "fa-stop": "square",
        "fa-info-circle": "circle-info",
        "fa-circle-info": "circle-info",
        "fa-circle-exclamation": "circle-alert",
        "fa-exclamation-triangle": "triangle-alert",
        "fa-triangle-exclamation": "triangle-alert",
        "fa-check-circle": "circle-check",
        "fa-circle-check": "circle-check",
        "fa-check": "check",
        "fa-times": "x",
        "fa-xmark": "x",
        "fa-sync-alt": "refresh-cw",
        "fa-rotate": "refresh-cw",
        "fa-undo": "rotate-ccw",
        "fa-rotate-left": "rotate-ccw",
        "fa-redo": "rotate-cw",
        "fa-rotate-right": "rotate-cw",
        "fa-arrow-up": "arrow-up",
        "fa-arrow-down": "arrow-down",
        "fa-arrow-down-wide-short": "arrow-down-wide-narrow",
        "fa-calendar-day": "calendar-days",
        "fa-calendar-week": "calendar-range",
        "fa-inbox": "inbox",
        "fa-paper-plane": "send",
        "fa-paperclip": "paperclip",
        "fa-download": "download",
        "fa-upload": "upload",
        "fa-shield-alt": "shield",
        "fa-shield-halved": "shield",
        "fa-user-shield": "shield",
        "fa-user-gear": "settings",
        "fa-briefcase": "briefcase-business",
        "fa-business-time": "clock-3",
        "fa-wallet": "wallet",
        "fa-gift": "gift",
        "fa-chart-pie": "chart-pie",
        "fa-rocket": "clock"
    };

    function findIconName(icon) {
        for (const className of icon.classList || []) {
            if (iconMap[className]) return iconMap[className];
        }

        return "";
    }

    function markIcon(icon) {
        if (!icon || icon.dataset?.lucideReady === "true") return false;

        const lucideName = findIconName(icon);
        if (!lucideName) return false;

        icon.setAttribute("data-lucide", lucideName);
        icon.dataset.lucideReady = "true";
        icon.classList.add("rc-lucide-icon");
        return true;
    }

    function runLucide(root) {
        const scope = root || document;
        let changed = false;

        if (scope.matches?.("i[class*='fa-']")) {
            changed = markIcon(scope) || changed;
        }

        scope.querySelectorAll?.("i[class*='fa-']").forEach(icon => {
            changed = markIcon(icon) || changed;
        });

        if (changed && window.lucide?.createIcons) {
            window.lucide.createIcons({
                attrs: {
                    "stroke-width": 2,
                    "aria-hidden": "true"
                }
            });
        }
    }

    window.renderRemoteIcons = runLucide;

    document.addEventListener("DOMContentLoaded", () => {
        runLucide(document);

        const observer = new MutationObserver(mutations => {
            let changed = false;

            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;

                    if (node.matches?.("i[class*='fa-']")) {
                        changed = markIcon(node) || changed;
                    }

                    node.querySelectorAll?.("i[class*='fa-']").forEach(icon => {
                        changed = markIcon(icon) || changed;
                    });
                });
            });

            if (changed && window.lucide?.createIcons) {
                window.lucide.createIcons({
                    attrs: {
                        "stroke-width": 2,
                        "aria-hidden": "true"
                    }
                });
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
})();

function toRemoteBoolean(value) {
    if (typeof value === "boolean") return value;
    return String(value || "").toLowerCase() === "true";
}

function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

const TASK_META_OPEN = "[[RC_TASK_META]]";
const TASK_META_CLOSE = "[[/RC_TASK_META]]";

function parseTaskDescriptionPayload(value) {
    const raw = String(value ?? "");
    const start = raw.indexOf(TASK_META_OPEN);
    const end = raw.indexOf(TASK_META_CLOSE);

    let description = raw.trim();
    let meta = {};

    if (start !== -1 && end > start) {
        const jsonStart = start + TASK_META_OPEN.length;
        const jsonText = raw.slice(jsonStart, end).trim();
        const visibleText = `${raw.slice(0, start)} ${raw.slice(end + TASK_META_CLOSE.length)}`.trim();

        description = visibleText;

        try {
            const parsed = JSON.parse(jsonText);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                meta = parsed;
            }
        } catch {
            meta = {};
        }
    }

    const report = meta && typeof meta === "object" ? meta.completionReport : null;

    return {
        raw,
        description,
        meta,
        completionReportText: typeof report?.text === "string" ? report.text.trim() : "",
        completionReportedAt: typeof report?.submittedAt === "string" ? report.submittedAt : "",
        completionReportedBy: typeof report?.submittedBy === "string" ? report.submittedBy : ""
    };
}

function buildTaskDescriptionPayload(description, meta) {
    const cleanDescription = String(description ?? "").trim();
    const nextMeta = meta && typeof meta === "object" && !Array.isArray(meta)
        ? { ...meta }
        : {};

    if (!String(nextMeta?.completionReport?.text || "").trim()) {
        delete nextMeta.completionReport;
    }

    const hasMeta = Object.keys(nextMeta).length > 0;
    if (!hasMeta) {
        return cleanDescription;
    }

    const serialized = JSON.stringify(nextMeta);
    return cleanDescription
        ? `${cleanDescription}\n\n${TASK_META_OPEN}${serialized}${TASK_META_CLOSE}`
        : `${TASK_META_OPEN}${serialized}${TASK_META_CLOSE}`;
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

    const rawDescription = task.description ?? task.Description ?? "";
    const parsedDescription = parseTaskDescriptionPayload(rawDescription);

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
        descriptionRaw: parsedDescription.raw,
        description: parsedDescription.description,
        taskMeta: parsedDescription.meta,
        completionReportText: parsedDescription.completionReportText,
        completionReportedAt: parsedDescription.completionReportedAt,
        completionReportedBy: parsedDescription.completionReportedBy,
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
          bonusReason: user.bonusReason ?? user.BonusReason ?? "",
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

function isMobileShell() {
    return window.matchMedia("(max-width: 992px)").matches;
}

function applySidebarStoredState() {
    if (isMobileShell()) {
        document.body.classList.remove("sidebar-collapsed", "sidebar-open");
    }
}

function toggleSidebar() {
    if (isMobileShell()) {
        document.body.classList.toggle("sidebar-open");
        return;
    }

    document.body.classList.toggle("sidebar-collapsed");
}

function closeSidebarMobile() {
    document.body.classList.remove("sidebar-open");
}

function initAppShell() {
    applySidebarStoredState();

    document.querySelectorAll(".sidebar-link").forEach(link => {
        link.addEventListener("click", () => {
            if (isMobileShell()) {
                closeSidebarMobile();
            }
        });
    });

    window.addEventListener("resize", applySidebarStoredState);
}

function toggleProfileDropdown() {
    const dropdown = document.getElementById("profileDropdown");
    if (!dropdown) return;

    dropdown.classList.toggle("show");
}

function getNotificationStorageKey() {
    return `rc_seen_notifications_${window.currentUserId || 0}`;
}

function getSeenNotificationIds() {
    try {
        const raw = window.localStorage.getItem(getNotificationStorageKey());
        const parsed = JSON.parse(raw || "[]");
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
}

function saveSeenNotificationIds(ids) {
    try {
        window.localStorage.setItem(getNotificationStorageKey(), JSON.stringify(Array.from(ids)));
    } catch {
        // ignore storage errors
    }
}

function formatHeaderNotificationTime(value) {
    if (!value) return "Сейчас";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

    if (diffMinutes < 1) return "Сейчас";
    if (diffMinutes < 60) return `${diffMinutes} мин назад`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} ч назад`;

    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays} дн назад`;

    return date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short"
    });
}

function buildHeaderNotifications() {
    const items = [];
    const now = Date.now();
    const currentUserNameNormalized = String(window.currentUserName || "").trim().toLowerCase();
    const currentUserIdValue = Number(window.currentUserId || 0);

    const relevantTasks = Array.isArray(window.tasks)
        ? window.tasks.filter(task => {
            if (window.isAdmin || window.isManager) return true;
            return Number(task.userId || 0) === currentUserIdValue
                || String(task.assignee || "").trim().toLowerCase() === currentUserNameNormalized;
        })
        : [];

    relevantTasks
        .filter(task => task.status !== "done" && task.deadline && new Date(task.deadline).getTime() < now)
        .slice(0, 2)
        .forEach(task => {
            items.push({
                id: `task-overdue-${task.id}`,
                icon: "fa-clock",
                tone: "danger",
                title: "Просрочена задача",
                text: `${task.name || "Задача"} вышла за срок и требует внимания.`,
                time: formatHeaderNotificationTime(task.deadline)
            });
        });

    relevantTasks
        .filter(task => task.status === "review")
        .slice(0, 2)
        .forEach(task => {
            items.push({
                id: `task-review-${task.id}`,
                icon: "fa-list-check",
                tone: "info",
                title: "Задача на проверке",
                text: `${task.name || "Задача"} передана на проверку.`,
                time: formatHeaderNotificationTime(task.completionReportedAt || task.deadline)
            });
        });

    const manualRequests = Array.isArray(window.manualTimeRequests) ? window.manualTimeRequests : [];
    manualRequests
        .filter(request => {
            const requestUserId = Number(request.userId || request.employeeId || 0);
            const requestEmployee = String(request.employee || request.employeeName || "").trim().toLowerCase();

            if (window.isAdmin || window.isManager) {
                return String(request.status || "").toLowerCase() === "pending";
            }

            return requestUserId === currentUserIdValue || requestEmployee === currentUserNameNormalized;
        })
        .slice(0, 3)
        .forEach(request => {
            const normalizedStatus = String(request.status || "").toLowerCase();
            const isRevision = normalizedStatus === "needs_revision";
            items.push({
                id: `manual-request-${request.id}-${normalizedStatus || "pending"}`,
                icon: isRevision ? "fa-rotate-left" : "fa-file-circle-check",
                tone: isRevision ? "warning" : "info",
                title: isRevision ? "Заявка возвращена" : "Заявка ожидает решения",
                text: isRevision
                    ? `Заявка #${request.id} возвращена на доработку.`
                    : `Заявка #${request.id} ожидает проверки.`,
                time: formatHeaderNotificationTime(request.reviewedAt || request.createdAt)
            });
        });

    if (!items.length) {
        items.push({
            id: "notifications-placeholder",
            icon: "fa-sparkles",
            tone: "info",
            title: "Центр уведомлений",
            text: "Здесь будут появляться события по задачам, проверкам и заявкам. Пока блок работает как аккуратная заглушка.",
            time: "Скоро",
            passive: true
        });
    }

    return items.slice(0, 6);
}

function renderHeaderNotifications() {
    const list = document.getElementById("notificationsDropdownList");
    const dot = document.getElementById("navNotificationsDot");
    const badge = document.getElementById("notificationsUnreadBadge");

    if (!list || !dot || !badge) {
        return [];
    }

    const items = buildHeaderNotifications();
    const seenIds = getSeenNotificationIds();
    const unreadItems = items.filter(item => !item.passive && !seenIds.has(item.id));

    list.innerHTML = items.map(item => `
        <div class="notifications-dropdown-item ${item.tone ? `is-${item.tone}` : ""} ${seenIds.has(item.id) || item.passive ? "is-read" : ""}">
            <span class="notifications-dropdown-icon">
                <i class="fas ${item.icon || "fa-bell"}"></i>
            </span>
            <div class="notifications-dropdown-copy">
                <strong>${item.title}</strong>
                <p>${item.text}</p>
                <span class="notifications-dropdown-meta">${item.time}</span>
            </div>
        </div>
    `).join("");

    dot.classList.toggle("hidden", unreadItems.length === 0);
    badge.classList.toggle("hidden", unreadItems.length === 0);
    badge.textContent = String(unreadItems.length);

    return items;
}

function markVisibleNotificationsAsRead() {
    const items = buildHeaderNotifications();
    const seenIds = getSeenNotificationIds();

    items.forEach(item => {
        if (!item.passive) {
            seenIds.add(item.id);
        }
    });

    saveSeenNotificationIds(seenIds);
    renderHeaderNotifications();
}

function markAllNotificationsAsRead() {
    markVisibleNotificationsAsRead();
    showNotification("Все текущие уведомления отмечены как просмотренные.");
}

function toggleNotificationsDropdown(event) {
    event?.stopPropagation?.();

    const dropdown = document.getElementById("notificationsDropdown");
    if (!dropdown) return;

    const shouldOpen = !dropdown.classList.contains("show");
    dropdown.classList.toggle("show", shouldOpen);

    if (shouldOpen) {
        renderHeaderNotifications();
        window.setTimeout(() => {
            markVisibleNotificationsAsRead();
        }, 180);
    }
}

function toggleThemePlaceholder() {
    const btn = document.querySelector(".nav-theme-btn");
    btn?.classList.toggle("is-active");
    showNotification("Переключатель тёмной темы добавлен как заглушка. Полная тёмная тема будет подключена следующим этапом.");
}

function initHeaderChrome() {
    renderHeaderNotifications();
    window.setTimeout(renderHeaderNotifications, 900);
}

document.addEventListener("click", function (e) {
    const block = document.getElementById("headerUserBlock");
    const dropdown = document.getElementById("profileDropdown");
    const notificationsRoot = document.getElementById("navNotifications");
    const notificationsDropdown = document.getElementById("notificationsDropdown");

    if (block && dropdown && !block.contains(e.target)) {
        dropdown.classList.remove("show");
    }

    if (notificationsRoot && notificationsDropdown && !notificationsRoot.contains(e.target)) {
        notificationsDropdown.classList.remove("show");
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
    initAppShell();
    initHeaderChrome();

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
