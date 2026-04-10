
//reports.js
function showReport(reportId, el) {
    initReportsPage();

    document.querySelectorAll(".report-card").forEach(card => card.classList.add("hidden"));

    const target = document.getElementById(reportId + "Report");
    if (target) {
        target.classList.remove("hidden");
    }

    document.querySelectorAll(".reports-menu-link").forEach(link => link.classList.remove("active"));

    if (el) {
        el.classList.add("active");
    } else {
        const first = document.querySelector(".reports-menu-link");
        if (first) {
            first.classList.add("active");
        }
    }
}

function updateReports() {
    renderReports();
    showNotification("Отчет обновлен");
}

function filterReports() {
    renderReports();
}

function getExportQuery() {
    const dateFrom = document.getElementById("reportDateFrom")?.value || "";
    const dateTo = document.getElementById("reportDateTo")?.value || "";
    const projectId = document.getElementById("reportProjectFilter")?.value || "all";
    const employeeId = document.getElementById("employeeFilter")?.value || "all";

    const params = new URLSearchParams();

    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);
    if (projectId !== "all") params.append("projectId", projectId);
    if (employeeId !== "all") params.append("userId", employeeId);

    return params.toString();
}

function exportReport(type) {
    const q = getExportQuery();
    const urlBase = `/MainPage?${q ? q + "&" : ""}`;

    if (type === "csv") {
        window.location.href = urlBase + "handler=ExportCsv";
        return;
    }

    if (type === "excel") {
        window.location.href = urlBase + "handler=ExportExcel";
        return;
    }

    if (type === "word") {
        window.location.href = urlBase + "handler=ExportWord";
        return;
    }

    if (type === "pdf") {
        window.location.href = urlBase + "handler=ExportPdf";
        return;
    }

    if (type === "print") {
        window.print();
    }
}

function initReportsPage() {
    fillReportFilters();
    renderReports();
}

function fillReportFilters() {
    const employeeSelect = document.getElementById("employeeFilter");
    const projectSelect = document.getElementById("reportProjectFilter");

    if (employeeSelect) {
        const currentValue = employeeSelect.value || "all";

        employeeSelect.innerHTML =
            `<option value="all">Все сотрудники</option>` +
            users.map(u => `<option value="${u.id}">${u.fullName}</option>`).join("");

        if ([...employeeSelect.options].some(x => x.value === currentValue)) {
            employeeSelect.value = currentValue;
        }
    }

    if (projectSelect) {
        const currentValue = projectSelect.value || "all";

        projectSelect.innerHTML =
            `<option value="all">Все проекты</option>` +
            projects.map(p => `<option value="${p.id}">${p.name}</option>`).join("");

        if ([...projectSelect.options].some(x => x.value === currentValue)) {
            projectSelect.value = currentValue;
        }
    }
}

