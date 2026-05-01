// Файл: RemoteControl1/wwwroot/js/calendar.js

const calendarState = {
    events: Array.isArray(window.remoteControlData?.calendarEvents)
        ? window.remoteControlData.calendarEvents.map(normalizeCalendarEvent)
        : [],
    currentDate: new Date(),
    selectedDate: new Date(),
    miniYear: new Date().getFullYear()
};

function normalizeCalendarEvent(ev) {
    const eventDate = new Date(ev.eventDate || ev.EventDate || ev.date || new Date());
    const rawId = ev.id ?? ev.Id ?? Date.now();
    const normalizedId = Number(rawId);

    return {
        id: Number.isFinite(normalizedId) ? normalizedId : Date.now(),
        title: ev.title ?? ev.Title ?? "Без названия",
        description: ev.description ?? ev.Description ?? "",
        eventType: (ev.eventType ?? ev.EventType ?? ev.type ?? "meeting").toLowerCase(),
        eventDate: eventDate.toISOString(),
        projectId: ev.projectId ?? ev.ProjectId ?? null,
        projectName: ev.projectName ?? ev.ProjectName ?? "",
        locationOrLink: ev.locationOrLink ?? ev.LocationOrLink ?? "",
        source: ev.source ?? ev.Source ?? "calendar",
        isReadOnly: Boolean(ev.isReadOnly ?? ev.IsReadOnly ?? false),
        canManage: Boolean(ev.canManage ?? ev.CanManage ?? false),
        taskId: ev.taskId ?? ev.TaskId ?? null,
        taskStatus: ev.taskStatus ?? ev.TaskStatus ?? ""
    };
}

function initCalendarPage() {
    renderCalendarPage();
    renderCalendarSidebar();
    renderMiniCalendarMonths();
    fillCalendarProjectSelect();
    loadCalendarEvents();
}

async function loadCalendarEvents() {
    try {
        const res = await fetch("/Calendar?handler=Events");
        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось синхронизировать календарь");
            return;
        }

        calendarState.events = Array.isArray(data.items)
            ? data.items.map(normalizeCalendarEvent)
            : [];

        renderCalendarPage();
        renderCalendarSidebar();
    } catch {
        showNotification("Ошибка синхронизации календаря");
    }
}

