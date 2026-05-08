// Файл: RemoteControl1/wwwroot/js/site.js

window.remoteControlData = window.remoteControlData || {};

(function setupRemoteSvgIcons() {
    const iconMap = {
        "fa-home": "home",
        "fa-house": "home",
        "fa-house-chimney": "home",
        "fa-stopwatch": "tracker",
        "fa-clock": "clock",
        "fa-business-time": "clock",
        "fa-play": "play",
        "fa-pause": "pause",
        "fa-stop": "stop",
        "fa-list-check": "tasks",
        "fa-tasks": "tasks",
        "fa-project-diagram": "projects",
        "fa-diagram-project": "projects",
        "fa-layer-group": "projects",
        "fa-sitemap": "route",
        "fa-file-signature": "edit",
        "fa-tag": "flag",
        "fa-folder": "folder",
        "fa-folder-open": "folder",
        "fa-chart-bar": "reports",
        "fa-chart-column": "reports",
        "fa-chart-line": "reports",
        "fa-chart-pie": "reports",
        "fa-file-csv": "save",
        "fa-file-excel": "save",
        "fa-file-word": "save",
        "fa-file-pdf": "save",
        "fa-file-lines": "save",
        "fa-file-code": "save",
        "fa-print": "print",
        "fa-calendar": "calendar",
        "fa-calendar-days": "calendar",
        "fa-calendar-day": "calendar",
        "fa-calendar-week": "calendar",
        "fa-user-group": "users",
        "fa-users": "users",
        "fa-user": "profile",
        "fa-user-circle": "profile",
        "fa-circle-user": "profile",
        "fa-user-plus": "user-plus",
        "fa-user-tag": "user-check",
        "fa-user-tie": "briefcase",
        "fa-bell": "bell",
        "fa-moon": "moon",
        "fa-sun": "sun",
        "fa-sign-out-alt": "logout",
        "fa-right-from-bracket": "logout",
        "fa-right-to-bracket": "login",
        "fa-cog": "settings",
        "fa-gear": "settings",
        "fa-sliders": "settings",
        "fa-sliders-h": "settings",
        "fa-palette": "settings",
        "fa-bars": "menu",
        "fa-chevron-up": "chevron-up",
        "fa-chevron-down": "chevron-down",
        "fa-chevron-left": "chevron-left",
        "fa-chevron-right": "chevron-right",
        "fa-plus": "plus",
        "fa-plus-circle": "plus",
        "fa-bolt": "warning",
        "fa-filter": "filter",
        "fa-sort": "sort",
        "fa-angles-up": "chevron-up",
        "fa-angles-down": "chevron-down",
        "fa-search": "search",
        "fa-magnifying-glass": "search",
        "fa-edit": "edit",
        "fa-pen-to-square": "edit",
        "fa-trash": "trash",
        "fa-trash-alt": "trash",
        "fa-trash-can": "trash",
        "fa-save": "save",
        "fa-floppy-disk": "save",
        "fa-eye": "info",
        "fa-eye-slash": "warning",
        "fa-lock": "lock",
        "fa-lock-open": "unlock",
        "fa-envelope": "mail",
        "fa-phone": "phone",
        "fa-info-circle": "info",
        "fa-circle-info": "info",
        "fa-circle-exclamation": "warning",
        "fa-exclamation-triangle": "warning",
        "fa-triangle-exclamation": "warning",
        "fa-check-circle": "done",
        "fa-circle-check": "done",
        "fa-file-circle-check": "done",
        "fa-check": "check",
        "fa-circle": "dot",
        "fa-times": "x",
        "fa-xmark": "x",
        "fa-sync-alt": "refresh",
        "fa-rotate": "refresh",
        "fa-rotate-left": "reset",
        "fa-rotate-right": "refresh",
        "fa-arrow-up": "arrow-up",
        "fa-arrow-down": "arrow-down",
        "fa-arrow-down-wide-short": "sort",
        "fa-arrow-up-right-from-square": "external",
        "fa-paper-plane": "send",
        "fa-paperclip": "paperclip",
        "fa-download": "save",
        "fa-upload": "plus",
        "fa-shield-alt": "shield",
        "fa-shield-halved": "shield",
        "fa-user-shield": "shield",
        "fa-briefcase": "briefcase",
        "fa-wallet": "money",
        "fa-gift": "gift",
        "fa-location-dot": "location",
        "fa-note-sticky": "note",
        "fa-quote-left": "info",
        "fa-flag": "flag",
        "fa-columns": "columns",
        "fa-circle-notch": "refresh",
        "fa-spinner": "refresh",
        "fa-circle-half-stroke": "contrast",
        "fa-compress": "compact",
        "fa-route": "route",
        "fa-id-card": "profile",
        "fa-address-book": "users",
        "fa-history": "clock",
        "fa-key": "lock",
        "fa-toggle-on": "done",
        "fa-sparkles": "done"
    };

    const svgAttrs = "class=\"rc-icon-svg\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"";

    function wrap(paths) {
        return `<svg ${svgAttrs}>${paths}</svg>`;
    }

    function getIconMarkup(key) {
        switch (key) {
            case "home": return wrap("<path d=\"M3 11.5 12 4l9 7.5\"/><path d=\"M5.5 10.5V20h13v-9.5\"/><path d=\"M9.5 20v-5h5v5\"/>");
            case "tracker": return wrap("<circle cx=\"12\" cy=\"13\" r=\"7\"/><path d=\"M12 13l3-2\"/><path d=\"M9 3h6\"/><path d=\"M12 6V4\"/>");
            case "clock": return wrap("<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 8v4l3 2\"/>");
            case "tasks": return wrap("<rect x=\"7\" y=\"3\" width=\"10\" height=\"18\" rx=\"2\"/><path d=\"M9 8h6\"/><path d=\"M9 13h6\"/><path d=\"M9 18h6\"/><path d=\"M4.5 8.5l1.5 1.5 2-2\"/><path d=\"M4.5 13.5l1.5 1.5 2-2\"/>");
            case "projects": return wrap("<path d=\"M3 7h7v5H3z\"/><path d=\"M14 4h7v5h-7z\"/><path d=\"M14 15h7v5h-7z\"/><path d=\"M10 9h4\"/><path d=\"M12 9v8\"/>");
            case "reports": return wrap("<path d=\"M5 19V9\"/><path d=\"M12 19V5\"/><path d=\"M19 19v-7\"/><path d=\"M3 19h18\"/>");
            case "calendar": return wrap("<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 10h18\"/><path d=\"M8 3v4\"/><path d=\"M16 3v4\"/>");
            case "users": return wrap("<circle cx=\"9\" cy=\"9\" r=\"3\"/><circle cx=\"17\" cy=\"10\" r=\"2.5\"/><path d=\"M4 19a5 5 0 0 1 10 0\"/><path d=\"M14.5 19a3.5 3.5 0 0 1 5-3\"/>");
            case "profile": return wrap("<circle cx=\"12\" cy=\"8\" r=\"3.5\"/><path d=\"M5 20a7 7 0 0 1 14 0\"/>");
            case "settings": return wrap("<path d=\"M4 6h8\"/><path d=\"M16 6h4\"/><circle cx=\"14\" cy=\"6\" r=\"2\"/><path d=\"M4 12h4\"/><path d=\"M12 12h8\"/><circle cx=\"10\" cy=\"12\" r=\"2\"/><path d=\"M4 18h10\"/><path d=\"M18 18h2\"/><circle cx=\"16\" cy=\"18\" r=\"2\"/>");
            case "folder": return wrap("<path d=\"M3 8h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><path d=\"M3 8V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2\"/>");
            case "briefcase": return wrap("<rect x=\"3\" y=\"7\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2\"/><path d=\"M3 12h18\"/>");
            case "shield": return wrap("<path d=\"M12 3l7 3v5c0 4.5-2.7 7.7-7 10-4.3-2.3-7-5.5-7-10V6z\"/><path d=\"M12 7v10\"/>");
            case "money": return wrap("<rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"2.5\"/><path d=\"M7 9h.01\"/><path d=\"M17 15h.01\"/>");
            case "done": return wrap("<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M8.5 12.5l2.2 2.2 4.8-5\"/>");
            case "warning": return wrap("<path d=\"M12 4l8 14H4z\"/><path d=\"M12 10v4\"/><path d=\"M12 17h.01\"/>");
            case "play": return wrap("<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"m11 9 5 3-5 3z\"/>");
            case "pause": return wrap("<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M10 9v6\"/><path d=\"M14 9v6\"/>");
            case "stop": return wrap("<circle cx=\"12\" cy=\"12\" r=\"8\"/><rect x=\"9.5\" y=\"9.5\" width=\"5\" height=\"5\" rx=\"1\"/>");
            case "plus": return wrap("<path d=\"M12 5v14\"/><path d=\"M5 12h14\"/>");
            case "search": return wrap("<circle cx=\"11\" cy=\"11\" r=\"6\"/><path d=\"m20 20-4.2-4.2\"/>");
            case "filter": return wrap("<path d=\"M4 6h16\"/><path d=\"M7 12h10\"/><path d=\"M10 18h4\"/>");
            case "sort": return wrap("<path d=\"M8 6h10\"/><path d=\"M8 12h7\"/><path d=\"M8 18h4\"/><path d=\"M5 5v14\"/><path d=\"m3.5 17 1.5 2 1.5-2\"/>");
            case "reset": return wrap("<path d=\"M5 12a7 7 0 1 0 2-4.95\"/><path d=\"M3 7v5h5\"/>");
            case "refresh": return wrap("<path d=\"M20 11a8 8 0 0 0-14.5-4.5\"/><path d=\"M4 4v5h5\"/><path d=\"M4 13a8 8 0 0 0 14.5 4.5\"/><path d=\"M20 20v-5h-5\"/>");
            case "save": return wrap("<path d=\"M5 4h11l3 3v13H5z\"/><path d=\"M8 4v6h8\"/><path d=\"M9 18h6\"/>");
            case "trash": return wrap("<path d=\"M5 7h14\"/><path d=\"M9 7V5h6v2\"/><path d=\"M8 10v7\"/><path d=\"M12 10v7\"/><path d=\"M16 10v7\"/><path d=\"M6 7l1 12h10l1-12\"/>");
            case "edit": return wrap("<path d=\"M4 20h4l10-10-4-4L4 16z\"/><path d=\"m12 6 4 4\"/>");
            case "bell": return wrap("<path d=\"M6 16h12\"/><path d=\"M8 16V11a4 4 0 1 1 8 0v5\"/><path d=\"M10 19a2 2 0 0 0 4 0\"/>");
            case "moon": return wrap("<path d=\"M18 14.5A7 7 0 0 1 9.5 6 7.5 7.5 0 1 0 18 14.5z\"/>");
            case "sun": return wrap("<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m4.93 19.07 1.41-1.41\"/><path d=\"m17.66 6.34 1.41-1.41\"/>");
            case "logout": return wrap("<path d=\"M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4\"/><path d=\"M14 16l5-4-5-4\"/><path d=\"M19 12H9\"/>");
            case "login": return wrap("<path d=\"M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4\"/><path d=\"M10 16l-5-4 5-4\"/><path d=\"M5 12h10\"/>");
            case "menu": return wrap("<path d=\"M4 7h16\"/><path d=\"M4 12h16\"/><path d=\"M4 17h16\"/>");
            case "chevron-up": return wrap("<path d=\"m6 14 6-6 6 6\"/>");
            case "chevron-down": return wrap("<path d=\"m6 10 6 6 6-6\"/>");
            case "chevron-left": return wrap("<path d=\"m14 6-6 6 6 6\"/>");
            case "chevron-right": return wrap("<path d=\"m10 6 6 6-6 6\"/>");
            case "mail": return wrap("<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"m4 7 8 6 8-6\"/>");
            case "phone": return wrap("<path d=\"M6 4h3l1 4-2 2a14 14 0 0 0 6 6l2-2 4 1v3c0 1-1 2-2 2A16 16 0 0 1 4 6c0-1 1-2 2-2z\"/>");
            case "send": return wrap("<path d=\"m4 12 16-7-4 14-4-5-8-2z\"/>");
            case "paperclip": return wrap("<path d=\"M8 12.5 14.5 6a3 3 0 1 1 4.2 4.2L10.8 18a5 5 0 1 1-7-7L12 3.8\"/>");
            case "print": return wrap("<path d=\"M7 8V4h10v4\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"6\" rx=\"1\"/><rect x=\"4\" y=\"8\" width=\"16\" height=\"8\" rx=\"2\"/>");
            case "gift": return wrap("<rect x=\"4\" y=\"10\" width=\"16\" height=\"10\" rx=\"2\"/><path d=\"M12 10v10\"/><path d=\"M4 14h16\"/><path d=\"M12 10H8.5A2.5 2.5 0 1 1 11 6.5L12 8l1-1.5A2.5 2.5 0 1 1 15.5 10H12z\"/>");
            case "location": return wrap("<path d=\"M12 20s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10z\"/><circle cx=\"12\" cy=\"10\" r=\"2\"/>");
            case "note": return wrap("<rect x=\"5\" y=\"4\" width=\"14\" height=\"16\" rx=\"2\"/><path d=\"M8 8h8\"/><path d=\"M8 12h8\"/><path d=\"M8 16h5\"/>");
            case "flag": return wrap("<path d=\"M6 20V5\"/><path d=\"M6 5h9l-1.5 3L15 11H6\"/>");
            case "columns": return wrap("<rect x=\"4\" y=\"5\" width=\"6\" height=\"14\" rx=\"2\"/><rect x=\"14\" y=\"5\" width=\"6\" height=\"14\" rx=\"2\"/>");
            case "route": return wrap("<circle cx=\"6\" cy=\"6\" r=\"2\"/><circle cx=\"18\" cy=\"18\" r=\"2\"/><path d=\"M8 6h4a3 3 0 0 1 3 3v1a3 3 0 0 0 3 3h0\"/><path d=\"M16 18h-4a3 3 0 0 1-3-3v-1a3 3 0 0 0-3-3H6\"/>");
            case "check": return wrap("<path d=\"m5 12 4 4 10-10\"/>");
            case "x": return wrap("<path d=\"m7 7 10 10\"/><path d=\"m17 7-10 10\"/>");
            case "dot": return wrap("<circle cx=\"12\" cy=\"12\" r=\"2.2\" fill=\"currentColor\" stroke=\"none\"/>");
            case "contrast": return wrap("<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 4a8 8 0 0 1 0 16z\"/>");
            case "compact": return wrap("<path d=\"M4 9h16\"/><path d=\"M4 15h16\"/><path d=\"M8 5h8\"/><path d=\"M8 19h8\"/>");
            case "external": return wrap("<path d=\"M14 5h5v5\"/><path d=\"M10 14 19 5\"/><path d=\"M19 14v5H5V5h5\"/>");
            case "user-plus": return wrap("<circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M4 19a5 5 0 0 1 10 0\"/><path d=\"M17 8v6\"/><path d=\"M14 11h6\"/>");
            case "user-check": return wrap("<circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M4 19a5 5 0 0 1 10 0\"/><path d=\"M16 11l2 2 3-4\"/>");
            case "unlock": return wrap("<rect x=\"5\" y=\"11\" width=\"14\" height=\"9\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 7-2\"/>");
            default: return wrap("<circle cx=\"12\" cy=\"12\" r=\"8\"/>");
        }
    }

    function findIconName(icon) {
        for (const className of icon.classList || []) {
            if (iconMap[className]) return iconMap[className];
        }
        return "";
    }

    function applyIcon(icon) {
        if (!icon) return false;
        const iconName = findIconName(icon);
        if (!iconName) return false;

        const nextMarkup = getIconMarkup(iconName);
        if (icon.dataset?.rcIconKey === iconName && icon.innerHTML === nextMarkup) {
            return false;
        }

        icon.dataset.rcIconKey = iconName;
        icon.classList.add("rc-icon-host");
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = nextMarkup;
        return true;
    }

    function run(root) {
        const scope = root || document;

        if (scope.matches?.("i[class*='fa-']")) {
            applyIcon(scope);
        }

        scope.querySelectorAll?.("i[class*='fa-']").forEach(applyIcon);
    }

    window.getRemoteIconMarkup = getIconMarkup;
    window.renderRemoteIcons = run;

    document.addEventListener("DOMContentLoaded", () => {
        run(document);

        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === "attributes" && mutation.target?.matches?.("i[class*='fa-']")) {
                    applyIcon(mutation.target);
                    return;
                }

                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    run(node);
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class"]
        });
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

<<<<<<< HEAD
function getSidebarStorageKey() {
    return "rc_sidebar_collapsed";
}

function syncSidebarRootState(isCollapsed) {
    const collapsed = Boolean(isCollapsed);
    document.documentElement.classList.toggle("rc-sidebar-collapsed", collapsed);
    document.body.classList.toggle("sidebar-collapsed", collapsed);

    document.querySelectorAll(".sidebar-collapse-btn").forEach(button => {
        button.setAttribute("aria-expanded", collapsed ? "false" : "true");
        button.setAttribute("aria-label", collapsed ? "Развернуть меню" : "Свернуть меню");
    });
}

function finishSidebarTransition() {
    document.body.classList.remove("sidebar-transitioning");
}

function setSidebarCollapsedState(isCollapsed) {
    if (document.body.classList.contains("sidebar-collapsed") === Boolean(isCollapsed)) {
        syncSidebarRootState(isCollapsed);
        return;
    }

    syncSidebarRootState(isCollapsed);

    try {
        window.localStorage.setItem(getSidebarStorageKey(), isCollapsed ? "1" : "0");
    } catch {
        // Storage can be unavailable in private modes.
    }
}

=======
>>>>>>> parent of fc6a7ff (переделать)
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
            text: "Здесь будут появляться события по задачам, проверкам и заявкам.",
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

function getStoredUiPreference(key, fallback = false) {
    try {
        const value = window.localStorage.getItem(key);
        return value === null ? fallback : value === "true";
    } catch {
        return fallback;
    }
}

function setStoredUiPreference(key, value) {
    try {
        window.localStorage.setItem(key, value ? "true" : "false");
    } catch {
        // ignore storage errors
    }
}

function applyUiPreferences() {
    const highContrast = getStoredUiPreference("rcUiHighContrast", true);
    const compactDensity = getStoredUiPreference("rcUiCompactDensity", false);

    document.body.classList.toggle("ui-contrast-strong", highContrast);
    document.body.classList.toggle("ui-density-compact", compactDensity);
    updateSettingsControls(highContrast, compactDensity);
}

function updateSettingsControls(highContrast = getStoredUiPreference("rcUiHighContrast", true), compactDensity = getStoredUiPreference("rcUiCompactDensity", false)) {
    const contrastBtn = document.getElementById("settingsContrastToggle");
    const compactBtn = document.getElementById("settingsCompactToggle");
    const navThemeBtn = document.querySelector(".nav-theme-btn");

    if (contrastBtn) {
        contrastBtn.innerHTML = `<i class="fas fa-circle-half-stroke"></i> ${highContrast ? "Выключить" : "Включить"}`;
        contrastBtn.classList.toggle("is-active", highContrast);
    }

    if (compactBtn) {
        compactBtn.innerHTML = `<i class="fas fa-compress"></i> ${compactDensity ? "Выключить" : "Включить"}`;
        compactBtn.classList.toggle("is-active", compactDensity);
    }

    navThemeBtn?.classList.toggle("is-active", highContrast);
}

function toggleHighContrastMode() {
    const next = !getStoredUiPreference("rcUiHighContrast", true);
    setStoredUiPreference("rcUiHighContrast", next);
    applyUiPreferences();
    showNotification(next ? "Повышенный контраст включён" : "Повышенный контраст выключен");
}

function toggleCompactDensity() {
    const next = !getStoredUiPreference("rcUiCompactDensity", false);
    setStoredUiPreference("rcUiCompactDensity", next);
    applyUiPreferences();
    showNotification(next ? "Компактный режим включён" : "Компактный режим выключен");
}

function toggleThemePlaceholder() {
    toggleHighContrastMode();
}

function initSettingsPage() {
    applyUiPreferences();
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
    applyUiPreferences();

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

    if (document.getElementById("settingsPage")) {
        safeCall("initSettingsPage");
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