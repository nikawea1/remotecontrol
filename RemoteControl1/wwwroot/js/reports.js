// Файл: RemoteControl1/wwwroot/js/reports.js

let currentReportChartPeriod = "weekly";
let lastReportsData = null;

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

function formatReportDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function ensureDefaultReportRange() {
    const fromInput = document.getElementById("reportDateFrom");
    const toInput = document.getElementById("reportDateTo");

    if (!fromInput || !toInput) return;
    if (fromInput.value && toInput.value) return;

    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 30);

    if (!fromInput.value) {
        fromInput.value = formatReportDateInputValue(from);
    }

    if (!toInput.value) {
        toInput.value = formatReportDateInputValue(today);
    }
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

function exportReportsCsv() {
    exportReport("csv");
}

function fillReportFilters() {
    const employeeSelect = document.getElementById("employeeFilter");
    const projectSelect = document.getElementById("reportProjectFilter");
    const sourceUsers = Array.isArray(window.users) ? window.users : [];
    const sourceProjects = Array.isArray(window.projects) ? window.projects : [];

    if (employeeSelect) {
        const currentValue = employeeSelect.value || "all";

        employeeSelect.innerHTML =
            `<option value="all">Все сотрудники</option>` +
            sourceUsers.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.fullName)}</option>`).join("");

        if ([...employeeSelect.options].some(x => x.value === currentValue)) {
            employeeSelect.value = currentValue;
        }
    }

    if (projectSelect) {
        const currentValue = projectSelect.value || "all";

        projectSelect.innerHTML =
            `<option value="all">Все проекты</option>` +
            sourceProjects.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("");

        if ([...projectSelect.options].some(x => x.value === currentValue)) {
            projectSelect.value = currentValue;
        }
    }
}

function getActiveReportId() {
    const activeLink = document.querySelector(".reports-menu-link.active");
    const clickText = activeLink?.getAttribute("onclick") || "";
    const match = clickText.match(/showReport\('([^']+)'/);
    return match?.[1] || "overview";
}

function showReport(reportId, el) {
    const safeReportId = reportId || "overview";
    const cards = document.querySelectorAll("#reportsContent .report-card");

    cards.forEach(card => {
        card.classList.add("hidden");
    });

    const target = document.getElementById(safeReportId + "Report");
    if (target) {
        target.classList.remove("hidden");
    }

    document.querySelectorAll(".reports-menu-link").forEach(link => {
        link.classList.remove("active");
    });

    if (el) {
        el.classList.add("active");
    } else {
        document.querySelectorAll(".reports-menu-link").forEach(link => {
            const clickText = link.getAttribute("onclick") || "";
            if (clickText.includes(`showReport('${safeReportId}'`)) {
                link.classList.add("active");
            }
        });
    }

    return false;
}

function setReportChartPeriod(period, el) {
    currentReportChartPeriod = period || "weekly";

    document.querySelectorAll(".report-period-btn").forEach(btn => {
        btn.classList.toggle("active", btn === el || btn.dataset.period === currentReportChartPeriod);
    });

    if (lastReportsData) {
        renderReports(lastReportsData);
    }

    return false;
}

async function loadReportsFromServer() {
    const dateFrom = document.getElementById("reportDateFrom")?.value || "";
    const dateTo = document.getElementById("reportDateTo")?.value || "";
    const projectId = document.getElementById("reportProjectFilter")?.value || "all";
    const employeeId = document.getElementById("employeeFilter")?.value || "all";

    const params = new URLSearchParams();

    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);
    if (projectId !== "all") params.append("projectId", projectId);
    if (employeeId !== "all") params.append("employeeId", employeeId);

    const url = `/MainPage?handler=ReportsData${params.toString() ? "&" + params.toString() : ""}`.replace("?&", "?");

    const res = await fetch(url, {
        headers: {
            "RequestVerificationToken": getRequestVerificationToken()
        }
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Не удалось загрузить отчёты");
    }

    return data.data;
}

async function updateReports() {
    try {
        const data = await loadReportsFromServer();
        renderReports(data);
    } catch (e) {
        console.error(e);

        const box = document.getElementById("reportsContent");
        if (box) {
            box.innerHTML = `<div class="report-error">Не удалось загрузить отчёты</div>`;
        }

        if (typeof showNotification === "function") {
            showNotification("Не удалось загрузить отчет");
        }
    }
}

function filterReports() {
    updateReports();
}

function initReportsPage() {
    ensureDefaultReportRange();
    fillReportFilters();
    updateReports();
}

function renderReports(data) {
    const box = document.getElementById("reportsContent");
    if (!box) return;

    lastReportsData = normalizeReportsData(data);
    const activeId = getActiveReportId();

    box.innerHTML = `
        ${renderOverviewReport(lastReportsData)}
        ${renderWorkReport(lastReportsData)}
        ${renderProjectsReport(lastReportsData)}
        ${renderPerformanceReport(lastReportsData)}
        ${renderOverdueReport(lastReportsData)}
        ${renderOvertimeReport(lastReportsData)}
        ${renderBonusReport(lastReportsData)}
    `;

    showReport(activeId);
}

function normalizeReportsData(data) {
    const safe = data || {};
    return {
        daily: safe.daily || { totalHours: 0, completedTasks: 0, overtime: 0, entries: [] },
        weekly: safe.weekly || { totalHours: 0, completedTasks: 0, overtime: 0, entries: [], byDays: [], byProjects: [] },
        monthly: safe.monthly || { totalHours: 0, completedTasks: 0, overtime: 0, entries: [], byProjects: [], byWeeks: [] },
        performance: safe.performance || {},
        overdue: safe.overdue || { items: [] },
        overtime: safe.overtime || { byDays: [] },
        bonus: safe.bonus || {}
    };
}

function renderOverviewReport(data) {
    return `
        <section id="overviewReport" class="report-card">
            ${renderReportHeader("Сводка отчетности", "Ключевые показатели по выбранным фильтрам")}
            ${renderSummaryStats(data)}
            ${renderChartHub(data)}
            ${renderStatusDistribution(data)}
        </section>
    `;
}

function renderWorkReport(data) {
    return `
        <section id="workReport" class="report-card hidden">
            ${renderReportHeader("Время и задачи", "Динамика часов, задач и дневных записей")}
            ${renderPeriodStats(data)}
            ${renderChartHub(data)}
            ${renderEntriesTable(data.daily.entries || [])}
        </section>
    `;
}

function renderProjectsReport(data) {
    const projectRows = getProjectRows(data);

    return `
        <section id="projectsReport" class="report-card hidden">
            ${renderReportHeader("Проекты", "Часы, завершение задач и вклад проектов")}
            <div class="report-split">
                <div class="report-panel">
                    <div class="chart-title">Часы по проектам</div>
                    ${renderHorizontalBars(data.monthly.byProjects || [], formatHoursValue)}
                </div>
                <div class="report-panel">
                    <div class="chart-title">Доля проектов</div>
                    ${renderColumnChart(data.monthly.byProjects || [], formatHoursValue)}
                </div>
            </div>
            <div class="table-container reports-table-container">
                <table class="table reports-table">
                    <thead>
                        <tr>
                            <th>Проект</th>
                            <th>Часы</th>
                            <th>Задачи</th>
                            <th>Завершено</th>
                            <th>Прогресс</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${projectRows.length ? projectRows.map(renderProjectRow).join("") : renderEmptyRow(5)}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderPerformanceReport(data) {
    const perf = data.performance;
    const stats = [
        { icon: "fa-bolt", value: `${num(perf.efficiency)}%`, label: "Эффективность", tone: "blue" },
        { icon: "fa-list-check", value: num(perf.doneCount), label: "Завершено задач", tone: "green" },
        { icon: "fa-spinner", value: num(perf.progressCount), label: "В работе", tone: "amber" },
        { icon: "fa-triangle-exclamation", value: num(perf.overdueCount), label: "Просрочено", tone: "red" }
    ];

    return `
        <section id="performanceReport" class="report-card hidden">
            ${renderReportHeader("Продуктивность", "План, факт и состояние задач")}
            ${renderStatGrid(stats)}
            ${renderStatusDistribution(data)}
        </section>
    `;
}

function renderOverdueReport(data) {
    const overdue = data.overdue;
    const stats = [
        { icon: "fa-exclamation-circle", value: num(overdue.count), label: "Просроченных задач", tone: "red" },
        { icon: "fa-calendar-times", value: num(overdue.averageDelay), label: "Средняя задержка, дней", tone: "amber" },
        { icon: "fa-user-group", value: num(overdue.assignees), label: "Сотрудников с просрочками", tone: "blue" }
    ];

    return `
        <section id="overdueReport" class="report-card hidden">
            ${renderReportHeader("Просрочки", "Риски по дедлайнам и исполнителям")}
            ${renderStatGrid(stats)}
            <div class="table-container reports-table-container">
                <table class="table reports-table">
                    <thead>
                        <tr>
                            <th>Задача</th>
                            <th>Проект</th>
                            <th>Исполнитель</th>
                            <th>Дедлайн</th>
                            <th>Просрочка</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(overdue.items || []).length ? overdue.items.map(item => `
                            <tr>
                                <td>${escapeHtml(item.name)}</td>
                                <td>${escapeHtml(item.project)}</td>
                                <td>${escapeHtml(item.assignee)}</td>
                                <td>${escapeHtml(item.deadline)}</td>
                                <td>${num(item.delayDays)} дн.</td>
                            </tr>
                        `).join("") : renderEmptyRow(5)}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderOvertimeReport(data) {
    const overtime = data.overtime;
    const stats = [
        { icon: "fa-clock", value: formatHoursValue(overtime.total), label: "Всего переработки", tone: "amber" },
        { icon: "fa-arrow-up", value: formatHoursValue(overtime.maxDay), label: "Максимум за день", tone: "red" },
        { icon: "fa-calendar-day", value: num(overtime.daysCount), label: "Дней с переработкой", tone: "blue" }
    ];

    return `
        <section id="overtimeReport" class="report-card hidden">
            ${renderReportHeader("Переработки", "Сверхурочные часы по выбранному периоду")}
            ${renderStatGrid(stats)}
            <div class="report-panel">
                <div class="chart-title">Переработки по дням</div>
                ${renderHorizontalBars(overtime.byDays || [], formatHoursValue)}
            </div>
        </section>
    `;
}

function renderBonusReport(data) {
    const bonus = data.bonus;
    const perf = data.performance;
    const reason = String(bonus.reason || "Нет основания для бонуса");

    return `
        <section id="bonusReport" class="report-card hidden">
            ${renderReportHeader("Система бонусов", "Расчет основан на плане, факте, завершении задач и просрочках")}
            <div class="bonus-report-grid">
                <div class="bonus-score-card">
                    <div class="bonus-score-ring" style="--score:${clamp(num(bonus.percent), 0, 20) * 5}%">
                        <span>${num(bonus.percent)}%</span>
                    </div>
                    <div>
                        <div class="bonus-score-title">Рекомендованный бонус</div>
                        <div class="bonus-score-money">${formatMoneyValue(bonus.amount)}</div>
                    </div>
                </div>
                <div class="bonus-reason-panel">
                    <div class="chart-title">Основание</div>
                    <p>${escapeHtml(reason)}</p>
                </div>
            </div>
            <div class="bonus-factors-grid">
                ${renderBonusFactor("Плановые часы", formatHoursValue(perf.plannedHours), "fa-clipboard-list")}
                ${renderBonusFactor("Фактические часы", formatHoursValue(perf.actualHours), "fa-clock")}
                ${renderBonusFactor("Эффективность", `${num(perf.efficiency)}%`, "fa-bolt")}
                ${renderBonusFactor("Просрочки", num(perf.overdueCount), "fa-triangle-exclamation")}
            </div>
        </section>
    `;
}

function renderReportHeader(title, subtitle) {
    return `
        <div class="report-card-header">
            <div>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(subtitle)}</p>
            </div>
            <span>${escapeHtml(getReportRangeLabel())}</span>
        </div>
    `;
}

function renderSummaryStats(data) {
    const stats = [
        { icon: "fa-clock", value: formatHoursValue(data.monthly.totalHours), label: "Всего часов", tone: "blue" },
        { icon: "fa-circle-check", value: num(data.monthly.completedTasks), label: "Завершено задач", tone: "green" },
        { icon: "fa-chart-line", value: `${num(data.performance.efficiency)}%`, label: "Продуктивность", tone: "violet" },
        { icon: "fa-business-time", value: formatHoursValue(data.overtime.total), label: "Переработка", tone: "amber" }
    ];

    return renderStatGrid(stats);
}

function renderPeriodStats(data) {
    const stats = [
        { icon: "fa-calendar-day", value: formatHoursValue(data.daily.totalHours), label: "День", tone: "blue" },
        { icon: "fa-calendar-week", value: formatHoursValue(data.weekly.totalHours), label: "Неделя", tone: "green" },
        { icon: "fa-calendar-days", value: formatHoursValue(data.monthly.totalHours), label: "Период", tone: "violet" },
        { icon: "fa-list-check", value: num(data.weekly.completedTasks), label: "Задач за неделю", tone: "amber" }
    ];

    return renderStatGrid(stats);
}

function renderStatGrid(stats) {
    return `
        <div class="report-stats-grid">
            ${stats.map(stat => `
                <div class="report-stat-card report-stat-${stat.tone}">
                    <div class="report-stat-icon"><i class="fas ${escapeHtml(stat.icon)}"></i></div>
                    <div class="report-stat-body">
                        <div class="report-stat-value">${escapeHtml(stat.value)}</div>
                        <div class="report-stat-label">${escapeHtml(stat.label)}</div>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

function renderChartHub(data) {
    const hourSeries = getHourSeries(data, currentReportChartPeriod);
    const taskSeries = getTaskSeries(data, currentReportChartPeriod);

    return `
        <div class="report-visual-layout">
            ${renderChartPeriodRail()}
            <div class="report-visual-main">
                <div class="report-panel report-panel-large">
                    <div class="chart-title">${escapeHtml(getPeriodChartTitle(currentReportChartPeriod, "hours"))}</div>
                    ${renderColumnChart(hourSeries, formatHoursValue)}
                </div>
                <div class="report-panel report-panel-large">
                    <div class="chart-title">${escapeHtml(getPeriodChartTitle(currentReportChartPeriod, "tasks"))}</div>
                    ${renderLineChart(taskSeries)}
                </div>
            </div>
        </div>
    `;
}

function renderChartPeriodRail() {
    const periods = [
        { id: "daily", icon: "fa-calendar-day", label: "День" },
        { id: "weekly", icon: "fa-calendar-week", label: "Неделя" },
        { id: "monthly", icon: "fa-calendar-days", label: "Месяц" },
        { id: "projects", icon: "fa-diagram-project", label: "Проекты" }
    ];

    return `
        <div class="report-period-rail" aria-label="Период графиков">
            ${periods.map(period => `
                <button type="button"
                    class="report-period-btn ${period.id === currentReportChartPeriod ? "active" : ""}"
                    data-period="${period.id}"
                    onclick="return setReportChartPeriod('${period.id}', this)">
                    <i class="fas ${period.icon}"></i>
                    <span>${period.label}</span>
                </button>
            `).join("")}
        </div>
    `;
}

function renderColumnChart(items, formatter) {
    const clean = normalizeChartItems(items);

    if (!clean.length) {
        return renderEmptyState();
    }

    const max = Math.max(...clean.map(x => x.value), 1);

    return `
        <div class="report-column-chart" style="--chart-count:${clean.length}">
            ${clean.map(item => {
                const height = Math.max(8, Math.round(item.value / max * 100));
                return `
                    <div class="report-column-item" title="${escapeHtml(item.label)}: ${escapeHtml(formatter(item.value))}">
                        <div class="report-column-value">${escapeHtml(formatter(item.value))}</div>
                        <div class="report-column-track">
                            <div class="report-column-fill" style="height:${height}%"></div>
                        </div>
                        <div class="report-column-label">${escapeHtml(item.label)}</div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function renderLineChart(items) {
    const clean = normalizeChartItems(items);

    if (!clean.length) {
        return renderEmptyState();
    }

    const max = Math.max(...clean.map(x => x.value), 1);
    const width = 640;
    const height = 230;
    const padX = 32;
    const padY = 28;
    const graphW = width - padX * 2;
    const graphH = height - padY * 2;
    const points = clean.map((item, index) => {
        const x = clean.length === 1 ? width / 2 : padX + (graphW / (clean.length - 1)) * index;
        const y = padY + graphH - (item.value / max) * graphH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    return `
        <div class="report-line-chart">
            <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Линейный график">
                <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" class="report-chart-axis"></line>
                <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" class="report-chart-axis"></line>
                <polyline points="${points}" class="report-line-path"></polyline>
                ${clean.map((item, index) => {
                    const point = points.split(" ")[index].split(",");
                    return `<circle cx="${point[0]}" cy="${point[1]}" r="5" class="report-line-dot"><title>${escapeHtml(item.label)}: ${num(item.value)}</title></circle>`;
                }).join("")}
            </svg>
            <div class="report-line-labels">
                ${clean.map(item => `<span>${escapeHtml(item.label)}</span>`).join("")}
            </div>
        </div>
    `;
}

function renderHorizontalBars(items, formatter) {
    const clean = normalizeChartItems(items);

    if (!clean.length) {
        return renderEmptyState();
    }

    const max = Math.max(...clean.map(x => x.value), 1);

    return `
        <div class="report-bars">
            ${clean.map(item => {
                const width = Math.max(4, Math.round(item.value / max * 100));
                return `
                    <div class="report-bar-row">
                        <div class="report-bar-label">${escapeHtml(item.label)}</div>
                        <div class="report-bar-track">
                            <div class="report-bar-fill" style="width:${width}%"></div>
                        </div>
                        <div class="report-bar-value">${escapeHtml(formatter(item.value))}</div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function renderStatusDistribution(data) {
    const perf = data.performance;
    const segments = [
        { label: "Новые", value: num(perf.newCount), color: "#60a5fa" },
        { label: "В работе", value: num(perf.progressCount), color: "#f59e0b" },
        { label: "На проверке", value: num(perf.reviewCount), color: "#8b5cf6" },
        { label: "Готово", value: num(perf.doneCount), color: "#22c55e" }
    ];
    const total = segments.reduce((sum, item) => sum + item.value, 0);
    let cursor = 0;
    const gradient = total > 0
        ? segments.map(item => {
            const start = cursor;
            cursor += item.value / total * 360;
            return `${item.color} ${start}deg ${cursor}deg`;
        }).join(", ")
        : "#e5e7eb 0deg 360deg";

    return `
        <div class="report-panel status-panel">
            <div class="chart-title">Статусы задач</div>
            <div class="status-chart-layout">
                <div class="status-donut" style="background:conic-gradient(${gradient})">
                    <span>${total}</span>
                </div>
                <div class="status-legend">
                    ${segments.map(item => `
                        <div class="status-legend-row">
                            <i style="background:${item.color}"></i>
                            <span>${escapeHtml(item.label)}</span>
                            <strong>${item.value}</strong>
                        </div>
                    `).join("")}
                </div>
            </div>
        </div>
    `;
}

function renderEntriesTable(entries) {
    return `
        <div class="table-container reports-table-container">
            <table class="table reports-table">
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Задача</th>
                        <th>Проект</th>
                        <th>Часы</th>
                        <th>Комментарий</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
                    ${(entries || []).length ? entries.map(item => `
                        <tr>
                            <td>${escapeHtml(item.date)}</td>
                            <td>${escapeHtml(item.task)}</td>
                            <td>${escapeHtml(item.project)}</td>
                            <td>${formatHoursValue(item.hours)}</td>
                            <td>${escapeHtml(item.comment || "—")}</td>
                            <td>${escapeHtml(item.status || "—")}</td>
                        </tr>
                    `).join("") : renderEmptyRow(6)}
                </tbody>
            </table>
        </div>
    `;
}

function renderProjectRow(project) {
    return `
        <tr>
            <td>${escapeHtml(project.name)}</td>
            <td>${formatHoursValue(project.hours)}</td>
            <td>${project.tasks}</td>
            <td>${project.completed}</td>
            <td>
                <div class="report-progress-cell">
                    <span><i style="width:${project.progress}%"></i></span>
                    <strong>${project.progress}%</strong>
                </div>
            </td>
        </tr>
    `;
}

function renderBonusFactor(label, value, icon) {
    return `
        <div class="bonus-factor">
            <i class="fas ${escapeHtml(icon)}"></i>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
        </div>
    `;
}

function getHourSeries(data, period) {
    if (period === "daily") {
        return groupEntries(data.daily.entries || [], "task", "hours");
    }

    if (period === "monthly") {
        return data.monthly.byWeeks || [];
    }

    if (period === "projects") {
        return data.monthly.byProjects || [];
    }

    return data.weekly.byDays || [];
}

function getTaskSeries(data, period) {
    if (period === "daily") {
        return groupEntries(data.daily.entries || [], "task", "count");
    }

    if (period === "monthly") {
        return groupEntriesByWeek(data.monthly.entries || []);
    }

    if (period === "projects") {
        return groupEntries(data.monthly.entries || [], "project", "count");
    }

    return groupEntriesByDay(data.weekly.entries || []);
}

function groupEntries(entries, field, mode) {
    const map = new Map();

    (entries || []).forEach(entry => {
        const label = entry[field] || "Без данных";
        const current = map.get(label) || 0;
        map.set(label, current + (mode === "hours" ? num(entry.hours) : 1));
    });

    return [...map.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
}

function groupEntriesByDay(entries) {
    const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    const order = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const map = new Map(order.map(day => [day, 0]));

    (entries || []).forEach(entry => {
        const date = parseReportDate(entry.date);
        const label = date ? dayNames[date.getDay()] : "—";
        map.set(label, (map.get(label) || 0) + 1);
    });

    return order.map(label => ({ label, value: map.get(label) || 0 }));
}

function groupEntriesByWeek(entries) {
    const from = getReportRangeStartDate();
    const map = new Map();

    (entries || []).forEach(entry => {
        const date = parseReportDate(entry.date);
        const diffDays = date ? Math.max(0, Math.floor((date - from) / 86400000)) : 0;
        const label = `Неделя ${Math.floor(diffDays / 7) + 1}`;
        map.set(label, (map.get(label) || 0) + 1);
    });

    return [...map.entries()].map(([label, value]) => ({ label, value }));
}

function getProjectRows(data) {
    const sourceTasks = Array.isArray(window.tasks) ? window.tasks : [];
    const projectHours = normalizeChartItems(data.monthly.byProjects || []);

    return projectHours.map(item => {
        const matchingTasks = sourceTasks.filter(task => (task.project || "Без проекта") === item.label);
        const completed = matchingTasks.filter(task => isDoneStatus(task.status)).length;
        const total = matchingTasks.length;

        return {
            name: item.label,
            hours: item.value,
            tasks: total,
            completed,
            progress: total > 0 ? Math.round(completed / total * 100) : 0
        };
    });
}

function getPeriodChartTitle(period, chart) {
    const map = {
        daily: chart === "hours" ? "Часы по задачам за день" : "Активность по задачам за день",
        weekly: chart === "hours" ? "Часы по дням недели" : "Задачи по дням недели",
        monthly: chart === "hours" ? "Часы по неделям" : "Задачи по неделям",
        projects: chart === "hours" ? "Часы по проектам" : "Задачи по проектам"
    };

    return map[period] || map.weekly;
}

function normalizeChartItems(items) {
    return (items || [])
        .map(item => ({
            label: String(item.label || item.name || "Без данных"),
            value: num(item.value ?? item.hours ?? item.count)
        }))
        .filter(item => item.value > 0)
        .slice(0, 10);
}

function renderEmptyRow(colspan) {
    return `<tr><td colspan="${colspan}" class="reports-empty-cell">Нет данных</td></tr>`;
}

function renderEmptyState() {
    return `<div class="reports-empty-state">Нет данных</div>`;
}

function getReportRangeLabel() {
    const from = document.getElementById("reportDateFrom")?.value || "";
    const to = document.getElementById("reportDateTo")?.value || "";

    if (!from && !to) return "Период не задан";
    if (from && to) return `${formatUiDate(from)} — ${formatUiDate(to)}`;
    return from ? `с ${formatUiDate(from)}` : `до ${formatUiDate(to)}`;
}

function formatUiDate(value) {
    const parts = String(value).split("-");
    if (parts.length !== 3) return value;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function getReportRangeStartDate() {
    const value = document.getElementById("reportDateFrom")?.value || "";
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
}

function parseReportDate(value) {
    const match = String(value || "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!match) return null;
    return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

function isDoneStatus(status) {
    const value = String(status || "").toLowerCase();
    return ["done", "completed", "complete", "готово", "завершено"].includes(value);
}

function num(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatHoursValue(value) {
    return `${num(value).toFixed(2)} ч`;
}

function formatMoneyValue(value) {
    return `${num(value).toFixed(2)} BYN`;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[char]);
}
