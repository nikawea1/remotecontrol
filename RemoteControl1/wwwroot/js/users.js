// Файл: RemoteControl1/wwwroot/js/users.js

let manualTimeRequests = Array.isArray(window.manualTimeRequests) ? window.manualTimeRequests : [];
let expandedManualRequestId = 0;
const expandedAdminTableRows = {
    employees: 0,
    workload: 0,
    productivity: 0,
    salary: 0,
    bonuses: 0
};

function showAdminTab(tabName, btn) {
    if (currentUserRole !== "admin" && (tabName === "salary" || tabName === "bonuses")) {
        showNotification("Нет доступа");
        return;
    }

    document.querySelectorAll(".admin-tab-content").forEach(x => x.classList.add("hidden"));
    document.querySelectorAll(".admin-tab-btn").forEach(x => x.classList.remove("active"));

    const map = {
        employees: "adminEmployeesTab",
        workload: "adminWorkloadTab",
        productivity: "adminProductivityTab",
        salary: "adminSalaryTab",
        bonuses: "adminBonusesTab",
        control: "adminControlTab"
    };

    const target = document.getElementById(map[tabName]);
    if (target) {
        target.classList.remove("hidden");
    }

    if (btn) {
        btn.classList.add("active");
    }

    renderAdminSection(tabName);
}

function renderAdminSection(tabName) {
    renderAdminStats();

    if (tabName === "employees") {
        renderUsersTable();
        return;
    }

    if (tabName === "workload") {
        renderWorkloadTable();
        return;
    }

    if (tabName === "productivity") {
        renderProductivityTable();
        return;
    }

    if (currentUserRole === "admin" && tabName === "salary") {
        renderSalaryTable();
        return;
    }

    if (currentUserRole === "admin" && tabName === "bonuses") {
        renderBonusesTable();
        return;
    }

    if (tabName === "control") {
        renderControlTab();
    }
}

function renderAdminStats() {
    const total = users.length;
    const active = users.filter(x => x.status === "active").length;
    const managers = users.filter(x => x.role === "manager").length;
    const admins = users.filter(x => x.role === "admin").length;

    const avgRate = total > 0
        ? Math.round(users.reduce((sum, x) => sum + Number(x.hourlyRate || 0), 0) / total)
        : 0;

    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    };

    set("adminEmployeesTotal", total);
    set("adminEmployeesActive", active);
    set("adminManagersCount", managers);
    set("adminAdminsCount", admins);
    set("adminAverageRate", avgRate.toLocaleString("ru-RU"));
}

function getFilteredUsers() {
    const search = (document.getElementById("employeeSearch")?.value || "").toLowerCase();
    const role = document.getElementById("employeeRoleFilter")?.value || "all";
    const status = document.getElementById("employeeStatusFilter")?.value || "all";

    return users.filter(u => {
        const textMatch =
            (u.fullName || "").toLowerCase().includes(search) ||
            (u.login || "").toLowerCase().includes(search) ||
            (u.email || "").toLowerCase().includes(search);

        const roleMatch = role === "all" || u.role === role;
        const statusMatch = status === "all" || u.status === status;

        return textMatch && roleMatch && statusMatch;
    });
}

function escapeUserText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getCompactUserName(user) {
    const fullName = String(user?.fullName || user?.login || `ID ${user?.id || ""}`).trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    return parts.length > 2 ? `${parts[0]} ${parts[1]}` : fullName;
}

function getUserTooltip(user) {
    return [
        `ID: ${user?.id ?? "-"}`,
        `ФИО: ${user?.fullName || "-"}`,
        `Логин: ${user?.login || "-"}`,
        `Email: ${user?.email || "-"}`,
        `Должность: ${user?.position || "-"}`
    ].join("\n");
}

function renderUserIdCell(user) {
    const id = String(user?.id ?? "-");
    return `<span class="admin-user-id" title="ID ${escapeUserText(id)}">${escapeUserText(id)}</span>`;
}

function renderUserNameCell(user) {
    const email = user?.email || "";
    const tooltip = escapeUserText(getUserTooltip(user));
    return `
        <div class="admin-user-cell" title="${tooltip}">
            <strong class="admin-user-name">${escapeUserText(getCompactUserName(user))}</strong>
            ${email ? `<span class="admin-user-email">${escapeUserText(email)}</span>` : ""}
        </div>
    `;
}

function renderTableExpandPill(text) {
    if (!String(text || "").trim()) {
        return "";
    }

    return `<span class="table-expand-pill">${escapeUserText(text)}</span>`;
}

function renderTableExpandMeta(parts) {
    const items = parts.filter(part => String(part || "").trim());
    if (!items.length) {
        return "";
    }

    return `
        <div class="table-expand-subtitle">
            ${items.map(item => `<span>${escapeUserText(item)}</span>`).join("")}
        </div>
    `;
}

function renderTableExpandStat(label, value, options = {}) {
    const { html = false } = options;
    const content = html ? value : escapeUserText(value || "—");

    return `
        <div class="table-expand-stat">
            <span class="table-expand-stat-label">${escapeUserText(label)}</span>
            <div class="table-expand-stat-value">${content}</div>
        </div>
    `;
}

function renderTableExpandItem(label, value, options = {}) {
    const { html = false } = options;
    const content = html ? value : escapeUserText(value || "—");

    return `
        <div class="table-expand-item">
            <span class="table-expand-item-label">${escapeUserText(label)}</span>
            <div class="table-expand-item-value">${content}</div>
        </div>
    `;
}

function renderTableExpandSection(title, content, options = {}) {
    const { wide = false } = options;
    return `
        <section class="table-expand-section${wide ? " is-wide" : ""}">
            <div class="table-expand-section-title">${escapeUserText(title)}</div>
            <div class="table-expand-list">
                ${content}
            </div>
        </section>
    `;
}

function renderTableExpandNote(title, value, options = {}) {
    const { html = false, wide = false, muted = false } = options;
    const content = html ? value : escapeUserText(value || "—");

    return `
        <div class="table-expand-note${wide ? " is-wide" : ""}${muted ? " is-muted" : ""}">
            <span class="table-expand-note-title">${escapeUserText(title)}</span>
            <div class="table-expand-note-body">${content}</div>
        </div>
    `;
}

function getExpandedAdminTableRowId(tableKey) {
    return Number(expandedAdminTableRows[tableKey] || 0);
}

function rerenderAdminTable(tableKey) {
    switch (tableKey) {
        case "employees":
            renderUsersTable();
            break;
        case "workload":
            renderWorkloadTable();
            break;
        case "productivity":
            renderProductivityTable();
            break;
        case "salary":
            renderSalaryTable();
            break;
        case "bonuses":
            renderBonusesTable();
            break;
        default:
            break;
    }
}

function getProductivityStateView(state) {
    if (state === "overloaded") {
        return { text: "Перегружен", badge: "badge-danger" };
    }

    if (state === "underloaded") {
        return { text: "Недогружен", badge: "badge-warning" };
    }

    if (state === "no_data") {
        return { text: "Нет данных", badge: "badge-info" };
    }

    return { text: "Норма", badge: "badge-success" };
}