function renderReports() {
    const box = document.getElementById("reportsContent");
    if (!box) return;

    const data = buildReportsData();

    box.innerHTML = `
        <div id="dailyReport" class="report-card">
            <h3 style="margin-bottom:20px;">Ежедневный отчет</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.daily.totalHours)}</div>
                        <div class="stat-label">Часов отработано</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-tasks"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.daily.completedTasks}</div>
                        <div class="stat-label">Задач завершено</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-business-time"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.daily.overtime)}</div>
                        <div class="stat-label">Переработка</div>
                    </div>
                </div>
            </div>

            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Задача</th>
                            <th>Проект</th>
                            <th>Время</th>
                            <th>Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderEntryRows(data.daily.entries)}
                    </tbody>
                </table>
            </div>
        </div>

        <div id="weeklyReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Недельный отчет</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.weekly.totalHours)}</div>
                        <div class="stat-label">Часов отработано</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-tasks"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.weekly.completedTasks}</div>
                        <div class="stat-label">Задач завершено</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-business-time"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.weekly.overtime)}</div>
                        <div class="stat-label">Переработка</div>
                    </div>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-box">
                    <div class="chart-title">Активность по дням</div>
                    <div class="bar-chart">
                        ${renderBars(data.weekly.byDays)}
                    </div>
                </div>

                <div class="chart-box">
                    <div class="chart-title">Распределение по проектам</div>
                    <div class="bar-chart">
                        ${renderBars(data.weekly.byProjects)}
                    </div>
                </div>
            </div>
        </div>

        <div id="monthlyReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Месячный отчет</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.monthly.totalHours)}</div>
                        <div class="stat-label">Часов отработано</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-tasks"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.monthly.completedTasks}</div>
                        <div class="stat-label">Задач завершено</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-business-time"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.monthly.overtime)}</div>
                        <div class="stat-label">Переработка</div>
                    </div>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-box">
                    <div class="chart-title">Часы по проектам</div>
                    <div class="bar-chart">
                        ${renderBars(data.monthly.byProjects)}
                    </div>
                </div>

                <div class="chart-box">
                    <div class="chart-title">Часы по неделям</div>
                    <div class="bar-chart">
                        ${renderBars(data.monthly.byWeeks)}
                    </div>
                </div>
            </div>
        </div>

        <div id="performanceReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Анализ продуктивности</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.performance.efficiency}%</div>
                        <div class="stat-label">Общая эффективность</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.performance.overdueCount}</div>
                        <div class="stat-label">Просроченных задач</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-business-time"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.performance.overtime)}</div>
                        <div class="stat-label">Часов переработки</div>
                    </div>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-box">
                    <div class="chart-title">План / факт по часам</div>
                    <div class="bar-chart">
                        ${renderBars([
        { label: "План", value: data.performance.plannedHours },
        { label: "Факт", value: data.performance.actualHours }
    ])}
                    </div>
                </div>

                <div class="chart-box">
                    <div class="chart-title">Задачи по статусам</div>
                    <div class="bar-chart">
                        ${renderBars([
        { label: "Новые", value: data.performance.statuses.newCount },
        { label: "В работе", value: data.performance.statuses.progressCount },
        { label: "На проверке", value: data.performance.statuses.reviewCount },
        { label: "Завершены", value: data.performance.statuses.doneCount }
    ])}
                    </div>
                </div>
            </div>
        </div>

        <div id="overdueReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Просроченные задачи</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.overdue.count}</div>
                        <div class="stat-label">Всего просрочено</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.overdue.avgDelay}</div>
                        <div class="stat-label">Средняя просрочка, дней</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-user"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.overdue.assignees}</div>
                        <div class="stat-label">Сотрудников с просрочкой</div>
                    </div>
                </div>
            </div>

            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Задача</th>
                            <th>Проект</th>
                            <th>Исполнитель</th>
                            <th>Срок</th>
                            <th>Просрочка</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderOverdueRows(data.overdue.items)}
                    </tbody>
                </table>
            </div>
        </div>

        <div id="overtimeReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Переработки</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-business-time"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.overtime.total)}</div>
                        <div class="stat-label">Всего переработки</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-calendar-day"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatHoursValue(data.overtime.maxDay)}</div>
                        <div class="stat-label">Максимум за день</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-list"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.overtime.daysCount}</div>
                        <div class="stat-label">Дней с переработкой</div>
                    </div>
                </div>
            </div>

            <div class="chart-box">
                <div class="chart-title">Переработка по дням</div>
                <div class="bar-chart">
                    ${renderBars(data.overtime.byDays)}
                </div>
            </div>
        </div>

        <div id="bonusReport" class="report-card hidden">
            <h3 style="margin-bottom:20px;">Система бонусов</h3>

            <div class="stats-grid" style="margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-gift"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.bonus.percent}%</div>
                        <div class="stat-label">Рекомендованный бонус</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-ruble-sign"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${formatMoney(data.bonus.amount)}</div>
                        <div class="stat-label">Сумма бонуса</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-info">
                        <div class="stat-value">${data.bonus.reason}</div>
                        <div class="stat-label">Основание</div>
                    </div>
                </div>
            </div>

            <div class="chart-box">
                <div class="chart-title">Основа расчета</div>
                <div class="bar-chart">
                    ${renderBars([
        { label: "Эффективность", value: data.performance.efficiency },
        { label: "План часов", value: data.performance.plannedHours },
        { label: "Факт часов", value: data.performance.actualHours },
        { label: "Завершено задач", value: data.monthly.completedTasks }
    ])}
                </div>
            </div>
        </div>
    `;

    const activeLink = document.querySelector(".reports-menu-link.active");
    let activeId = "daily";

    if (activeLink) {
        const clickText = activeLink.getAttribute("onclick") || "";

        if (clickText.includes("showReport('daily'")) activeId = "daily";
        else if (clickText.includes("showReport('weekly'")) activeId = "weekly";
        else if (clickText.includes("showReport('monthly'")) activeId = "monthly";
        else if (clickText.includes("showReport('performance'")) activeId = "performance";
        else if (clickText.includes("showReport('overdue'")) activeId = "overdue";
        else if (clickText.includes("showReport('overtime'")) activeId = "overtime";
        else if (clickText.includes("showReport('bonus'")) activeId = "bonus";
    }

    document.querySelectorAll(".report-card").forEach(card => card.classList.add("hidden"));

    const activeCard = document.getElementById(activeId + "Report");
    if (activeCard) {
        activeCard.classList.remove("hidden");
    }
}