function renderCalendarPage() {
    const title = document.getElementById("calendarPageMonthTitle");
    const grid = document.getElementById("calendarGridMain");

    if (!title || !grid) return;

    const monthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ];

    const year = calendarState.currentDate.getFullYear();
    const month = calendarState.currentDate.getMonth();

    title.textContent = `${monthNames[month]} ${year} г.`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let firstWeekDay = firstDay.getDay();
    if (firstWeekDay === 0) firstWeekDay = 7;

    const daysInMonth = lastDay.getDate();
    let html = "";

    for (let i = 1; i < firstWeekDay; i++) {
        html += `<div class="calendar-day empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        const dateStr = formatCalendarDate(dateObj);
        const dayEvents = getEventsForDate(dateStr);

        const isSelected = formatCalendarDate(calendarState.selectedDate) === dateStr;
        const isToday = formatCalendarDate(new Date()) === dateStr;

        const visibleEvents = dayEvents.slice(0, 2);
        const hiddenCount = Math.max(0, dayEvents.length - 2);

        html += `
            <div class="calendar-day ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}"
                 onclick="selectCalendarDate('${dateStr}')">
                <div class="calendar-day-number">${day}</div>

                <div class="calendar-day-items">
                    ${visibleEvents.map(ev => `
                        <div
                            class="calendar-event-badge ${getCalendarEventClass(ev.eventType)}"
                            title="${escapeHtml(`${formatCalendarTime(ev.eventDate)} — ${ev.title || "Событие"}`)}">
                            <span class="calendar-event-time">${formatCalendarTime(ev.eventDate)}</span>
                        </div>
                    `).join("")}
                </div>

                ${hiddenCount > 0 ? `
                    <div class="calendar-more-events" title="Ещё событий: ${hiddenCount}">
                        •••
                    </div>
                ` : ""}
            </div>
        `;
    }

    grid.innerHTML = html;
}

function renderCalendarSidebar() {
    const dateText = document.getElementById("selectedCalendarDateText");
    const list = document.getElementById("calendarEventsListMain");

    if (!dateText || !list) return;

    const dateStr = formatCalendarDate(calendarState.selectedDate);
    const events = getEventsForDate(dateStr);

    dateText.textContent = `Дата: ${formatCalendarDateRu(calendarState.selectedDate)}`;

    if (!events.length) {
        list.innerHTML = `
            <div class="empty-state">
                На выбранную дату событий нет
            </div>
        `;
        return;
    }

    list.innerHTML = events.map(ev => `
        <div class="calendar-side-item">
            <div class="calendar-side-title">${escapeHtml(ev.title || "Без названия")}</div>
            <div class="calendar-side-time">
                <i class="far fa-clock"></i> ${formatCalendarDateTime(ev.eventDate)}
            </div>
            <div class="calendar-side-type ${getCalendarEventClass(ev.eventType)}">
                ${getCalendarEventTypeText(ev.eventType)}
            </div>
            ${ev.description ? `<div class="calendar-side-desc">${escapeHtml(ev.description)}</div>` : ""}
            ${ev.locationOrLink ? `
                <div class="calendar-side-link">
                    <i class="fas fa-location-dot"></i>
                    ${escapeHtml(ev.locationOrLink)}
                </div>
            ` : ""}
            ${ev.projectName ? `
                <div class="calendar-side-link">
                    <i class="fas fa-folder"></i>
                    ${escapeHtml(ev.projectName)}
                </div>
            ` : ""}
            ${ev.source === "task" ? `
                <div class="calendar-side-link">
                    <i class="fas fa-lock"></i>
                    Системное событие из дедлайна задачи
                </div>
            ` : ""}
            ${ev.canManage && !ev.isReadOnly ? `
                <div class="calendar-side-actions">
                    <button class="btn btn-sm btn-outline" type="button" onclick="openEditCalendarEvent(${ev.id})">
                        <i class="fas fa-pen-to-square"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" type="button" onclick="deleteCalendarEvent(${ev.id})">
                        <i class="fas fa-trash-can"></i>
                    </button>
                </div>
            ` : ""}
        </div>
    `).join("");
}

function selectCalendarDate(dateStr) {
    calendarState.selectedDate = new Date(`${dateStr}T00:00:00`);
    renderCalendarPage();
    renderCalendarSidebar();
}

function prevCalendarMonth() {
    calendarState.currentDate = new Date(
        calendarState.currentDate.getFullYear(),
        calendarState.currentDate.getMonth() - 1,
        1
    );

    renderCalendarPage();
    renderMiniCalendarMonths();
}

function nextCalendarMonth() {
    calendarState.currentDate = new Date(
        calendarState.currentDate.getFullYear(),
        calendarState.currentDate.getMonth() + 1,
        1
    );

    renderCalendarPage();
    renderMiniCalendarMonths();
}

function toggleMiniCalendar() {
    const popup = document.getElementById("miniCalendarPopup");
    if (!popup) return;

    popup.classList.toggle("hidden");
}

function changeMiniCalendarYear(step) {
    calendarState.miniYear += step;
    renderMiniCalendarMonths();
}

function renderMiniCalendarMonths() {
    const yearLabel = document.getElementById("miniCalendarYearLabel");
    const monthsWrap = document.getElementById("miniCalendarMonths");

    if (!yearLabel || !monthsWrap) return;

    yearLabel.textContent = calendarState.miniYear;

    const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

    monthsWrap.innerHTML = months.map((m, index) => `
        <button type="button" class="mini-calendar-month-btn" onclick="pickMiniCalendarMonth(${index})">
            ${m}
        </button>
    `).join("");
}

function pickMiniCalendarMonth(monthIndex) {
    calendarState.currentDate = new Date(calendarState.miniYear, monthIndex, 1);

    const popup = document.getElementById("miniCalendarPopup");
    if (popup) {
        popup.classList.add("hidden");
    }

    renderCalendarPage();
    renderCalendarSidebar();
}

function getEventsForDate(dateStr) {
    return calendarState.events
        .filter(ev => formatCalendarDate(new Date(ev.eventDate)) === dateStr)
        .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
}

function getCalendarEventClass(type) {
    switch ((type || "").toLowerCase()) {
        case "meeting": return "event-meeting";
        case "meetup": return "event-meetup";
        case "task": return "event-task";
        case "deadline": return "event-deadline";
        case "review": return "event-review";
        case "call": return "event-call";
        case "presentation": return "event-presentation";
        case "personal": return "event-personal";
        case "reminder": return "event-reminder";
        case "other": return "event-other";
        default: return "event-default";
    }
}

function getCalendarEventTypeText(type) {
    switch ((type || "").toLowerCase()) {
        case "meeting": return "Встреча";
        case "meetup": return "Митап";
        case "task": return "Задача";
        case "deadline": return "Дедлайн";
        case "review": return "Проверка";
        case "call": return "Звонок";
        case "presentation": return "Презентация";
        case "personal": return "Личное";
        case "reminder": return "Напоминание";
        case "other": return "Другое";
        default: return "Событие";
    }
}

function formatCalendarDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
}

function formatCalendarDateRu(date) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();

    return `${d}.${m}.${y}`;
}

function formatCalendarTime(value) {
    const date = new Date(value);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");

    return `${h}:${m}`;
}

function formatCalendarDateTime(value) {
    const date = new Date(value);
    return `${formatCalendarDateRu(date)} в ${formatCalendarTime(value)}`;
}

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function fillCalendarProjectSelect() {
    const select = document.getElementById("calendarProjectId");
    if (!select) return;

    const currentValue = String(select.value || "");
    const availableProjects = Array.isArray(window.projects) ? window.projects : [];

    select.innerHTML = `<option value="">Без проекта</option>`;

    availableProjects.forEach(project => {
        select.innerHTML += `<option value="${project.id}">${escapeHtml(project.name)}</option>`;
    });

    if ([...select.options].some(option => option.value === currentValue)) {
        select.value = currentValue;
    } else {
        select.value = "";
    }
}

function openCalendarModal(date = null) {
    fillCalendarProjectSelect();

    const id = document.getElementById("calendarEventId");
    const modalTitle = document.getElementById("calendarModalTitle");
    const title = document.getElementById("calendarTitle");
    const dateInput = document.getElementById("calendarDate");
    const time = document.getElementById("calendarTime");
    const description = document.getElementById("calendarDescription");
    const type = document.getElementById("calendarType");
    const projectId = document.getElementById("calendarProjectId");
    const location = document.getElementById("calendarLocation");
    const deleteBtn = document.getElementById("calendarDeleteBtn");

    if (id) id.value = "";
    if (modalTitle) modalTitle.textContent = "Новое событие";
    if (title) title.value = "";
    if (description) description.value = "";
    if (type) type.value = "meeting";
    if (projectId) projectId.value = "";
    if (location) location.value = "";
    if (deleteBtn) deleteBtn.classList.add("hidden");

    let targetDate;

    if (date instanceof Date) {
        targetDate = date;
    } else if (typeof date === "string" && date) {
        targetDate = new Date(date + "T00:00:00");
    } else {
        targetDate = calendarState.selectedDate instanceof Date
            ? calendarState.selectedDate
            : new Date();
    }

    if (dateInput) {
        dateInput.value = formatCalendarDate(targetDate);
    }

    if (time) {
        time.value = "10:00";
    }

    openModal("calendarModal");
}

function openEditCalendarEvent(id) {
    const event = calendarState.events.find(x => Number(x.id) === Number(id));

    if (!event) {
        showNotification("Событие не найдено");
        return;
    }

    if (event.isReadOnly || !event.canManage) {
        showNotification("Это событие нельзя редактировать");
        return;
    }

    fillCalendarProjectSelect();

    const eventDate = new Date(event.eventDate);
    const idInput = document.getElementById("calendarEventId");
    const modalTitle = document.getElementById("calendarModalTitle");
    const title = document.getElementById("calendarTitle");
    const dateInput = document.getElementById("calendarDate");
    const time = document.getElementById("calendarTime");
    const description = document.getElementById("calendarDescription");
    const type = document.getElementById("calendarType");
    const projectId = document.getElementById("calendarProjectId");
    const location = document.getElementById("calendarLocation");
    const deleteBtn = document.getElementById("calendarDeleteBtn");

    if (idInput) idInput.value = String(event.id);
    if (modalTitle) modalTitle.textContent = "Редактировать событие";
    if (title) title.value = event.title || "";
    if (dateInput) dateInput.value = formatCalendarDate(eventDate);
    if (time) time.value = formatCalendarTime(event.eventDate);
    if (description) description.value = event.description || "";
    if (type) type.value = event.eventType || "meeting";
    if (projectId) projectId.value = event.projectId ? String(event.projectId) : "";
    if (location) location.value = event.locationOrLink || "";
    if (deleteBtn) deleteBtn.classList.remove("hidden");

    openModal("calendarModal");
}

async function saveCalendarEvent() {
    const id = Number(document.getElementById("calendarEventId")?.value || 0);
    const title = document.getElementById("calendarTitle")?.value.trim();
    const date = document.getElementById("calendarDate")?.value;
    const time = document.getElementById("calendarTime")?.value;
    const description = document.getElementById("calendarDescription")?.value.trim() || "";
    const type = document.getElementById("calendarType")?.value || "meeting";
    const projectId = document.getElementById("calendarProjectId")?.value || "";
    const location = document.getElementById("calendarLocation")?.value.trim() || "";

    if (!title) {
        showNotification("Введите название события");
        return;
    }

    if (!date) {
        showNotification("Выберите дату");
        return;
    }

    if (!time) {
        showNotification("Выберите время");
        return;
    }

    if (projectId) {
        const projectSelect = document.getElementById("calendarProjectId");
        const hasProjectOption = projectSelect
            ? [...projectSelect.options].some(option => option.value === String(projectId))
            : false;

        if (!hasProjectOption) {
            showNotification("Выберите доступный проект");
            return;
        }
    }

    const eventDate = new Date(`${date}T${time}:00`);

    const dto = {
        id: id,
        title: title,
        description: description,
        eventDate: eventDate.toISOString(),
        eventType: type,
        projectId: projectId ? Number(projectId) : null,
        locationOrLink: location
    };

    try {
        const res = await fetch("/Calendar?handler=SaveEvent", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify(dto)
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось сохранить событие");
            return;
        }

        await loadCalendarEvents();
    } catch {
        showNotification("Ошибка сохранения события");
        return;
    }

    calendarState.selectedDate = new Date(`${date}T00:00:00`);
    calendarState.currentDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), 1);

    closeModal("calendarModal");
    renderCalendarPage();
    renderCalendarSidebar();

    showNotification("Событие сохранено");
}

async function deleteCalendarEvent(id = null) {
    const eventId = Number(id || document.getElementById("calendarEventId")?.value || 0);

    if (!eventId) {
        showNotification("Событие не найдено");
        return;
    }

    const event = calendarState.events.find(x => Number(x.id) === Number(eventId));
    if (event && (event.isReadOnly || !event.canManage)) {
        showNotification("Это событие нельзя удалить");
        return;
    }

    if (!confirm("Удалить событие?")) {
        return;
    }

    try {
        const res = await fetch("/Calendar?handler=DeleteEvent", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "RequestVerificationToken": getRequestVerificationToken()
            },
            body: JSON.stringify({ id: eventId })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            showNotification(data?.error || "Не удалось удалить событие");
            return;
        }

        closeModal("calendarModal");
        await loadCalendarEvents();
        showNotification("Событие удалено");
    } catch {
        showNotification("Ошибка удаления события");
    }
}

document.addEventListener("click", function (e) {
    const popup = document.getElementById("miniCalendarPopup");
    const wrap = document.querySelector(".calendar-title-wrap");

    if (!popup || !wrap) return;

    if (!wrap.contains(e.target)) {
        popup.classList.add("hidden");
    }
});