function renderAdminExpandedRow(tableKey, colSpan, user) {
    const fullName = user?.fullName || user?.login || "—";
    const workModeText = user?.workMode === "fixed" ? "Фиксированный" : "Гибкий";
    const diffText = `${Number(user?.workloadDiff || 0) >= 0 ? "+" : ""}${Number(user?.workloadDiff || 0).toFixed(1)} ч`;
    const trackedHoursText = `${Number(user?.trackedHours || 0).toFixed(1)} ч`;
    const plannedHoursText = `${Number(user?.plannedHours || 0).toFixed(1)} ч`;
    const workDayText = `${Number(user?.workDayHours || 0).toFixed(1)} ч`;
    const idleHoursText = `${Number(user?.idleHours || 0).toFixed(1)} ч`;
    const completionText = `${Number(user?.completionPercent || 0).toFixed(0)}%`;
    const metaMarkup = renderTableExpandMeta([
        user?.email || "",
        user?.position || ""
    ]);
    const basePills = [renderTableExpandPill(`ID ${user?.id || "—"}`)];
    let kicker = "Сотрудник";
    let badges = [];
    let stats = [];
    let sections = [];

    switch (tableKey) {
        case "employees":
            kicker = "Профиль сотрудника";
            badges = [
                ...basePills,
                getRoleBadge(user?.role),
                getUserStatusBadge(user?.status)
            ];
            stats = [
                renderTableExpandStat("Учтено", trackedHoursText),
                renderTableExpandStat("Норма", `${Number(user?.requiredDailyHours || 0).toFixed(1)} ч`),
                renderTableExpandStat("В работе", String(user?.tasksInProgress ?? 0))
            ];
            sections = [
                renderTableExpandSection("Рабочий профиль", [
                    renderTableExpandItem("Логин", user?.login || "—"),
                    renderTableExpandItem("Email", user?.email || "—"),
                    renderTableExpandItem("Телефон", user?.phone || "—"),
                    renderTableExpandItem("Режим", workModeText)
                ].join("")),
                renderTableExpandSection("Сегодня", [
                    renderTableExpandItem("Активные задачи", String(user?.tasksInProgress ?? 0)),
                    renderTableExpandItem("Завершено", String(user?.completedTasks ?? 0)),
                    renderTableExpandItem("Просрочено", String(user?.overdueTasks ?? 0)),
                    renderTableExpandItem("Учтено сегодня", trackedHoursText)
                ].join(""))
            ];
            break;
        case "workload": {
            kicker = "Рабочая нагрузка";
            badges = [...basePills, renderTableExpandPill(workModeText)];
            stats = [
                renderTableExpandStat("Отклонение", diffText),
                renderTableExpandStat("План", plannedHoursText),
                renderTableExpandStat("Факт", trackedHoursText)
            ];
            sections = [
                renderTableExpandSection("План и факт", [
                    renderTableExpandItem("Логин", user?.login || "—"),
                    renderTableExpandItem("План по задачам", plannedHoursText),
                    renderTableExpandItem("Факт по задачам", trackedHoursText),
                    renderTableExpandItem("Рабочий день", workDayText)
                ].join("")),
                renderTableExpandSection("Баланс дня", [
                    renderTableExpandItem("Отклонение от плана", diffText),
                    renderTableExpandItem("Простой", idleHoursText),
                    renderTableExpandItem("Норма", `${Number(user?.requiredDailyHours || 0).toFixed(1)} ч`),
                    renderTableExpandItem("Режим", workModeText)
                ].join(""))
            ];
            break;
        }
        case "productivity": {
            const stateView = getProductivityStateView(user?.productivityState);
            kicker = "Рабочий результат";
            badges = [
                ...basePills,
                `<span class="badge ${stateView.badge}">${escapeUserText(stateView.text)}</span>`
            ];
            stats = [
                renderTableExpandStat("Индекс", completionText),
                renderTableExpandStat("Факт", trackedHoursText),
                renderTableExpandStat("Рабочий день", workDayText)
            ];
            sections = [
                renderTableExpandSection("Рабочие показатели", [
                    renderTableExpandItem("Логин", user?.login || "—"),
                    renderTableExpandItem("Режим", workModeText),
                    renderTableExpandItem("Простой", idleHoursText),
                    renderTableExpandItem("Учтено", trackedHoursText)
                ].join("")),
                renderTableExpandSection("Результат", [
                    renderTableExpandItem("Индекс выполнения", completionText),
                    renderTableExpandItem("Активные задачи", String(user?.tasksInProgress ?? 0)),
                    renderTableExpandItem("Завершено", String(user?.completedTasks ?? 0)),
                    renderTableExpandItem("Ставка", `${Number(user?.hourlyRate || 0).toLocaleString("ru-RU")} руб.`)
                ].join(""))
            ];
            break;
        }
        case "salary": {
            const salaryHours = Number(user?.salaryHours || 0);
            const rate = Number(user?.hourlyRate || 0);
            const salary = salaryHours * rate;
            kicker = "Расчёт оплаты";
            badges = [...basePills, renderTableExpandPill(workModeText)];
            stats = [
                renderTableExpandStat("Итого", `${salary.toLocaleString("ru-RU")} руб.`),
                renderTableExpandStat("Ставка", `${rate.toLocaleString("ru-RU")} руб.`),
                renderTableExpandStat("Учтено", `${salaryHours.toFixed(1)} ч`)
            ];
            sections = [
                renderTableExpandSection("Данные для расчёта", [
                    renderTableExpandItem("Логин", user?.login || "—"),
                    renderTableExpandItem("Учтено часов", `${salaryHours.toFixed(1)} ч`),
                    renderTableExpandItem("Ставка", `${rate.toLocaleString("ru-RU")} руб.`),
                    renderTableExpandItem("Норма", `${Number(user?.requiredDailyHours || 0).toFixed(1)} ч`)
                ].join("")),
                renderTableExpandSection("Итог", [
                    renderTableExpandItem("Сумма к выплате", `${salary.toLocaleString("ru-RU")} руб.`),
                    renderTableExpandItem("Рабочее время", workDayText),
                    renderTableExpandItem("Простой", idleHoursText),
                    renderTableExpandItem("Режим", workModeText)
                ].join(""))
            ];
            break;
        }
        case "bonuses": {
            const bonusPercent = Number(user?.bonusPercent || 0);
            const statusText = bonusPercent > 0 ? `Бонус ${bonusPercent}%` : "Без бонуса";
            const badgeClass = bonusPercent >= 10 ? "badge-success" : bonusPercent > 0 ? "badge-warning" : "badge-info";
            const bonusReason = user?.bonusReason || "Бонус не назначен";
            kicker = "Бонусы";
            badges = [
                ...basePills,
                `<span class="badge ${badgeClass}">${escapeUserText(statusText)}</span>`
            ];
            stats = [
                renderTableExpandStat("Бонус", `${Number(user?.bonusAmount || 0).toLocaleString("ru-RU")} руб.`),
                renderTableExpandStat("Выполнение", completionText),
                renderTableExpandStat("Отклонение", diffText)
            ];
            sections = [
                renderTableExpandSection("Основание для бонуса", [
                    renderTableExpandItem("Логин", user?.login || "—"),
                    renderTableExpandItem("Выполнение", completionText),
                    renderTableExpandItem("Отклонение", diffText),
                    renderTableExpandItem("Факт часов", trackedHoursText)
                ].join("")),
                renderTableExpandSection("Комментарий менеджера", [
                    renderTableExpandItem("Примечание", bonusReason),
                    renderTableExpandItem("Норма", `${Number(user?.requiredDailyHours || 0).toFixed(1)} ч`),
                    renderTableExpandItem("Ставка", `${Number(user?.hourlyRate || 0).toLocaleString("ru-RU")} руб.`),
                    renderTableExpandItem("Режим", workModeText),
                    renderTableExpandItem("Размер бонуса", `${Number(user?.bonusAmount || 0).toLocaleString("ru-RU")} руб.`)
                ].join(""))
            ];
            break;
        }
        default:
            return "";
    }

    return `
        <tr class="table-expand-row admin-table-expand-row">
            <td colspan="${colSpan}">
                <div class="table-expand-stage" data-expand-stage data-enter="true">
                    <div class="table-expand-shell admin-expand-shell">
                        <div class="admin-expand-head">
                            <div class="table-expand-identity admin-expand-copy">
                                <span class="table-expand-kicker">${escapeUserText(kicker)}</span>
                                <div class="table-expand-title-row">
                                    <h4 class="table-expand-title">${escapeUserText(fullName)}</h4>
                                </div>
                                ${metaMarkup}
                            </div>
                            <div class="table-expand-badges admin-expand-badges">
                                ${badges.join("")}
                            </div>
                        </div>

                        <div class="table-expand-stats admin-expand-stats">
                            ${stats.join("")}
                        </div>

                        <div class="table-expand-content admin-expand-content">
                            ${sections.join("")}
                        </div>

                        <div class="table-expand-actions admin-expand-actions">
                            <button class="btn btn-outline" type="button" onclick="showUserDetails(${user.id})">
                                <i class="fas fa-id-card"></i>
                                <span>Открыть карточку сотрудника</span>
                            </button>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function playUsersExpandStageEnter(root) {
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

function collapseUsersExpandStage(stage, onDone) {
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

function parseManualRequestDateValue(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);

    if (!match) {
        return null;
    }

    const [, dd, mm, yyyy, hh = "00", min = "00"] = match;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
}

function getManualRequestDateParts(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return { date: "—", time: "" };
    }

    const [datePart, timePart = ""] = raw.split(/\s+/);
    return {
        date: datePart || "—",
        time: timePart
    };
}

function getManualRequestStatusText(status) {
    switch (String(status || "").toLowerCase()) {
        case "approved":
            return "Одобрено";
        case "rejected":
            return "Отклонено";
        case "needs_revision":
            return "На доработке";
        default:
            return "Ожидание";
    }
}

function getManualRequestStatusOrder(status) {
    switch (String(status || "").toLowerCase()) {
        case "pending":
            return 1;
        case "needs_revision":
            return 2;
        case "approved":
            return 3;
        case "rejected":
            return 4;
        default:
            return 9;
    }
}

function refreshManualRequestFilters() {
    const projectFilter = document.getElementById("manualRequestProjectFilter");
    const reasonFilter = document.getElementById("manualRequestReasonFilter");

    if (projectFilter) {
        const current = projectFilter.value || "all";
        const options = [...new Set(
            manualTimeRequests
                .map(x => String(x.projectName || "").trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "ru"));

        projectFilter.innerHTML = `
            <option value="all">Все проекты</option>
            ${options.map(name => `<option value="${escapeUserText(name)}">${escapeUserText(name)}</option>`).join("")}
        `;

        projectFilter.value = options.includes(current) ? current : "all";
    }

    if (reasonFilter) {
        const current = reasonFilter.value || "all";
        const options = [...new Set(
            manualTimeRequests
                .map(x => String(x.reason || "").trim().toLowerCase())
                .filter(Boolean)
        )].sort((a, b) => getManualRequestReasonText(a).localeCompare(getManualRequestReasonText(b), "ru"));

        reasonFilter.innerHTML = `
            <option value="all">Все причины</option>
            ${options.map(value => `<option value="${escapeUserText(value)}">${escapeUserText(getManualRequestReasonText(value))}</option>`).join("")}
        `;

        reasonFilter.value = options.includes(current) ? current : "all";
    }
}

function resetManualRequestFilters() {
    const search = document.getElementById("manualRequestSearch");
    const status = document.getElementById("manualRequestStatusFilter");
    const reason = document.getElementById("manualRequestReasonFilter");
    const project = document.getElementById("manualRequestProjectFilter");
    const sort = document.getElementById("manualRequestSortFilter");

    if (search) search.value = "";
    if (status) status.value = "all";
    if (reason) reason.value = "all";
    if (project) project.value = "all";
    if (sort) sort.value = "newest";

    renderManualTimeRequests();
}

function getFilteredManualTimeRequests() {
    const search = String(document.getElementById("manualRequestSearch")?.value || "").trim().toLowerCase();
    const status = document.getElementById("manualRequestStatusFilter")?.value || "all";
    const reason = document.getElementById("manualRequestReasonFilter")?.value || "all";
    const project = document.getElementById("manualRequestProjectFilter")?.value || "all";
    const sort = document.getElementById("manualRequestSortFilter")?.value || "newest";

    const filtered = manualTimeRequests.filter(item => {
        const statusMatch = status === "all" || String(item.status || "").toLowerCase() === status;
        const reasonMatch = reason === "all" || String(item.reason || "").toLowerCase() === reason;
        const projectMatch = project === "all" || String(item.projectName || "") === project;
        const text = [
            item.employee,
            item.taskName,
            item.projectName,
            item.comment,
            getManualRequestReasonText(item.reason),
            item.status
        ].join(" ").toLowerCase();
        const searchMatch = !search || text.includes(search);

        return statusMatch && reasonMatch && projectMatch && searchMatch;
    });

    filtered.sort((a, b) => {
        if (sort === "oldest" || sort === "newest") {
            const aTime = parseManualRequestDateValue(a.createdAt)?.getTime() || 0;
            const bTime = parseManualRequestDateValue(b.createdAt)?.getTime() || 0;
            return sort === "oldest" ? aTime - bTime : bTime - aTime;
        }

        if (sort === "hours_asc" || sort === "hours_desc") {
            const diff = Number(a.hours || 0) - Number(b.hours || 0);
            return sort === "hours_asc" ? diff : -diff;
        }

        if (sort === "status") {
            const statusDiff = getManualRequestStatusOrder(a.status) - getManualRequestStatusOrder(b.status);
            if (statusDiff !== 0) {
                return statusDiff;
            }
        }

        return (parseManualRequestDateValue(b.createdAt)?.getTime() || 0) - (parseManualRequestDateValue(a.createdAt)?.getTime() || 0);
    });

    return filtered;
}

function getAdminTableBodyId(tableKey) {
    const bodyIdMap = {
        employees: "usersTableBody",
        workload: "workloadTableBody",
        productivity: "productivityTableBody",
        salary: "salaryTableBody",
        bonuses: "bonusesTableBody"
    };

    return bodyIdMap[tableKey] || "";
}

function getAdminTableColSpan(tableKey) {
    const colSpanMap = {
        employees: 10,
        workload: 10,
        productivity: 7,
        salary: 7,
        bonuses: 9
    };

    return colSpanMap[tableKey] || 1;
}

function mountAdminExpandedRow(targetRow, tableKey, rowId) {
    const user = users.find(x => Number(x.id) === Number(rowId));
    if (!user || !targetRow) {
        expandedAdminTableRows[tableKey] = 0;
        return;
    }

    expandedAdminTableRows[tableKey] = Number(rowId);
    targetRow.classList.add("is-selected");
    targetRow.insertAdjacentHTML("afterend", renderAdminExpandedRow(tableKey, getAdminTableColSpan(tableKey), user));
    playUsersExpandStageEnter(targetRow.parentElement);
}

function selectAdminTableRow(event, tableKey, rowId) {
    if (!rowId || !tableKey) return;

    const target = event?.target;
    if (target?.closest?.("button, a, input, select, textarea, .table-actions")) {
        return;
    }

    const nextId = Number(rowId);
    const body = document.getElementById(getAdminTableBodyId(tableKey));
    const nextRow = target?.closest?.(".admin-table-row");
    const currentExpandRow = body?.querySelector?.(".table-expand-row");
    const currentStage = currentExpandRow?.querySelector?.("[data-expand-stage]");
    const currentSelectedRow = body?.querySelector?.(".admin-table-row.is-selected");

    if (!body || !nextRow) {
        return;
    }

    if (getExpandedAdminTableRowId(tableKey) === nextId && currentStage) {
        collapseUsersExpandStage(currentStage, () => {
            currentExpandRow?.remove();
            currentSelectedRow?.classList.remove("is-selected");
            expandedAdminTableRows[tableKey] = 0;
        });
        return;
    }

    if (currentStage) {
        collapseUsersExpandStage(currentStage, () => {
            currentExpandRow?.remove();
            currentSelectedRow?.classList.remove("is-selected");
            mountAdminExpandedRow(nextRow, tableKey, nextId);
        });
        return;
    }

    mountAdminExpandedRow(nextRow, tableKey, nextId);
}

function enhanceAdminTables() {
    document.querySelectorAll("#usersPage .table th, #usersPage .table td").forEach(cell => {
        if (cell.closest(".manual-request-expanded-row") || cell.closest(".table-expand-row")) return;
        if (cell.title) return;

        const text = cell.textContent?.trim();
        if (text) {
            cell.title = text;
        }
    });
}

function clearEmployeeSearchAutofill() {
    const input = document.getElementById("employeeSearch");
    if (!input) return;

    if (input.dataset.userTouched === "1") {
        return;
    }

    const login = String(window.currentUserLogin || "").trim().toLowerCase();
    const value = String(input.value || "").trim().toLowerCase();

    if (value && login && value === login) {
        input.value = "";
        input.setAttribute("value", "");
        renderUsersTable();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const employeeSearch = document.getElementById("employeeSearch");
    if (!employeeSearch) return;

    employeeSearch.setAttribute("autocomplete", "off");
    employeeSearch.setAttribute("value", "");
    employeeSearch.dataset.userTouched = "0";

    ["input", "keydown", "paste"].forEach(eventName => {
        employeeSearch.addEventListener(eventName, () => {
            employeeSearch.dataset.userTouched = "1";
        });
    });

    [50, 300, 1000].forEach(delay => {
        window.setTimeout(clearEmployeeSearchAutofill, delay);
    });
});

function renderUsersTable() {
    const body = document.getElementById("usersTableBody");
    if (!body) return;

    clearEmployeeSearchAutofill();

    const data = getFilteredUsers();
    if (getExpandedAdminTableRowId("employees") && !data.some(u => Number(u.id) === getExpandedAdminTableRowId("employees"))) {
        expandedAdminTableRows.employees = 0;
    }

    if (!data.length) {
        body.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; color: var(--gray);">Сотрудники не найдены</td>
            </tr>
        `;
        enhanceAdminTables();
        return;
    }

    const isAdminUser = currentUserRole === "admin";

    body.innerHTML = data.map(u => {
        const isExpanded = getExpandedAdminTableRowId("employees") === Number(u.id);
        return `
            <tr class="admin-table-row ${isExpanded ? "is-selected" : ""}" onclick="selectAdminTableRow(event, 'employees', ${u.id})">
                <td>${renderUserIdCell(u)}</td>
                <td>${renderUserNameCell(u)}</td>
                <td title="${escapeUserText(u.login || "-")}">${escapeUserText(u.login || "-")}</td>
                <td title="${escapeUserText(u.position || "-")}">${escapeUserText(u.position || "-")}</td>
                <td>${getRoleBadge(u.role)}</td>
                <td>${Number(u.hourlyRate || 0).toLocaleString("ru-RU")} руб.</td>
                <td>${u.tasksInProgress}</td>
                <td>${Number(u.trackedHours || 0).toFixed(1)}</td>
                <td>${getUserStatusBadge(u.status)}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-sm btn-outline" type="button" onclick="showUserDetails(${u.id})" title="Карточка">
                            <i class="fas fa-id-card"></i>
                        </button>

                        ${isAdminUser ? `
                            <button class="btn btn-sm btn-outline" type="button" onclick="editUser(${u.id})" title="Редактировать">
                                <i class="fas fa-pen-to-square"></i>
                            </button>
                            <button class="btn btn-sm ${u.status === "active" ? "btn-danger" : "btn-success"}" type="button" onclick="toggleUserStatus(${u.id})" title="Статус">
                                <i class="fas ${u.status === "active" ? "fa-user-lock" : "fa-user-check"}"></i>
                            </button>
                        ` : ``}
                    </div>
                </td>
            </tr>
            ${isExpanded ? renderAdminExpandedRow("employees", 10, u) : ""}
        `;
    }).join("");

    playUsersExpandStageEnter(body);
    enhanceAdminTables();
}