function buildReportsData() {
    const range = getReportDateRange();
    const entries = getFilteredEntries(range.from, range.to);
    const dayEntries = getEntriesForDay(range.to);
    const weekEntries = getEntriesForLastDays(range.to, 7);
    const monthEntries = entries;

    const scopedTasks = getFilteredTasks();
    const overdueItems = getOverdueTasks(scopedTasks);

    const selectedUser = getSelectedUser();
    const hourlyRate = selectedUser ? Number(selectedUser.hourlyRate || 0) : 0;

    const dailyHours = sumHours(dayEntries);
    const weeklyHours = sumHours(weekEntries);
    const monthlyHours = sumHours(monthEntries);

    const dailyOvertime = calculateOvertime(dayEntries);
    const weeklyOvertime = calculateOvertime(weekEntries);
    const monthlyOvertime = calculateOvertime(monthEntries);

    const monthlyCompleted = countCompletedWorkedTasks(monthEntries);
    const weeklyCompleted = countCompletedWorkedTasks(weekEntries);
    const dailyCompleted = countCompletedWorkedTasks(dayEntries);

    const plannedHours = scopedTasks.reduce((sum, t) => sum + Number(t.plannedTime || 0), 0);
    const actualHours = monthlyHours;

    const doneCount = scopedTasks.filter(t => t.status === "done").length;
    const allCount = scopedTasks.length;
    const completionRate = allCount > 0 ? Math.round((doneCount / allCount) * 100) : 0;
    const hourRate = plannedHours > 0 ? Math.min(100, Math.round((actualHours / plannedHours) * 100)) : 0;
    const efficiency = Math.round((completionRate + hourRate) / 2);

    let bonusPercent = 0;
    let bonusReason = "Нет";

    if (efficiency >= 85 && overdueItems.length === 0) {
        bonusPercent = 15;
        bonusReason = "Высокая эффективность";
    } else if (efficiency >= 70) {
        bonusPercent = 10;
        bonusReason = "Хорошие показатели";
    } else if (efficiency >= 50) {
        bonusPercent = 5;
        bonusReason = "Базовый бонус";
    }

    const bonusAmount = Math.round(actualHours * hourlyRate * bonusPercent / 100);

    return {
        daily: {
            totalHours: dailyHours,
            completedTasks: dailyCompleted,
            overtime: dailyOvertime,
            entries: mapEntriesWithTask(dayEntries)
        },
        weekly: {
            totalHours: weeklyHours,
            completedTasks: weeklyCompleted,
            overtime: weeklyOvertime,
            byDays: groupEntriesByDays(weekEntries),
            byProjects: groupEntriesByProjects(weekEntries)
        },
        monthly: {
            totalHours: monthlyHours,
            completedTasks: monthlyCompleted,
            overtime: monthlyOvertime,
            byProjects: groupEntriesByProjects(monthEntries),
            byWeeks: groupEntriesByWeeks(monthEntries, range.from)
        },
        performance: {
            efficiency: efficiency,
            overdueCount: overdueItems.length,
            overtime: monthlyOvertime,
            plannedHours: plannedHours,
            actualHours: actualHours,
            statuses: {
                newCount: scopedTasks.filter(t => t.status === "new").length,
                progressCount: scopedTasks.filter(t => t.status === "progress").length,
                reviewCount: scopedTasks.filter(t => t.status === "review").length,
                doneCount: scopedTasks.filter(t => t.status === "done").length
            }
        },
        overdue: {
            count: overdueItems.length,
            avgDelay: overdueItems.length
                ? Math.round(overdueItems.reduce((sum, x) => sum + x.delayDays, 0) / overdueItems.length)
                : 0,
            assignees: new Set(overdueItems.map(x => x.assignee || "")).size,
            items: overdueItems
        },
        overtime: {
            total: monthlyOvertime,
            maxDay: getMaxOvertimeDay(monthEntries),
            daysCount: getOvertimeDays(monthEntries).length,
            byDays: getOvertimeDays(monthEntries)
        },
        bonus: {
            percent: bonusPercent,
            amount: bonusAmount,
            reason: bonusReason
        }
    };
}

function getReportDateRange() {
    const fromInput = document.getElementById("reportDateFrom")?.value;
    const toInput = document.getElementById("reportDateTo")?.value;

    let from = fromInput ? new Date(fromInput + "T00:00:00") : new Date();
    let to = toInput ? new Date(toInput + "T23:59:59") : new Date();

    if (from > to) {
        const temp = from;
        from = to;
        to = temp;
    }

    return { from, to };
}