function renderWorkloadTable() {
    const body = document.getElementById("workloadTableBody");
    if (!body) return;

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; color: var(--gray);">Нет данных</td>
            </tr>
        `;
        enhanceAdminTables();
        return;
    }

    body.innerHTML = users.map(u => {
        const isExpanded = getExpandedAdminTableRowId("workload") === Number(u.id);
        return `
            <tr class="admin-table-row ${isExpanded ? "is-selected" : ""}" onclick="selectAdminTableRow(event, 'workload', ${u.id})">
                <td>${renderUserIdCell(u)}</td>
                <td>${renderUserNameCell(u)}</td>
                <td>${u.tasksInProgress}</td>
                <td>${u.completedTasks}</td>
                <td>${u.overdueTasks}</td>
                <td>${Number(u.plannedHours || 0).toFixed(1)}</td>
                <td>${Number(u.trackedHours || 0).toFixed(1)}</td>
                <td>${Number(u.workDayHours || 0).toFixed(1)}</td>
                <td>${Number(u.idleHours || 0).toFixed(1)}</td>
                <td>${Number(u.workloadDiff || 0) >= 0 ? "+" : ""}${Number(u.workloadDiff || 0).toFixed(1)}</td>
            </tr>
            ${isExpanded ? renderAdminExpandedRow("workload", 10, u) : ""}
        `;
    }).join("");

    playUsersExpandStageEnter(body);
    enhanceAdminTables();
}

function renderProductivityTable() {
    const body = document.getElementById("productivityTableBody");
    if (!body) return;

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color: var(--gray);">Нет данных</td>
            </tr>
        `;
        enhanceAdminTables();
        return;
    }

    body.innerHTML = users.map(u => {
        const stateView = getProductivityStateView(u.productivityState);
        const index = Number(u.completionPercent || 0);
        const isExpanded = getExpandedAdminTableRowId("productivity") === Number(u.id);

        return `
              <tr class="admin-table-row ${isExpanded ? "is-selected" : ""}" onclick="selectAdminTableRow(event, 'productivity', ${u.id})">
                  <td>${renderUserIdCell(u)}</td>
                <td>${renderUserNameCell(u)}</td>
                  <td>${Number(u.trackedHours || 0).toFixed(1)}</td>
                  <td>${u.tasksInProgress}</td>
                  <td>${u.completedTasks}</td>
                  <td>${index.toFixed(0)}%</td>
                  <td><span class="badge ${stateView.badge}">${stateView.text}</span></td>
              </tr>
              ${isExpanded ? renderAdminExpandedRow("productivity", 7, u) : ""}
          `;
    }).join("");

    playUsersExpandStageEnter(body);
    enhanceAdminTables();
}

function renderSalaryTable() {
    const body = document.getElementById("salaryTableBody");
    if (!body) return;

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color: var(--gray);">Нет данных</td>
            </tr>
        `;
        enhanceAdminTables();
        return;
    }

    body.innerHTML = users.map(u => {
        const salaryHours = Number(u.salaryHours || 0);
        const workDayHours = Number(u.workDayHours || 0);
        const idleHours = Number(u.idleHours || 0);
        const rate = Number(u.hourlyRate || 0);
        const salary = salaryHours * rate;
        const isExpanded = getExpandedAdminTableRowId("salary") === Number(u.id);

        return `
            <tr class="admin-table-row ${isExpanded ? "is-selected" : ""}" onclick="selectAdminTableRow(event, 'salary', ${u.id})">
                <td>${renderUserIdCell(u)}</td>
                <td>${renderUserNameCell(u)}</td>
                <td>${salaryHours.toFixed(1)}</td>
                <td>${workDayHours.toFixed(1)}</td>
                <td>${idleHours.toFixed(1)}</td>
                <td>${rate.toLocaleString("ru-RU")}</td>
                <td><strong>${salary.toLocaleString("ru-RU")}</strong></td>
            </tr>
            ${isExpanded ? renderAdminExpandedRow("salary", 7, u) : ""}
        `;
    }).join("");

    playUsersExpandStageEnter(body);
    enhanceAdminTables();
}

function renderBonusesTable() {
    const body = document.getElementById("bonusesTableBody");
    if (!body) return;

    if (!users.length) {
        body.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; color: var(--gray);">Нет данных</td>
            </tr>
        `;
        enhanceAdminTables();
        return;
    }

    body.innerHTML = users.map(u => {
        const planned = Number(u.plannedHours || 0);
        const tracked = Number(u.trackedHours || 0);
        const diff = Number(u.workloadDiff || 0);
        const percent = Number(u.completionPercent || 0);
        const bonusPercent = Number(u.bonusPercent || 0);
        const bonusAmount = Number(u.bonusAmount || 0);
        const reason = String(u.bonusReason || "").trim();
        const statusText = bonusPercent > 0
            ? `Бонус ${bonusPercent}%`
            : "Без бонуса";
        const badgeClass = bonusPercent >= 10
            ? "badge-success"
            : bonusPercent > 0
                ? "badge-warning"
                : "badge-info";
        const isExpanded = getExpandedAdminTableRowId("bonuses") === Number(u.id);

        return `
              <tr class="admin-table-row ${isExpanded ? "is-selected" : ""}" onclick="selectAdminTableRow(event, 'bonuses', ${u.id})">
                  <td>${renderUserIdCell(u)}</td>
                  <td>${renderUserNameCell(u)}</td>
                  <td>${planned.toFixed(1)}</td>
                  <td>${tracked.toFixed(1)}</td>
                  <td>${percent.toFixed(0)}%</td>
                  <td>${diff >= 0 ? "+" : ""}${diff.toFixed(1)}</td>
                  <td><span class="badge ${badgeClass}">${escapeUserText(statusText)}</span></td>
                  <td class="bonus-reason-cell" title="${escapeUserText(reason || "Бонус не назначен")}">${escapeUserText(reason || "Бонус не назначен")}</td>
                  <td class="bonus-amount-cell">${bonusAmount > 0 ? `${bonusAmount.toLocaleString("ru-RU")} руб.` : "0 руб."}</td>
              </tr>
              ${isExpanded ? renderAdminExpandedRow("bonuses", 9, u) : ""}
          `;
    }).join("");

    playUsersExpandStageEnter(body);
    enhanceAdminTables();
}

function renderControlTab() {
    const overloaded = users.filter(u => u.productivityState === "overloaded");
    const underloaded = users.filter(u => u.productivityState === "underloaded");
    const noActivity = users.filter(u =>
        Number(u.trackedHours || 0) <= 0 &&
        (Number(u.tasksInProgress || 0) > 0 || Number(u.plannedHours || 0) > 0 || Number(u.workDayHours || 0) > 0));
    const highIdle = users.filter(u =>
        Number(u.workDayHours || 0) > 0 &&
        Number(u.idleHours || 0) >= 2);

    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    };

    set("controlOverloaded", overloaded.length);
    set("controlUnderloaded", underloaded.length);
    set("controlNoActivity", noActivity.length);
    set("controlHighIdle", highIdle.length);

    const controlList = document.getElementById("controlList");
    if (!controlList) return;

    const healthy = users.filter(u =>
        u.status === "active" &&
        !overloaded.includes(u) &&
        !underloaded.includes(u) &&
        !highIdle.includes(u) &&
        !noActivity.includes(u));

    const groups = [
        {
            id: "overloaded",
            icon: "fa-triangle-exclamation",
            title: "Перегруженные",
            hint: "Много активных задач или часов по задачам",
            tone: "danger",
            users: overloaded,
            details: x => `Активных задач: ${Number(x.tasksInProgress || 0)} · часы: ${Number(x.trackedHours || 0).toFixed(1)}`
        },
        {
            id: "underloaded",
            icon: "fa-hourglass-half",
            title: "Недогруженные",
            hint: "Факт ниже плановой нагрузки",
            tone: "warning",
            users: underloaded,
            details: x => `Факт: ${Number(x.trackedHours || 0).toFixed(1)} ч · план: ${Number(x.plannedHours || 0).toFixed(1)} ч`
        },
        {
            id: "idle",
            icon: "fa-circle-pause",
            title: "Высокий простой",
            hint: "Много рабочего времени без задач",
            tone: "warning",
            users: highIdle,
            details: x => `Простой: ${Number(x.idleHours || 0).toFixed(1)} ч · рабочий день: ${Number(x.workDayHours || 0).toFixed(1)} ч`
        },
        {
            id: "noActivity",
            icon: "fa-user-slash",
            title: "Без активности",
            hint: "Есть план или задачи, но нет списанных часов",
            tone: "info",
            users: noActivity,
            details: x => `Активных задач: ${Number(x.tasksInProgress || 0)} · план: ${Number(x.plannedHours || 0).toFixed(1)} ч`
        },
        {
            id: "stable",
            icon: "fa-circle-check",
            title: "Без критичных отклонений",
            hint: "Активные сотрудники без явных проблем по нагрузке",
            tone: "success",
            users: healthy,
            details: x => `Активных задач: ${Number(x.tasksInProgress || 0)} · часы: ${Number(x.trackedHours || 0).toFixed(1)}`
        }
    ];

    const current = document.getElementById("controlIssueFilter")?.value;
    const selected = groups.find(x => x.id === current) || groups.find(x => x.users.length) || groups[0];
    const visible = selected.users.slice(0, 6);
    const hidden = selected.users.slice(6);

    const renderRow = user => `
        <div class="control-issue-row">
            <div class="control-issue-person">
                <strong>${escapeUserText(user.fullName || user.login || "Сотрудник")}</strong>
                <span>${escapeUserText(selected.details(user))}</span>
            </div>
            <span class="control-issue-role">${escapeUserText(getRoleText(user.role || "employee"))}</span>
        </div>
    `;

    controlList.innerHTML = `
        <div class="control-issues-panel">
            <div class="control-issues-toolbar">
                <div class="control-issues-heading">
                    <span class="control-issues-icon control-issues-${selected.tone}">
                        <i class="fas ${selected.icon}"></i>
                    </span>
                    <div>
                        <strong>${escapeUserText(selected.title)}</strong>
                        <span>${escapeUserText(selected.hint)}</span>
                    </div>
                </div>
                <select class="filter-select control-issues-select" id="controlIssueFilter" onchange="renderControlTab()">
                    ${groups.map(group => `
                        <option value="${group.id}" ${group.id === selected.id ? "selected" : ""}>
                            ${group.title} (${group.users.length})
                        </option>
                    `).join("")}
                </select>
            </div>
            <div class="control-issues-list">
                ${visible.length ? visible.map(renderRow).join("") : `<div class="control-issues-empty">Нет сотрудников в выбранной группе</div>`}
                ${hidden.length ? `
                    <details class="control-issues-more">
                        <summary>Показать ещё ${hidden.length}</summary>
                        <div class="control-issues-more-list">
                            ${hidden.map(renderRow).join("")}
                        </div>
                    </details>
                ` : ""}
            </div>
        </div>
    `;
}

function showUserDetails(id) {
    const user = users.find(x => x.id === id);
    if (!user) {
        showNotification("Сотрудник не найден");
        return;
    }

    const body = document.getElementById("userDetailsBody");
    if (!body) return;

    body.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">ФИО</label>
                <input class="form-control" value="${user.fullName}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">Логин</label>
                <input class="form-control" value="${user.login}" readonly>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-control" value="${user.email || ""}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">Телефон</label>
                <input class="form-control" value="${user.phone || ""}" readonly>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Должность</label>
                <input class="form-control" value="${user.position || ""}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">Роль</label>
                <input class="form-control" value="${getRoleText(user.role)}" readonly>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Ставка</label>
                <input class="form-control" value="${user.hourlyRate}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">Статус</label>
                <input class="form-control" value="${user.status === "active" ? "Активен" : "Заблокирован"}" readonly>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Вид работы</label>
                <input class="form-control" value="${user.workMode === "fixed" ? "Фиксированный" : "Гибкий"}" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">Норма часов</label>
                <input class="form-control" value="${Number(user.requiredDailyHours || 0).toFixed(1)}" readonly>
            </div>
        </div>

        ${user.workMode === "fixed" ? `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Начало</label>
                    <input class="form-control" value="${user.plannedStartTime || "-"}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Конец</label>
                    <input class="form-control" value="${user.plannedEndTime || "-"}" readonly>
                </div>
            </div>
        ` : ``}

        <div class="stats-grid" style="margin-top:14px; margin-bottom:0;">
            <div class="stat-card">
                <div class="stat-info">
                    <div class="stat-value">${user.tasksInProgress}</div>
                    <div class="stat-label">Активных задач</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-info">
                    <div class="stat-value">${user.completedTasks}</div>
                    <div class="stat-label">Выполнено задач</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-info">
                    <div class="stat-value">${Number(user.trackedHours || 0).toFixed(1)}</div>
                    <div class="stat-label">Часов по задачам</div>
                </div>
            </div>
        </div>
    `;

    openModal("userDetailsModal");
}

function openUserModal() {
    const title = document.getElementById("userModalTitle");
    const editId = document.getElementById("userEditId");
    const saveBtn = document.getElementById("saveUserBtn");

    if (title) title.textContent = "Новый сотрудник";
    if (editId) editId.value = "0";
    if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Сохранить';

    resetUserModalState();
    openModal("userModal");
}

function resetUserModalState() {
    [
        "userEditId",
        "uLastName",
        "uFirstName",
        "uMiddleName",
        "uLogin",
        "uPass",
        "uPass2",
        "uPosition",
        "uEmail",
        "uPhone",
        "uPlannedStartTime",
        "uPlannedEndTime",
        "editUserId",
        "editULastName",
        "editUFirstName",
        "editUMiddleName",
        "editULogin",
        "editUPass",
        "editUPosition",
        "editUEmail",
        "editUPhone",
        "editUPlannedStartTime",
        "editUPlannedEndTime"
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = "";
        }
    });

    const defaults = [
        ["uRate", 1500],
        ["uRole", "employee"],
        ["uStatus", "active"],
        ["uWorkMode", "fixed"],
        ["uRequiredDailyHours", 8],
        ["uPlannedStartTime", "09:00"],
        ["uPlannedEndTime", "18:00"],
        ["editURate", 1500],
        ["editURole", "employee"],
        ["editUStatus", "active"],
        ["editUWorkMode", "fixed"],
        ["editURequiredDailyHours", 8],
        ["editUPlannedStartTime", "09:00"],
        ["editUPlannedEndTime", "18:00"]
    ];

    defaults.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = value;
        }
    });

    toggleWorkModeFields("u");
    toggleWorkModeFields("editU");
}

function toggleWorkModeFields(prefix) {
    const mode = document.getElementById(`${prefix}WorkMode`)?.value || "fixed";
    const box = document.getElementById(`${prefix}FixedWorkFields`);
    if (!box) return;

    if (mode === "fixed") {
        box.classList.remove("hidden");
    } else {
        box.classList.add("hidden");
    }
}

async function saveUser() {
    const editId = Number(document.getElementById("userEditId")?.value || 0);

    const dto = {
        id: editId,
        lastName: document.getElementById("uLastName")?.value.trim() || "",
        firstName: document.getElementById("uFirstName")?.value.trim() || "",
        middleName: document.getElementById("uMiddleName")?.value.trim() || "",
        login: document.getElementById("uLogin")?.value.trim() || "",
        password: document.getElementById("uPass")?.value || "",
        position: document.getElementById("uPosition")?.value.trim() || "",
        rate: Number(document.getElementById("uRate")?.value || 0),
        role: document.getElementById("uRole")?.value || "employee",
        email: document.getElementById("uEmail")?.value.trim() || "",
        phone: document.getElementById("uPhone")?.value.trim() || "",
        status: document.getElementById("uStatus")?.value || "active",
        workMode: document.getElementById("uWorkMode")?.value || "fixed",
        requiredDailyHours: Number(document.getElementById("uRequiredDailyHours")?.value || 8),
        plannedStartTime: document.getElementById("uPlannedStartTime")?.value || "",
        plannedEndTime: document.getElementById("uPlannedEndTime")?.value || ""
    };

    if (dto.workMode === "flexible") {
        dto.plannedStartTime = "";
        dto.plannedEndTime = "";
    }

    const pass2 = document.getElementById("uPass2")?.value || "";

    if (!dto.lastName || !dto.firstName || !dto.login || !dto.position) {
        showNotification("Заполните обязательные поля");
        return;
    }

    if (editId === 0 && !dto.password) {
        showNotification("Введите пароль");
        return;
    }

    if ((dto.password || pass2) && dto.password !== pass2) {
        showNotification("Пароли не совпадают");
        return;
    }

    if (!Number.isFinite(dto.rate) || dto.rate < 0) {
        showNotification("Некорректная ставка");
        return;
    }

    const handler = editId === 0 ? "AddUser" : "UpdateUser";

    try {
        const res = await fetch(`/MainPage?handler=${handler}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify(dto)
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка сохранения сотрудника");
            return;
        }

        const savedUser = normalizeUser(data.user);

        if (editId === 0) {
            users.unshift(savedUser);
        } else {
            const index = users.findIndex(u => Number(u.id) === Number(savedUser.id));
            if (index !== -1) {
                users[index] = savedUser;
            }
        }

        renderAdminStats();
        renderUsersTable();
        renderWorkloadTable();
        renderProductivityTable();
        renderSalaryTable();
        renderBonusesTable();
        renderControlTab();

        closeModal("userModal");
        resetUserModalState();

        showNotification(editId === 0 ? "Сотрудник добавлен" : "Сотрудник обновлён");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

function editUser(id) {
    const user = users.find(x => x.id === id);
    if (!user) {
        showNotification("Сотрудник не найден");
        return;
    }

    resetUserModalState();

    document.getElementById("editUserId").value = user.id;
    document.getElementById("editULastName").value = extractLastName(user.fullName);
    document.getElementById("editUFirstName").value = extractFirstName(user.fullName);
    document.getElementById("editUMiddleName").value = extractMiddleName(user.fullName);
    document.getElementById("editULogin").value = user.login || "";
    document.getElementById("editUPass").value = "";
    document.getElementById("editUPosition").value = user.position || "";
    document.getElementById("editURate").value = user.hourlyRate || 0;
    document.getElementById("editURole").value = user.role || "employee";
    document.getElementById("editUEmail").value = user.email || "";
    document.getElementById("editUPhone").value = user.phone || "";
    document.getElementById("editUStatus").value = user.status || "active";
    document.getElementById("editUWorkMode").value = user.workMode || "fixed";
    document.getElementById("editURequiredDailyHours").value = user.requiredDailyHours || 8;
    document.getElementById("editUPlannedStartTime").value = user.plannedStartTime || "09:00";
    document.getElementById("editUPlannedEndTime").value = user.plannedEndTime || "18:00";

    toggleWorkModeFields("editU");
    openModal("editUserModal");
}