function parseEntryDate(value) {
    if (!value) return null;

    if (value.includes(".")) {
        const parts = value.split(".");
        if (parts.length === 3) {
            return new Date(parts[2], Number(parts[1]) - 1, parts[0], 12, 0, 0);
        }
    }

    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

function isInRange(date, from, to) {
    return date >= from && date <= to;
}

function getSelectedUser() {
    const value = document.getElementById("employeeFilter")?.value || "all";
    if (value === "all") return null;
    return users.find(u => String(u.id) === String(value)) || null;
}

function getFilteredTasks() {
    const selectedUser = getSelectedUser();
    const projectFilter = document.getElementById("reportProjectFilter")?.value || "all";

    return tasks.filter(t => {
        const projectMatch = projectFilter === "all" || String(t.projectId) === String(projectFilter);

        let userMatch = true;
        if (selectedUser) {
            const assignee = (t.assignee || "").toLowerCase();
            userMatch =
                assignee.includes((selectedUser.fullName || "").toLowerCase()) ||
                assignee.includes((selectedUser.login || "").toLowerCase()) ||
                assignee.includes((selectedUser.email || "").toLowerCase());
        }

        return projectMatch && userMatch;
    });
}

function getFilteredEntries(from, to) {
    const taskMap = getFilteredTasks();

    return timeEntries.filter(entry => {
        const entryDate = parseEntryDate(entry.date);
        if (!entryDate || !isInRange(entryDate, from, to)) {
            return false;
        }

        const task = tasks.find(t => (t.name || "").trim().toLowerCase() === (entry.task || "").trim().toLowerCase());
        if (!task) {
            return true;
        }

        return taskMap.some(x => Number(x.id) === Number(task.id));
    });
}

function getEntriesForDay(day) {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
    return getFilteredEntries(start, end);
}

function getEntriesForLastDays(day, days) {
    const start = new Date(day);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const end = new Date(day);
    end.setHours(23, 59, 59, 999);

    return getFilteredEntries(start, end);
}

function sumHours(entries) {
    return round2(entries.reduce((sum, x) => sum + Number(x.hours || 0), 0));
}

function round2(value) {
    return Math.round(Number(value || 0) * 100) / 100;
}

function calculateOvertime(entries) {
    return round2(
        getOvertimeDays(entries).reduce((sum, x) => sum + x.value, 0)
    );
}

function getOvertimeDays(entries) {
    const map = new Map();

    entries.forEach(entry => {
        const d = parseEntryDate(entry.date);
        if (!d) return;

        const key = d.toISOString().slice(0, 10);
        map.set(key, (map.get(key) || 0) + Number(entry.hours || 0));
    });

    return [...map.entries()]
        .map(([key, value]) => ({
            label: formatIsoDate(key),
            value: round2(Math.max(0, value - 8))
        }))
        .filter(x => x.value > 0)
        .sort((a, b) => a.label.localeCompare(b.label));
}

function getMaxOvertimeDay(entries) {
    const days = getOvertimeDays(entries);
    if (!days.length) return 0;
    return Math.max(...days.map(x => x.value));
}

function countCompletedWorkedTasks(entries) {
    const names = [...new Set(entries.map(x => (x.task || "").trim().toLowerCase()).filter(Boolean))];

    return tasks.filter(t =>
        t.status === "done" &&
        names.includes((t.name || "").trim().toLowerCase())
    ).length;
}

function mapEntriesWithTask(entries) {
    return entries.map(entry => {
        const task = tasks.find(t => (t.name || "").trim().toLowerCase() === (entry.task || "").trim().toLowerCase());

        return {
            task: entry.task || "Без задачи",
            project: task?.project || "Без проекта",
            hours: Number(entry.hours || 0),
            status: task?.status || "done"
        };
    });
}

function groupEntriesByDays(entries) {
    const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    const map = new Map();

    entries.forEach(entry => {
        const d = parseEntryDate(entry.date);
        if (!d) return;

        const label = dayNames[d.getDay()];
        map.set(label, round2((map.get(label) || 0) + Number(entry.hours || 0)));
    });

    const order = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

    return order
        .map(label => ({ label, value: map.get(label) || 0 }))
        .filter(x => x.value > 0);
}

function groupEntriesByProjects(entries) {
    const map = new Map();

    entries.forEach(entry => {
        const task = tasks.find(t => (t.name || "").trim().toLowerCase() === (entry.task || "").trim().toLowerCase());
        const projectName = task?.project || "Без проекта";

        map.set(projectName, round2((map.get(projectName) || 0) + Number(entry.hours || 0)));
    });

    return [...map.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
}

function groupEntriesByWeeks(entries, rangeStart) {
    const start = new Date(rangeStart);
    start.setHours(0, 0, 0, 0);

    const map = new Map();

    entries.forEach(entry => {
        const d = parseEntryDate(entry.date);
        if (!d) return;

        const diffDays = Math.floor((d - start) / (1000 * 60 * 60 * 24));
        const weekIndex = Math.floor(Math.max(diffDays, 0) / 7) + 1;
        const key = "Неделя " + weekIndex;

        map.set(key, round2((map.get(key) || 0) + Number(entry.hours || 0)));
    });

    return [...map.entries()].map(([label, value]) => ({ label, value }));
}

function getOverdueTasks(taskList) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return taskList
        .filter(t => t.deadlineRaw && t.status !== "done")
        .map(t => {
            const d = new Date(t.deadlineRaw + "T00:00:00");
            const diff = Math.floor((today - d) / (1000 * 60 * 60 * 24));

            return {
                name: t.name || "",
                project: t.project || "",
                assignee: t.assignee || "",
                deadline: t.deadline || "",
                delayDays: diff > 0 ? diff : 0
            };
        })
        .filter(x => x.delayDays > 0)
        .sort((a, b) => b.delayDays - a.delayDays);
}

function renderEntryRows(items) {
    if (!items.length) {
        return `<tr><td colspan="4" style="text-align:center; color:var(--gray);">Нет данных за выбранный период</td></tr>`;
    }

    return items.map(x => `
        <tr>
            <td>${escapeHtml(x.task)}</td>
            <td>${escapeHtml(x.project)}</td>
            <td>${formatHours(x.hours)}</td>
            <td><span class="badge ${getStatusClass(x.status)}">${getStatusText(x.status)}</span></td>
        </tr>
    `).join("");
}

function renderOverdueRows(items) {
    if (!items.length) {
        return `<tr><td colspan="5" style="text-align:center; color:var(--gray);">Просроченных задач нет</td></tr>`;
    }

    return items.map(x => `
        <tr>
            <td>${escapeHtml(x.name)}</td>
            <td>${escapeHtml(x.project)}</td>
            <td>${escapeHtml(x.assignee)}</td>
            <td>${escapeHtml(x.deadline)}</td>
            <td>${x.delayDays} дн.</td>
        </tr>
    `).join("");
}

function renderBars(items) {
    if (!items.length) {
        return `<div style="color:var(--gray);">Нет данных</div>`;
    }

    const max = Math.max(...items.map(x => Number(x.value || 0)), 1);

    return items.map(item => {
        const width = Math.max(4, Math.round((Number(item.value || 0) / max) * 100));

        return `
            <div class="bar-item">
                <div class="bar-label">${escapeHtml(item.label)}</div>
                <div class="bar-progress">
                    <div class="bar-fill" style="width:${width}%;"></div>
                </div>
                <div class="bar-value">${formatBarValue(item.value)}</div>
            </div>
        `;
    }).join("");
}

function formatBarValue(value) {
    if (Number.isInteger(value)) {
        return String(value);
    }

    return formatHoursValue(value) + " ч";
}

function formatHours(value) {
    return `${formatHoursValue(value)} ч`;
}

function formatHoursValue(value) {
    return round2(value).toFixed(1).replace(".0", "");
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("ru-RU");
}

function formatIsoDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("ru-RU");
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function exportReportsCsv() {
    const data = buildReportsData();

    const rows = [
        ["Тип", "Показатель", "Значение"],
        ["Ежедневный", "Часы", formatHoursValue(data.daily.totalHours)],
        ["Ежедневный", "Задач завершено", data.daily.completedTasks],
        ["Ежедневный", "Переработка", formatHoursValue(data.daily.overtime)],
        ["Недельный", "Часы", formatHoursValue(data.weekly.totalHours)],
        ["Недельный", "Задач завершено", data.weekly.completedTasks],
        ["Недельный", "Переработка", formatHoursValue(data.weekly.overtime)],
        ["Месячный", "Часы", formatHoursValue(data.monthly.totalHours)],
        ["Месячный", "Задач завершено", data.monthly.completedTasks],
        ["Месячный", "Переработка", formatHoursValue(data.monthly.overtime)],
        ["Продуктивность", "Эффективность", data.performance.efficiency + "%"],
        ["Продуктивность", "Просрочено", data.performance.overdueCount],
        ["Бонус", "Процент", data.bonus.percent + "%"],
        ["Бонус", "Сумма", formatMoney(data.bonus.amount)]
    ];

    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "reports.csv";
    a.click();

    URL.revokeObjectURL(url);
}