async function saveUserChanges() {
    const dto = {
        id: Number(document.getElementById("editUserId")?.value || 0),
        lastName: document.getElementById("editULastName")?.value.trim() || "",
        firstName: document.getElementById("editUFirstName")?.value.trim() || "",
        middleName: document.getElementById("editUMiddleName")?.value.trim() || "",
        login: document.getElementById("editULogin")?.value.trim() || "",
        password: document.getElementById("editUPass")?.value || "",
        position: document.getElementById("editUPosition")?.value.trim() || "",
        rate: Number(document.getElementById("editURate")?.value || 0),
        role: document.getElementById("editURole")?.value || "employee",
        email: document.getElementById("editUEmail")?.value.trim() || "",
        phone: document.getElementById("editUPhone")?.value.trim() || "",
        status: document.getElementById("editUStatus")?.value || "active",
        workMode: document.getElementById("editUWorkMode")?.value || "fixed",
        requiredDailyHours: Number(document.getElementById("editURequiredDailyHours")?.value || 8),
        plannedStartTime: document.getElementById("editUPlannedStartTime")?.value || "",
        plannedEndTime: document.getElementById("editUPlannedEndTime")?.value || ""
    };

    if (dto.workMode === "flexible") {
        dto.plannedStartTime = "";
        dto.plannedEndTime = "";
    }

    if (!dto.lastName || !dto.firstName || !dto.login || !dto.position) {
        showNotification("Заполните обязательные поля");
        return;
    }

    try {
        const res = await fetch("/MainPage?handler=UpdateUser", {
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

        const index = users.findIndex(x => x.id === dto.id);
        if (index !== -1) {
            users[index] = normalizeUser(data.user);
        }

        closeModal("editUserModal");
        resetUserModalState();

        renderAdminStats();
        renderUsersTable();
        renderWorkloadTable();
        renderProductivityTable();
        renderSalaryTable();
        renderBonusesTable();
        renderControlTab();

        showNotification("Изменения сохранены");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

async function toggleUserStatus(id) {
    try {
        const res = await fetch("/MainPage?handler=ToggleUserStatus", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({ id: id })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка изменения статуса");
            return;
        }

        const index = users.findIndex(x => x.id === id);
        if (index !== -1) {
            users[index] = normalizeUser(data.user);
        }

        renderAdminStats();
        renderUsersTable();
        renderWorkloadTable();
        renderProductivityTable();
        renderSalaryTable();
        renderBonusesTable();
        renderControlTab();

        showNotification("Статус обновлен");
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

function exportAdminSalaryCsv() {
    const rows = [
        ["ФИО", "Оплачиваемые часы", "Ставка", "Сумма"],
        ...users.map(u => [
            u.fullName,
            Number(u.salaryHours || 0).toFixed(1),
            String(u.hourlyRate),
            String(Number(u.salaryHours || 0) * Number(u.hourlyRate || 0))
        ])
    ];

    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "salary-report.csv";
    link.click();

    URL.revokeObjectURL(url);
}

async function loadManualTimeRequests() {
    try {
        const res = await fetch("/MainPage?handler=ManualTimeRequests");
        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось загрузить заявки");
            return;
        }

        manualTimeRequests = Array.isArray(data.items) ? data.items : [];
        refreshManualRequestFilters();
        if (expandedManualRequestId && !getManualRequestById(expandedManualRequestId)) {
            expandedManualRequestId = 0;
        }
        renderManualTimeRequests();
        renderDashboardManualTimeRequests();
    } catch {
        showNotification("Ошибка загрузки заявок");
    }
}

function getManualRequestReasonText(reason) {
    switch (String(reason || "").toLowerCase()) {
        case "forgot_timer":
            return "Забыл запустить таймер";
        case "after_completion":
            return "После завершения";
        case "technical_issue":
            return "Техническая проблема";
        case "external_work":
            return "Созвон / внешняя работа";
        case "meeting":
            return "Встреча / митап";
        case "offline_work":
            return "Оффлайн работа";
        case "fix_after_pause":
            return "Доработка после паузы";
        case "customer_help":
            return "Помощь клиенту";
        case "review_help":
            return "Проверка / помощь коллеге";
        case "migration":
            return "Перенос / настройка";
        case "other":
            return "Другое";
        default:
            return reason || "—";
    }
}

function getManualRequestById(id) {
    return manualTimeRequests.find(x => Number(x.id) === Number(id));
}

function renderManualRequestPreview(x) {
    const reasonText = escapeUserText(getManualRequestReasonText(x.reason));
    const commentText = escapeUserText(x.comment || "—");

    return `
        <div class="manual-request-preview">
            <span class="manual-request-preview-reason" title="${reasonText}">${reasonText}</span>
            <span class="manual-request-preview-comment" title="${commentText}">${commentText}</span>
        </div>
    `;
}

function renderManualTimeStatus(status) {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "approved") {
        return `<span class="task-status status-done manual-request-status-badge">Одобрено</span>`;
    }

    if (normalized === "rejected") {
        return `<span class="task-status status-new manual-request-status-badge">Отклонено</span>`;
    }

    if (normalized === "needs_revision") {
        return `<span class="task-status status-review manual-request-status-badge">На доработке</span>`;
    }

    return `<span class="task-status status-review manual-request-status-badge">Ожидание</span>`;
}

function formatManualRequestDate(value) {
    const parts = getManualRequestDateParts(value);
    return `
        <span class="manual-date">
            <span class="manual-date-day">${escapeUserText(parts.date)}</span>
            <span class="manual-date-time">${escapeUserText(parts.time || "—")}</span>
        </span>
    `;
}

function formatManualRequestTimelineDate(value) {
    const parts = getManualRequestDateParts(value);
    return `
        <span class="manual-request-timeline-date">
            <strong>${escapeUserText(parts.date)}</strong>
            <span>${escapeUserText(parts.time || "—")}</span>
        </span>
    `;
}

function formatManualRequestReadableDate(value, includeTime = true) {
    const raw = String(value || "").trim();
    if (!raw) {
        return "—";
    }

    const parsed = parseManualRequestDateValue(raw);
    if (!parsed) {
        return raw;
    }

    const hasTime = /\d{2}:\d{2}$/.test(raw);
    const dateLabel = parsed
        .toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
        .replace(/\s?г\./g, "")
        .trim();

    if (!includeTime || !hasTime) {
        return dateLabel;
    }

    const timeLabel = parsed.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    return `${dateLabel}, ${timeLabel}`;
}

function formatManualRequestHistoryDate(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return `
            <span class="manual-request-history-date">
                <strong>—</strong>
                <span>Без даты</span>
            </span>
        `;
    }

    const parsed = parseManualRequestDateValue(raw);
    if (!parsed) {
        return `
            <span class="manual-request-history-date">
                <strong>${escapeUserText(raw)}</strong>
            </span>
        `;
    }

    const hasTime = /\d{2}:\d{2}$/.test(raw);
    const dateLabel = parsed
        .toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
        .replace(/\.$/, "");
    const timeLabel = hasTime
        ? parsed.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
        : "Без времени";

    return `
        <span class="manual-request-history-date">
            <strong>${escapeUserText(dateLabel)}</strong>
            <span>${escapeUserText(timeLabel)}</span>
        </span>
    `;
}

function getManualRequestStateInfo(request) {
    const status = String(request.status || "pending").toLowerCase();

    switch (status) {
        case "approved":
            return {
                title: "Проверка завершена",
                text: "Заявка одобрена. Часы будут учтены в расчётах и отчётах.",
                tone: "success",
                actionTitle: "Результат",
                actionText: "Заявка принята. Часы будут учтены автоматически, дополнительных действий не требуется."
            };
        case "rejected":
            return {
                title: "Проверка завершена",
                text: "Заявка отклонена и не будет учтена в расчётах.",
                tone: "danger",
                actionTitle: "Результат проверки",
                actionText: "Если это время всё же нужно учесть, оформите новую заявку с уточнениями и подтверждением."
            };
        case "needs_revision":
            return {
                title: "Нужны правки",
                text: "Менеджер запросил уточнения. Повторная отправка доступна после исправлений.",
                tone: "warning",
                actionTitle: "Что изменить",
                actionText: "Ниже указано замечание менеджера. После правок можно повторно отправить заявку на проверку."
            };
        default:
            return {
                title: "Ожидает проверки",
                text: "Заявка передана менеджеру и ожидает решения.",
                tone: "info",
                actionTitle: "Состояние заявки",
                actionText: "Заявка находится на проверке у менеджера. Дополнительных действий пока не требуется."
            };
    }
}

function normalizeManualRequestDecisionText(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

function getManualRequestManagerCommentText(request) {
    const raw = String(request.managerComment || "").trim();
    const status = String(request.status || "pending").toLowerCase();

    if (!raw) {
        if (status === "pending") {
            return "Решение менеджера ещё не добавлено.";
        }

        return "Подробный комментарий менеджера не указан.";
    }

    const normalized = normalizeManualRequestDecisionText(raw);
    const duplicateLabels = [
        getManualRequestStatusText(status),
        getManualRequestStateInfo(request).title,
        "требуется доработка",
        "на доработке",
        "возвращена на доработку"
    ].map(normalizeManualRequestDecisionText);

    if (duplicateLabels.includes(normalized)) {
        if (status === "needs_revision") {
            return "Менеджер запросил правки без подробного комментария.";
        }

        if (status === "rejected") {
            return "Менеджер отклонил заявку без подробного комментария.";
        }

        if (status === "approved") {
            return "Менеджер одобрил заявку без дополнительного комментария.";
        }
    }

    return raw;
}

function getManualRequestHistoryItems(request) {
    const status = String(request.status || "pending").toLowerCase();
    const items = [
        {
            title: "Заявка отправлена",
            time: request.createdAt || "—",
            tone: "info",
            text: `Указано ${Number(request.hours || 0).toFixed(1)} ч. Заявка передана на проверку менеджеру.`
        }
    ];

    if (request.reviewedAt) {
        const reviewText = getManualRequestManagerCommentText(request);
        const actionTitle =
            status === "approved"
                ? "Заявка одобрена"
                : status === "rejected"
                    ? "Заявка отклонена"
                    : status === "needs_revision"
                        ? "Возвращена на доработку"
                        : "Заявка проверена";

        const actionText =
            reviewText ||
            (status === "approved"
                ? "Менеджер подтвердил учёт времени."
                : status === "rejected"
                    ? "Менеджер отклонил заявку."
                    : status === "needs_revision"
                        ? "Менеджер запросил доработку и уточнение."
                        : "Статус заявки был обновлён.");

        items.push({
            title: actionTitle,
            time: request.reviewedAt,
            tone:
                status === "approved"
                    ? "success"
                    : status === "rejected"
                        ? "danger"
                        : status === "needs_revision"
                            ? "warning"
                            : "info",
            text: actionText
        });
    }

    if (status === "pending") {
        items.push({
            title: "Ожидает решения",
            time: request.createdAt || "—",
            tone: "pending",
            text: "Заявка отправлена на проверку и пока не обработана менеджером."
        });
    }

    return items;
}

function getManualRequestHistoryMarkup(request) {
    const items = getManualRequestHistoryItems(request);
    const activeIndex = Math.max(items.length - 1, 0);
    const activeItem = items[activeIndex];

    return `
        <div class="manual-request-history-shell">
            <div class="manual-request-history-track">
                <span class="manual-request-history-cap is-start" aria-hidden="true"></span>
                <div class="manual-request-history-list">
                    ${items.map((item, index) => `
                        <button class="manual-request-history-item is-${item.tone}${index === activeIndex ? " is-active" : ""}"
                                type="button"
                                data-tone="${escapeUserText(item.tone)}"
                                data-title="${escapeUserText(item.title)}"
                                data-date="${escapeUserText(formatManualRequestReadableDate(item.time))}"
                                data-text="${escapeUserText(item.text)}"
                                onclick="selectManualRequestHistoryItem(event, this)">
                            <span class="manual-request-history-dot" aria-hidden="true"></span>
                            <span class="manual-request-history-copy">
                                <strong>${escapeUserText(item.title)}</strong>
                                <span>${escapeUserText(formatManualRequestReadableDate(item.time))}</span>
                            </span>
                        </button>
                    `).join("")}
                </div>
                <span class="manual-request-history-cap is-end" aria-hidden="true"></span>
            </div>

            <div class="manual-request-history-detail is-${escapeUserText(activeItem.tone)}">
                <span class="manual-request-history-detail-kicker">Выбранный этап</span>
                <div class="manual-request-history-detail-head">
                    <h6 data-history-detail-title>${escapeUserText(activeItem.title)}</h6>
                    <span data-history-detail-date>${escapeUserText(formatManualRequestReadableDate(activeItem.time))}</span>
                </div>
                <div class="manual-request-history-detail-text" data-history-detail-text>${escapeUserText(activeItem.text)}</div>
            </div>
        </div>
    `;
}

function renderManualRequestContextGrid(request) {
    return `
        <div class="manual-request-context-grid">
            <div class="manual-request-context-card">
                <span>Сотрудник</span>
                <strong>${escapeUserText(request.employee || "—")}</strong>
            </div>
            <div class="manual-request-context-card">
                <span>Основание</span>
                <strong>${escapeUserText(getManualRequestReasonText(request.reason))}</strong>
            </div>
        </div>
    `;
}

function renderManualRequestPath(request) {
    return `
        <div class="manual-request-path">
            <div class="manual-request-path-node">
                <span>Проект</span>
                <strong>${escapeUserText(request.projectName || "Без проекта")}</strong>
            </div>
            <span class="manual-request-path-separator" aria-hidden="true">
                <i class="fas fa-chevron-right"></i>
            </span>
            <div class="manual-request-path-node">
                <span>Задача</span>
                <strong>${escapeUserText(request.taskName || "Без задачи")}</strong>
            </div>
        </div>
    `;
}

function selectManualRequestHistoryItem(event, button) {
    const shell = button?.closest?.(".manual-request-history-shell");
    if (!shell) {
        return;
    }

    shell.querySelectorAll(".manual-request-history-item").forEach(item => {
        item.classList.toggle("is-active", item === button);
    });

    const detail = shell.querySelector(".manual-request-history-detail");
    if (detail) {
        detail.className = `manual-request-history-detail is-${button.dataset.tone || "info"}`;
    }

    const title = shell.querySelector("[data-history-detail-title]");
    const date = shell.querySelector("[data-history-detail-date]");
    const text = shell.querySelector("[data-history-detail-text]");

    if (title) title.textContent = button.dataset.title || "—";
    if (date) date.textContent = button.dataset.date || "—";
    if (text) text.textContent = button.dataset.text || "—";

    if (event?.currentTarget instanceof HTMLElement) {
        event.currentTarget.blur();
    }
}

function renderManualRequestExpandedDetails(request) {
    const attachmentMarkup = request.attachmentPath
        ? `<a href="${escapeUserText(request.attachmentPath)}" target="_blank" class="btn btn-outline manual-expanded-file-btn">
                <i class="fas fa-paperclip"></i> ${escapeUserText(request.attachmentName || "Открыть файл")}
           </a>`
        : `<span class="manual-request-muted">Файл не прикреплён</span>`;
    const statusMarkup = renderManualTimeStatus(request.status);
    const stateInfo = getManualRequestStateInfo(request);
    const managerCommentText = getManualRequestManagerCommentText(request);
    const canResubmitAction = request.canResubmit
        ? `
            <button class="btn btn-primary" type="button" onclick="closeModal('manualRequestDetailsModal'); startManualRequestEdit(${request.id})">
                <i class="fas fa-rotate-left"></i> Исправить и отправить снова
            </button>
        `
        : "";
    const projectName = request.projectName || "Без проекта";
    const taskName = request.taskName || "Без задачи";
    const employeeName = request.employee || "—";

    return `
        <div class="manual-request-details-clean">
            <div class="manual-request-details-hero">
                <div class="manual-request-details-title">
                    <span>Заявка #${escapeUserText(request.id)}</span>
                    <h4>${escapeUserText(taskName)}</h4>
                    <p>${escapeUserText(projectName)} · ${escapeUserText(employeeName)}</p>
                </div>
                <div class="manual-request-details-status">
                    ${statusMarkup}
                    <strong>${escapeUserText(stateInfo.title)}</strong>
                    <span>${escapeUserText(stateInfo.text)}</span>
                </div>
            </div>

            <div class="manual-request-details-facts">
                <dl>
                    <dt>Сотрудник</dt>
                    <dd>${escapeUserText(employeeName)}</dd>
                </dl>
                <dl>
                    <dt>Основание</dt>
                    <dd>${escapeUserText(getManualRequestReasonText(request.reason))}</dd>
                </dl>
                <dl>
                    <dt>Дата работы</dt>
                    <dd>${escapeUserText(formatManualRequestReadableDate(request.workDate, false))}</dd>
                </dl>
                <dl>
                    <dt>Часы</dt>
                    <dd>${Number(request.hours || 0).toFixed(1)} ч</dd>
                </dl>
                <dl>
                    <dt>Отправлена</dt>
                    <dd>${escapeUserText(formatManualRequestReadableDate(request.createdAt))}</dd>
                </dl>
                <dl>
                    <dt>Проверка</dt>
                    <dd>${escapeUserText(request.reviewedAt ? formatManualRequestReadableDate(request.reviewedAt) : "Не проверялась")}</dd>
                </dl>
            </div>

            <div class="manual-request-modal-tabs" role="tablist" aria-label="Вкладки заявки">
                <button class="manual-request-modal-tab is-active" type="button" data-tab="overview" onclick="switchManualRequestDetailsTab(event, 'overview')">
                    Обзор
                </button>
                <button class="manual-request-modal-tab" type="button" data-tab="review" onclick="switchManualRequestDetailsTab(event, 'review')">
                    Проверка
                </button>
                <button class="manual-request-modal-tab" type="button" data-tab="history" onclick="switchManualRequestDetailsTab(event, 'history')">
                    История правок
                </button>
            </div>

            <div class="manual-request-modal-panel is-active" data-tab-panel="overview">
                <div class="manual-request-details-grid">
                    <section class="manual-request-details-section">
                        <h5>Что запросил сотрудник</h5>
                        <div class="manual-request-details-text">${escapeUserText(request.comment || "Комментарий не добавлен.")}</div>
                    </section>

                    <section class="manual-request-details-section">
                        <h5>Связанные данные</h5>
                        <div class="manual-request-details-list">
                            <div><span>Проект</span><strong>${escapeUserText(projectName)}</strong></div>
                            <div><span>Задача</span><strong>${escapeUserText(taskName)}</strong></div>
                            <div><span>Вложение</span><strong>${attachmentMarkup}</strong></div>
                        </div>
                    </section>
                </div>
            </div>

            <div class="manual-request-modal-panel" data-tab-panel="review">
                <div class="manual-request-details-grid">
                    <section class="manual-request-details-section">
                        <h5>${escapeUserText(stateInfo.actionTitle)}</h5>
                        <div class="manual-request-details-text is-emphasis">${escapeUserText(stateInfo.actionText)}</div>
                    </section>

                    <section class="manual-request-details-section">
                        <h5>Комментарий менеджера</h5>
                        <div class="manual-request-details-text">${escapeUserText(managerCommentText)}</div>
                        ${canResubmitAction ? `<div class="manual-request-state-actions">${canResubmitAction}</div>` : ""}
                    </section>
                </div>
            </div>

            <div class="manual-request-modal-panel" data-tab-panel="history">
                <section class="manual-request-details-section">
                    <h5>История правок и решений</h5>
                    ${getManualRequestHistoryMarkup(request)}
                </section>
            </div>
        </div>
    `;
}

function renderManualRequestExpandedSummary(request, canShowActions) {
    const attachmentMarkup = request.attachmentPath
        ? `<a href="${escapeUserText(request.attachmentPath)}" target="_blank" class="btn btn-outline manual-expanded-file-btn">
                <i class="fas fa-paperclip"></i> ${escapeUserText(request.attachmentName || "Открыть файл")}
           </a>`
        : `<span class="manual-request-muted">Файл не прикреплён</span>`;
    const managerCommentText = getManualRequestManagerCommentText(request);
    const employeeCommentText = request.comment || "Комментарий не добавлен";
    const quickActions = canShowActions
        ? `
            <button class="btn btn-success manual-request-inline-action" type="button" onclick="approveManualTimeRequest(${request.id})">
                <i class="fas fa-check"></i>
                <span>Одобрить</span>
            </button>
            <button class="btn btn-outline manual-request-inline-action" type="button" onclick="sendManualTimeRequestToRevision(${request.id})">
                <i class="fas fa-rotate-left"></i>
                <span>На доработку</span>
            </button>
            <button class="btn btn-danger manual-request-inline-action" type="button" onclick="rejectManualTimeRequest(${request.id})">
                <i class="fas fa-xmark"></i>
                <span>Отклонить</span>
            </button>
        `
        : "";

    return `
        <div class="table-expand-stage" data-expand-stage data-enter="true">
            <div class="table-expand-shell manual-request-expand-shell row-expand-animate">
                <div class="manual-request-expand-head">
                    <div class="table-expand-identity manual-request-expand-copy">
                        <span class="table-expand-kicker">Заявка #${escapeUserText(request.id)}</span>
                        <div class="table-expand-title-row">
                            <h4 class="table-expand-title">${escapeUserText(request.employee || "—")}</h4>
                        </div>
                        ${renderManualRequestPath(request)}
                    </div>
                    <div class="table-expand-badges manual-request-expand-badges">
                        ${renderManualTimeStatus(request.status)}
                        ${renderTableExpandPill(getManualRequestReasonText(request.reason))}
                    </div>
                </div>

                <div class="table-expand-stats manual-request-expand-stats">
                    ${renderTableExpandStat("Учтено", `${Number(request.hours || 0).toFixed(1)} ч`)}
                    ${renderTableExpandStat("Дата работы", formatManualRequestReadableDate(request.workDate, false))}
                    ${renderTableExpandStat("Отправлена", formatManualRequestReadableDate(request.createdAt))}
                </div>

                <div class="table-expand-content manual-request-expand-content">
                    ${renderTableExpandSection("Проверка", [
            renderTableExpandItem("Текущий статус", renderManualTimeStatus(request.status), { html: true }),
            renderTableExpandItem("Последнее решение", request.reviewedAt ? formatManualRequestReadableDate(request.reviewedAt) : "Ещё не было"),
            renderTableExpandItem("Файл", attachmentMarkup, { html: true }),
            renderTableExpandItem(getManualRequestStateInfo(request).actionTitle, getManualRequestStateInfo(request).actionText)
        ].join(""), { wide: true })}

                    ${renderTableExpandNote("Комментарий сотрудника", employeeCommentText, {
            muted: !String(request.comment || "").trim()
        })}

                    ${renderTableExpandNote("Комментарий менеджера", managerCommentText, {
            muted: !String(request.managerComment || "").trim()
        })}
                </div>

                <div class="table-expand-actions manual-request-expand-actions">
                    <button class="btn btn-outline manual-request-expand-btn" type="button" onclick="showManualRequestDetails(${request.id})">
                        <i class="fas fa-arrow-up-right-from-square manual-request-expand-icon"></i>
                        <span>Посмотреть подробности</span>
                    </button>
                    ${quickActions}
                </div>
            </div>
        </div>
    `;
}

function toggleManualRequestRow(event, row, id) {
    if (!row) return;

    const target = event?.target;
    if (target?.closest?.("button, a, input, select, textarea, .table-actions, .manual-file-btn")) {
        return;
    }

    const nextId = Number(id);
    const body = document.getElementById("manualTimeRequestsBody");
    const expandedRow = body?.querySelector?.(".manual-request-expanded-row");
    const expandedStage = expandedRow?.querySelector?.("[data-expand-stage]");
    const selectedRow = body?.querySelector?.(".manual-request-row.is-selected");
    const request = manualTimeRequests.find(x => Number(x.id) === nextId);
    const canReview = isAdmin || isManager;
    const canShowActions = canReview && String(request?.status || "").toLowerCase() === "pending";

    const mountExpandedRow = () => {
        if (!request) {
            expandedManualRequestId = 0;
            return;
        }

        expandedManualRequestId = nextId;
        row.classList.add("is-selected");
        row.insertAdjacentHTML("afterend", `
            <tr class="manual-request-expanded-row">
                <td colspan="10">
                    ${renderManualRequestExpandedSummary(request, canShowActions)}
                </td>
            </tr>
        `);
        playUsersExpandStageEnter(body);
    };

    if (Number(expandedManualRequestId) === nextId && expandedStage) {
        collapseUsersExpandStage(expandedStage, () => {
            expandedRow?.remove();
            selectedRow?.classList.remove("is-selected");
            expandedManualRequestId = 0;
        });
        return;
    }

    if (expandedStage) {
        collapseUsersExpandStage(expandedStage, () => {
            expandedRow?.remove();
            selectedRow?.classList.remove("is-selected");
            mountExpandedRow();
        });
        return;
    }

    mountExpandedRow();
}

function renderManualTimeRequests() {
    const body = document.getElementById("manualTimeRequestsBody");
    if (!body) return;

    const items = getFilteredManualTimeRequests();
    if (expandedManualRequestId && !items.some(item => Number(item.id) === Number(expandedManualRequestId))) {
        expandedManualRequestId = 0;
    }

    if (!items.length) {
        body.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; color: var(--gray);">Заявок пока нет</td>
            </tr>
        `;
        enhanceAdminTables();
        return;
    }

    const canReview = isAdmin || isManager;
    body.innerHTML = items.map(x => {
        const status = String(x.status || "pending").toLowerCase();
        const canShowActions = canReview && status === "pending";
        const isExpanded = Number(expandedManualRequestId) === Number(x.id);
        const actionsMarkup = `
            <div class="table-actions manual-request-actions">
                ${canShowActions ? `
                    <button class="btn btn-sm btn-success" type="button" onclick="approveManualTimeRequest(${x.id})" title="Одобрить">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" type="button" onclick="sendManualTimeRequestToRevision(${x.id})" title="Вернуть на доработку">
                        <i class="fas fa-rotate-left"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" type="button" onclick="rejectManualTimeRequest(${x.id})" title="Отклонить">
                        <i class="fas fa-xmark"></i>
                    </button>
                ` : `
                    <button class="btn btn-sm btn-outline" type="button" onclick="showManualRequestDetails(${x.id})" title="Подробнее">
                        <i class="fas fa-arrow-up-right-from-square"></i>
                    </button>
                `}
            </div>
        `;

        return `
            <tr class="manual-request-row ${isExpanded ? "is-selected" : ""}" onclick="toggleManualRequestRow(event, this, ${x.id})">
                <td>${escapeUserText(x.id)}</td>
                <td title="${escapeUserText(x.employee || "-")}">${escapeUserText(x.employee || "-")}</td>
                <td title="${escapeUserText(x.taskName || "-")}">${escapeUserText(x.taskName || "-")}</td>
                <td title="${escapeUserText(x.projectName || "-")}">${escapeUserText(x.projectName || "-")}</td>
                <td>${Number(x.hours || 0).toFixed(1)}</td>
                <td>${renderManualRequestPreview(x)}</td>
                <td class="manual-request-file-cell">
                    ${x.attachmentPath
                ? `<a href="${escapeUserText(x.attachmentPath)}" target="_blank" class="btn btn-sm btn-outline manual-file-btn" title="${escapeUserText(x.attachmentName || "Файл")}">
                                 <i class="fas fa-paperclip"></i>
                            </a>`
                : `<span class="manual-request-muted">—</span>`
            }
                </td>
                <td>${renderManualTimeStatus(status)}</td>
                <td>${formatManualRequestDate(x.createdAt)}</td>
                <td>${actionsMarkup}</td>
            </tr>
            ${isExpanded ? `
                <tr class="manual-request-expanded-row">
                    <td colspan="10">${renderManualRequestExpandedSummary(x, canShowActions)}</td>
                </tr>
            ` : ""}
        `;
    }).join("");

    playUsersExpandStageEnter(body);
    enhanceAdminTables();
}

function showManualRequestDetails(id) {
    const request = getManualRequestById(id);
    const body = document.getElementById("manualRequestDetailsBody");
    if (!request || !body) {
        showNotification("Заявка не найдена");
        return;
    }

    body.innerHTML = renderManualRequestExpandedDetails(request);
    openModal("manualRequestDetailsModal");
}

function switchManualRequestDetailsTab(event, tabName) {
    const modal = document.getElementById("manualRequestDetailsModal");
    if (!modal) {
        return;
    }

    modal.querySelectorAll(".manual-request-modal-tab").forEach(tab => {
        tab.classList.toggle("is-active", tab.dataset.tab === tabName);
    });

    modal.querySelectorAll(".manual-request-modal-panel").forEach(panel => {
        panel.classList.toggle("is-active", panel.dataset.tabPanel === tabName);
    });

    if (event?.currentTarget instanceof HTMLElement) {
        event.currentTarget.blur();
    }
}

function openManualRequestActionModal(id, actionType) {
    const request = getManualRequestById(id);
    const title = document.getElementById("manualRequestActionTitle");
    const label = document.getElementById("manualRequestActionLabel");
    const hint = document.getElementById("manualRequestActionHint");
    const textarea = document.getElementById("manualRequestActionComment");
    const submitBtn = document.getElementById("manualRequestActionSubmitBtn");
    const idField = document.getElementById("manualRequestActionId");
    const typeField = document.getElementById("manualRequestActionType");

    if (!request || !title || !label || !hint || !textarea || !submitBtn || !idField || !typeField) {
        showNotification("Не удалось открыть форму действия");
        return;
    }

    const config = {
        approve: {
            title: "Одобрение заявки",
            label: "Комментарий менеджера",
            hint: "Можно оставить пустым, если дополнительных пояснений не нужно.",
            submitText: "Одобрить",
            value: ""
        },
        needs_revision: {
            title: "Возврат на доработку",
            label: "Что нужно исправить",
            hint: "Опишите, что нужно дополнить или переделать, чтобы сотрудник смог отправить заявку повторно.",
            submitText: "Вернуть на доработку",
            value: request.managerComment || ""
        },
        reject: {
            title: "Отклонение заявки",
            label: "Причина отклонения",
            hint: "Укажи причину, чтобы сотрудник понимал, почему заявка не принята.",
            submitText: "Отклонить",
            value: request.managerComment || ""
        }
    }[actionType];

    if (!config) {
        return;
    }

    title.textContent = config.title;
    label.textContent = config.label;
    hint.textContent = config.hint;
    submitBtn.textContent = config.submitText;
    textarea.value = config.value;
    idField.value = String(id);
    typeField.value = actionType;

    openModal("manualRequestActionModal");
    window.setTimeout(() => textarea.focus(), 0);
}

async function performManualRequestAction(actionType, id, managerComment) {
    const urlMap = {
        approve: "/MainPage?handler=ApproveManualTimeRequest",
        needs_revision: "/MainPage?handler=NeedsRevisionManualTimeRequest",
        reject: "/MainPage?handler=RejectManualTimeRequest"
    };

    const successMap = {
        approve: "Заявка одобрена",
        needs_revision: "Заявка возвращена на доработку",
        reject: "Заявка отклонена"
    };

    const res = await fetch(urlMap[actionType], {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "RequestVerificationToken": getRequestVerificationToken()
        },
        body: JSON.stringify({
            id: id,
            managerComment: managerComment
        })
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
        showNotification(data?.error || "Не удалось обработать заявку");
        return false;
    }

    showNotification(successMap[actionType]);
    closeModal("manualRequestActionModal");
    await loadManualTimeRequests();
    return true;
}

async function submitManualRequestAction() {
    const id = Number(document.getElementById("manualRequestActionId")?.value || 0);
    const actionType = document.getElementById("manualRequestActionType")?.value || "";
    const managerComment = document.getElementById("manualRequestActionComment")?.value.trim() || "";

    if (!id || !actionType) {
        showNotification("Не удалось определить действие");
        return;
    }

    if ((actionType === "needs_revision" || actionType === "reject") && !managerComment) {
        showNotification(actionType === "reject" ? "Укажите причину отклонения" : "Укажите, что нужно исправить");
        return;
    }

    try {
        await performManualRequestAction(actionType, id, managerComment);
    } catch {
        showNotification("Ошибка сети/сервера");
    }
}

function approveManualTimeRequest(id) {
    openManualRequestActionModal(id, "approve");
}

function sendManualTimeRequestToRevision(id) {
    openManualRequestActionModal(id, "needs_revision");
}

function rejectManualTimeRequest(id) {
    openManualRequestActionModal(id, "reject");
}

function renderDashboardManualTimeRequests() {
    const body = document.getElementById("dashboardManualTimeRequestsBody");
    if (!body) return;

    const items = manualTimeRequests.filter(x => Number(x.userId) === Number(currentUserId));

    if (!items.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; color: var(--gray);">Заявок пока нет</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = items.map(x => {
        const status = String(x.status || "pending").toLowerCase();
        const canEdit = Boolean(x.canResubmit);

        return `
            <tr>
                <td>${escapeUserText(x.workDate || "-")}</td>
                <td>${escapeUserText(x.taskName || "-")}</td>
                <td>${Number(x.hours || 0).toFixed(1)}</td>
                <td>${renderManualRequestPreview(x)}</td>
                <td>${renderManualTimeStatus(status)}</td>
                <td>
                    ${x.attachmentPath
                ? `<a href="${escapeUserText(x.attachmentPath)}" target="_blank" class="btn btn-sm btn-outline manual-file-btn" title="${escapeUserText(x.attachmentName || "Файл")}">
                                 <i class="fas fa-paperclip"></i>
                            </a>`
                : `<span style="display:inline-block; width:100%; text-align:center;">-</span>`
            }
                </td>
                <td>
                    ${canEdit
                ? `<button class="btn btn-outline manual-request-text-btn" type="button" onclick="startManualRequestEdit(${x.id})">Доработать</button>`
                : `<button class="btn btn-outline manual-request-text-btn" type="button" onclick="showManualRequestDetails(${x.id})">Подробнее</button>`}
                </td>
            </tr>
        `;
    }).join("");
}

async function initProfilePage() {
    const roleText = getRoleText(currentUserRole);
    const statusText = getStatusTextFull(currentUserIsActive);
    const rateText = currentUserRate > 0 ? `${currentUserRate.toLocaleString("ru-RU")} руб.` : "—";
    const profileName = currentUserName || currentUserLogin || currentUserEmail || "Пользователь";
    const profileInitial = profileName.trim().charAt(0).toUpperCase() || "U";

    const setProfileValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = value || "";
        }
    };

    setProfileValue("profileFullName", currentUserName);
    setProfileValue("profileLogin", currentUserLogin);
    setProfileValue("profileEmail", currentUserEmail);
    setProfileValue("profileContactEmail", currentUserEmail);
    setProfileValue("profilePhone", currentUserPhone);
    setProfileValue("profileContactPhone", currentUserPhone);
    setProfileValue("profilePosition", currentUserPosition);

    const profileRole = document.getElementById("profileRole");
    const profileStatus = document.getElementById("profileStatus");
    const profileRate = document.getElementById("profileRate");

    const profileRoleText = document.getElementById("profileRoleText");
    const profileStatusText = document.getElementById("profileStatusText");
    const profileRateText = document.getElementById("profileRateText");
    const profileCardName = document.getElementById("profileCardName");
    const profileCardPosition = document.getElementById("profileCardPosition");
    const profileCardEmail = document.getElementById("profileCardEmail");
    const profileAvatarBig = document.getElementById("profileAvatarBig");

    if (profileRole) profileRole.value = roleText;
    if (profileStatus) profileStatus.value = statusText;
    if (profileRate) profileRate.value = rateText;

    if (profileRoleText) profileRoleText.textContent = roleText;
    if (profileStatusText) profileStatusText.textContent = statusText;
    if (profileRateText) profileRateText.textContent = rateText;
    if (profileCardName) profileCardName.textContent = profileName;
    if (profileCardPosition) profileCardPosition.textContent = currentUserPosition || roleText;
    if (profileCardEmail) profileCardEmail.textContent = currentUserEmail || currentUserLogin || "—";
    if (profileAvatarBig) profileAvatarBig.textContent = profileInitial;

    try {
        const res = await fetch("/MainPage?handler=Profile");
        const data = await res.json();

        if (res.ok && data.ok && data.profile) {
            const profileContactNote = document.getElementById("profileContactNote");
            const profilePersonalNote = document.getElementById("profilePersonalNote");
            const profileNotifyUi = document.getElementById("profileNotifyUi");
            const profileRememberTask = document.getElementById("profileRememberTask");
            const profileUseScreens = document.getElementById("profileUseScreens");
            const profileUseWebcam = document.getElementById("profileUseWebcam");

            if (profileContactNote) profileContactNote.value = data.profile.contactNote || "";
            if (profilePersonalNote) profilePersonalNote.value = data.profile.personalNote || "";
            if (profileNotifyUi) profileNotifyUi.checked = !!data.profile.notifyInUi;
            if (profileRememberTask) profileRememberTask.checked = !!data.profile.rememberLastTask;
            if (profileUseScreens) profileUseScreens.checked = !!data.profile.allowScreenShots;
            if (profileUseWebcam) profileUseWebcam.checked = !!data.profile.allowWebcamShots;

            enableScreenShots = !!data.profile.allowScreenShots;
            enableWebcamShots = !!data.profile.allowWebcamShots;

            const screenCheckbox = document.getElementById("enableScreenShots");
            const webcamCheckbox = document.getElementById("enableWebcamShots");

            if (screenCheckbox) screenCheckbox.checked = enableScreenShots;
            if (webcamCheckbox) webcamCheckbox.checked = enableWebcamShots;
        }
    } catch {
        console.log("Не удалось загрузить профиль");
    }

    renderProfileWorkTab();
}

function showProfileTab(tabId, btn) {
    ["profileInfo", "profileContacts", "profileWork", "profileSecurity", "profilePrefs"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });

    document.querySelectorAll("#profilePage .admin-tab-btn").forEach(x => x.classList.remove("active"));

    document.getElementById(tabId)?.classList.remove("hidden");
    btn?.classList.add("active");

    if (tabId === "profileWork") {
        renderProfileWorkTab();
    }
}

function renderProfileWorkTab() {
    const activeTasks = tasks.filter(t => t.status?.toLowerCase() !== "done").length;
    const doneTasks = tasks.filter(t => t.status?.toLowerCase() === "done").length;
    const hours = timeEntries.reduce((sum, x) => sum + Number(x.hours || 0), 0);
    const projectsCount = projects.length;

    const profileActiveTasks = document.getElementById("profileActiveTasks");
    const profileDoneTasks = document.getElementById("profileDoneTasks");
    const profileHours = document.getElementById("profileHours");
    const profileProjectsCount = document.getElementById("profileProjectsCount");

    if (profileActiveTasks) profileActiveTasks.textContent = activeTasks;
    if (profileDoneTasks) profileDoneTasks.textContent = doneTasks;
    if (profileHours) profileHours.textContent = hours.toFixed(1).replace(".0", "");
    if (profileProjectsCount) profileProjectsCount.textContent = projectsCount;

    const body = document.getElementById("profileActivityBody");
    if (!body) return;

    if (!timeEntries.length) {
        body.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; color: var(--gray);">Активности пока нет</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = timeEntries.slice(0, 5).map(entry => `
        <tr>
            <td>${entry.date || "-"}</td>
            <td>${entry.task || "-"}</td>
            <td>${Number(entry.hours || 0).toFixed(1)} ч</td>
            <td>${entry.comment || "-"}</td>
        </tr>
    `).join("");
}

function resetProfilePreferences() {
    const profileNotifyUi = document.getElementById("profileNotifyUi");
    const profileRememberTask = document.getElementById("profileRememberTask");
    const profileUseScreens = document.getElementById("profileUseScreens");
    const profileUseWebcam = document.getElementById("profileUseWebcam");
    const profilePersonalNote = document.getElementById("profilePersonalNote");

    if (profileNotifyUi) profileNotifyUi.checked = true;
    if (profileRememberTask) profileRememberTask.checked = false;
    if (profileUseScreens) profileUseScreens.checked = true;
    if (profileUseWebcam) profileUseWebcam.checked = true;
    if (profilePersonalNote) profilePersonalNote.value = "";

    showNotification("Настройки сброшены. Не забудьте сохранить");
}

async function changePassword() {
    const oldPassword = document.getElementById("profileCurrentPassword")?.value || "";
    const newPassword = document.getElementById("profileNewPassword")?.value || "";
    const confirmPassword = document.getElementById("profileConfirmPassword")?.value || "";

    if (!oldPassword || !newPassword || !confirmPassword) {
        showNotification("Заполните все поля");
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification("Новый пароль и подтверждение не совпадают");
        return;
    }

    if (newPassword.length < 4) {
        showNotification("Пароль слишком короткий");
        return;
    }

    try {
        const res = await fetch("/MainPage?handler=ChangePassword", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({
                oldPassword: oldPassword,
                newPassword: newPassword
            })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Ошибка смены пароля");
            return;
        }

        document.getElementById("profileCurrentPassword").value = "";
        document.getElementById("profileNewPassword").value = "";
        document.getElementById("profileConfirmPassword").value = "";

        showNotification("Пароль успешно изменён");
    } catch {
        showNotification("Ошибка сети");
    }
}

async function saveProfile() {
    const email =
        document.getElementById("profileEmail")?.value?.trim() ||
        document.getElementById("profileContactEmail")?.value?.trim() ||
        "";

    const phone =
        document.getElementById("profilePhone")?.value?.trim() ||
        document.getElementById("profileContactPhone")?.value?.trim() ||
        "";

    const contactNote = document.getElementById("profileContactNote")?.value || "";
    const personalNote = document.getElementById("profilePersonalNote")?.value || "";

    const notifyInUi = !!document.getElementById("profileNotifyUi")?.checked;
    const rememberLastTask = !!document.getElementById("profileRememberTask")?.checked;
    const allowScreenShots = !!document.getElementById("profileUseScreens")?.checked;
    const allowWebcamShots = !!document.getElementById("profileUseWebcam")?.checked;

    if (!email) {
        showNotification("Введите email");
        return;
    }

    try {
        const res = await fetch("/MainPage?handler=SaveProfile", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({
                email,
                phone,
                contactNote,
                notifyInUi,
                rememberLastTask,
                allowScreenShots,
                allowWebcamShots,
                personalNote
            })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось сохранить профиль");
            return;
        }

        const profileEmail = document.getElementById("profileEmail");
        const profilePhone = document.getElementById("profilePhone");
        const profileContactEmail = document.getElementById("profileContactEmail");
        const profileContactPhone = document.getElementById("profileContactPhone");
        const profileContactNote = document.getElementById("profileContactNote");
        const profilePersonalNote = document.getElementById("profilePersonalNote");
        const profileNotifyUi = document.getElementById("profileNotifyUi");
        const profileRememberTask = document.getElementById("profileRememberTask");
        const profileUseScreens = document.getElementById("profileUseScreens");
        const profileUseWebcam = document.getElementById("profileUseWebcam");
        const profileCardEmail = document.getElementById("profileCardEmail");
        const dropdownEmail = document.getElementById("dropdownEmail");

        if (profileEmail) profileEmail.value = data.email || "";
        if (profileContactEmail) profileContactEmail.value = data.email || "";
        if (profilePhone) profilePhone.value = data.phone || "";
        if (profileContactPhone) profileContactPhone.value = data.phone || "";
        if (profileContactNote) profileContactNote.value = data.contactNote || "";
        if (profilePersonalNote) profilePersonalNote.value = data.personalNote || "";
        if (profileNotifyUi) profileNotifyUi.checked = !!data.notifyInUi;
        if (profileRememberTask) profileRememberTask.checked = !!data.rememberLastTask;
        if (profileUseScreens) profileUseScreens.checked = !!data.allowScreenShots;
        if (profileUseWebcam) profileUseWebcam.checked = !!data.allowWebcamShots;
        if (profileCardEmail) profileCardEmail.textContent = data.email || "";
        if (dropdownEmail) dropdownEmail.textContent = data.email || "";

        enableScreenShots = !!data.allowScreenShots;
        enableWebcamShots = !!data.allowWebcamShots;

        const screenCheckbox = document.getElementById("enableScreenShots");
        const webcamCheckbox = document.getElementById("enableWebcamShots");

        if (screenCheckbox) screenCheckbox.checked = enableScreenShots;
        if (webcamCheckbox) webcamCheckbox.checked = enableWebcamShots;

        showNotification("Изменения сохранены");
    } catch {
        showNotification("Ошибка сети");
    }
}
