// ����: RemoteControl1/Pages/Calendar.cshtml.cs
//Calendar.cshtml.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Models;
using System.Text.Json;

namespace RemoteControl1.Pages
{
    public class CalendarModel : PageModel
    {
        private readonly AppDbContext _db;

        public CalendarModel(AppDbContext db)
        {
            _db = db;
        }

        public int CurrentUserId { get; set; }
        public string CurrentUserRole { get; set; } = "";
        public bool IsAdmin { get; set; }
        public bool IsManager { get; set; }
        public bool IsEmployee { get; set; }

        public string CalendarEventsJson { get; set; } = "[]";
        public string ProjectsJson { get; set; } = "[]";

        public async Task<IActionResult> OnGetAsync()
        {
            var sessionUserId = HttpContext.Session.GetInt32("user_id");
            if (sessionUserId == null || sessionUserId <= 0)
                return RedirectToPage("/Auth");

            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == sessionUserId.Value);
            if (user == null)
                return RedirectToPage("/Auth");

            CurrentUserId = user.Id;
            CurrentUserRole = (user.Role ?? "").ToLower();
            IsAdmin = CurrentUserRole == "admin";
            IsManager = !IsAdmin && CurrentUserRole == "manager";
            IsEmployee = !IsAdmin && !IsManager;

            var projects = await BuildManageableCalendarProjectsQuery(user)
                .Select(p => new
                {
                    id = p.Id,
                    name = p.Name
                })
                .OrderBy(p => p.name)
                .ToListAsync();

            var calendarItems = await BuildVisibleCalendarItemsAsync(user);

            CalendarEventsJson = JsonSerializer.Serialize(calendarItems);
            ProjectsJson = JsonSerializer.Serialize(projects);

            return Page();
        }

        public async Task<JsonResult> OnGetEventsAsync()
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var calendarItems = await BuildVisibleCalendarItemsAsync(user);

            return new JsonResult(new
            {
                ok = true,
                items = calendarItems
            });
        }

        public async Task<JsonResult> OnPostSaveEventAsync([FromBody] SaveCalendarEventDto dto)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            if (dto == null || string.IsNullOrWhiteSpace(dto.Title))
                return new JsonResult(new { ok = false, error = "Введите название события" });

            var role = (user.Role ?? "").ToLower();
            if (role != "admin" && role != "manager")
                return new JsonResult(new { ok = false, error = "Нет прав" });

            var projectId = dto.ProjectId.HasValue && dto.ProjectId.Value > 0
                ? dto.ProjectId
                : null;

            if (projectId.HasValue && !await CanUseProjectForCalendarAsync(user, projectId.Value))
                return new JsonResult(new { ok = false, error = "Нет прав на этот проект" });

            CalendarEvent item;

            if (dto.Id > 0)
            {
                var existingEvent = await _db.CalendarEvents.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (existingEvent == null)
                    return new JsonResult(new { ok = false, error = "Событие не найдено" });

                item = existingEvent;

                if (!await CanManageCalendarEventAsync(user, item))
                    return new JsonResult(new { ok = false, error = "Нет прав на это событие" });
            }
            else
            {
                item = new CalendarEvent
                {
                    UserId = user.Id,
                    CreatedByUserId = user.Id,
                    CreatedAt = DateTime.Now
                };

                _db.CalendarEvents.Add(item);
            }

            item.Title = dto.Title.Trim();
            item.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            item.EventDate = dto.EventDate;
            item.EventType = NormalizeCalendarEventType(dto.EventType);
            item.LocationOrLink = string.IsNullOrWhiteSpace(dto.LocationOrLink) ? null : dto.LocationOrLink.Trim();
            item.ProjectId = projectId;

            await _db.SaveChangesAsync();

            var canManage = await CanManageCalendarEventAsync(user, item);

            return new JsonResult(new
            {
                ok = true,
                calendarEvent = ToCalendarEventJson(item, canManage)
            });
        }

        public async Task<JsonResult> OnPostDeleteEventAsync([FromBody] DeleteCalendarEventDto dto)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            if (dto == null || dto.Id <= 0)
                return new JsonResult(new { ok = false, error = "Событие не найдено" });

            var item = await _db.CalendarEvents.FirstOrDefaultAsync(x => x.Id == dto.Id);
            if (item == null)
                return new JsonResult(new { ok = false, error = "Событие не найдено" });

            if (!await CanManageCalendarEventAsync(user, item))
                return new JsonResult(new { ok = false, error = "Нет прав на это событие" });

            _db.CalendarEvents.Remove(item);
            await _db.SaveChangesAsync();

            return new JsonResult(new { ok = true });
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var sessionUserId = HttpContext.Session.GetInt32("user_id");
            if (sessionUserId == null || sessionUserId <= 0)
                return null;

            return await _db.Users.FirstOrDefaultAsync(x => x.Id == sessionUserId.Value);
        }

        private IQueryable<Project> BuildVisibleProjectsQuery(User user)
        {
            var role = (user.Role ?? "").ToLower();

            if (role == "admin")
                return _db.Projects;

            if (role == "manager")
            {
                return _db.Projects.Where(p =>
                    p.ManagerId == user.Id ||
                    p.Members.Any(m => m.UserId == user.Id));
            }

            return _db.Projects.Where(p => p.Members.Any(m => m.UserId == user.Id));
        }

        private IQueryable<Project> BuildManageableCalendarProjectsQuery(User user)
        {
            var role = (user.Role ?? "").ToLower();

            if (role == "admin")
                return _db.Projects;

            if (role == "manager")
                return _db.Projects.Where(p => p.ManagerId == user.Id);

            return _db.Projects.Where(p => false);
        }

        private IQueryable<CalendarEvent> BuildVisibleCalendarEventsQuery(User user)
        {
            var role = (user.Role ?? "").ToLower();

            if (role == "admin")
                return _db.CalendarEvents;

            if (role == "manager")
            {
                return _db.CalendarEvents.Where(e =>
                    e.UserId == user.Id ||
                    e.CreatedByUserId == user.Id ||
                    (e.ProjectId.HasValue && _db.Projects.Any(p =>
                        p.Id == e.ProjectId.Value &&
                        (p.ManagerId == user.Id || p.Members.Any(m => m.UserId == user.Id)))));
            }

            return _db.CalendarEvents.Where(e =>
                e.UserId == user.Id ||
                (e.ProjectId.HasValue && _db.ProjectMembers.Any(m =>
                    m.ProjectId == e.ProjectId.Value &&
                    m.UserId == user.Id)));
        }

        private IQueryable<TaskItem> BuildVisibleTaskDeadlineQuery(User user)
        {
            var role = (user.Role ?? "").ToLower();

            var query = _db.Tasks
                .Include(t => t.Project)
                .Where(t =>
                    t.Deadline.HasValue &&
                    t.Status != "done");

            if (role == "admin")
                return query;

            if (role == "manager")
            {
                return query.Where(t =>
                    t.UserId == user.Id ||
                    (t.Project != null && t.Project.ManagerId == user.Id));
            }

            return query.Where(t => t.UserId == user.Id);
        }

        private async Task<List<object>> BuildVisibleCalendarItemsAsync(User user)
        {
            var items = new List<(DateTime Date, object Item)>();
            var role = (user.Role ?? "").ToLower();
            var managedProjectIds = role == "manager"
                ? await _db.Projects
                    .Where(p => p.ManagerId == user.Id)
                    .Select(p => p.Id)
                    .ToListAsync()
                : new List<int>();

            var calendarEvents = await BuildVisibleCalendarEventsQuery(user)
                .Include(e => e.Project)
                .OrderBy(e => e.EventDate)
                .ToListAsync();

            foreach (var item in calendarEvents)
            {
                var canManage =
                    role == "admin" ||
                    (role == "manager" &&
                        (item.UserId == user.Id ||
                         item.CreatedByUserId == user.Id ||
                         (item.ProjectId.HasValue && managedProjectIds.Contains(item.ProjectId.Value))));

                items.Add((item.EventDate, ToCalendarEventJson(item, canManage)));
            }

            var taskDeadlines = await BuildVisibleTaskDeadlineQuery(user)
                .OrderBy(t => t.Deadline)
                .ToListAsync();

            foreach (var task in taskDeadlines)
            {
                items.Add((task.Deadline!.Value, ToTaskDeadlineCalendarJson(task)));
            }

            return items
                .OrderBy(x => x.Date)
                .Select(x => x.Item)
                .ToList();
        }

        private async Task<bool> CanUseProjectForCalendarAsync(User user, int projectId)
        {
            var role = (user.Role ?? "").ToLower();

            if (role == "admin")
                return await _db.Projects.AnyAsync(p => p.Id == projectId);

            return await _db.Projects.AnyAsync(p =>
                p.Id == projectId &&
                p.ManagerId == user.Id);
        }

        private async Task<bool> CanManageCalendarEventAsync(User user, CalendarEvent item)
        {
            var role = (user.Role ?? "").ToLower();

            if (role == "admin")
                return true;

            if (role != "manager")
                return false;

            if (!item.ProjectId.HasValue && (item.UserId == user.Id || item.CreatedByUserId == user.Id))
                return true;

            if (!item.ProjectId.HasValue)
                return false;

            return await _db.Projects.AnyAsync(p =>
                p.Id == item.ProjectId.Value &&
                p.ManagerId == user.Id);
        }

        private static object ToCalendarEventJson(CalendarEvent item, bool canManage)
        {
            return new
            {
                id = item.Id,
                title = item.Title,
                description = item.Description ?? "",
                eventDate = item.EventDate,
                eventType = item.EventType,
                projectId = item.ProjectId,
                projectName = item.Project?.Name ?? "",
                locationOrLink = item.LocationOrLink ?? "",
                userId = item.UserId,
                createdByUserId = item.CreatedByUserId,
                source = "calendar",
                isReadOnly = false,
                canManage
            };
        }

        private static object ToTaskDeadlineCalendarJson(TaskItem task)
        {
            var eventDate = task.Deadline!.Value.Date.AddHours(17);

            return new
            {
                id = -task.Id,
                title = $"Дедлайн: {task.Title}",
                description = string.IsNullOrWhiteSpace(task.Description)
                    ? "Срок выполнения задачи"
                    : task.Description,
                eventDate,
                eventType = "deadline",
                projectId = task.ProjectId,
                projectName = task.Project?.Name ?? "",
                locationOrLink = "",
                userId = task.UserId,
                createdByUserId = 0,
                taskId = task.Id,
                taskStatus = task.Status,
                source = "task",
                isReadOnly = true,
                canManage = false
            };
        }

        private static string NormalizeCalendarEventType(string? value)
        {
            var type = (value ?? "").Trim().ToLower();
            var allowed = new[]
            {
                "meeting",
                "meetup",
                "task",
                "deadline",
                "review",
                "call",
                "presentation",
                "personal",
                "reminder",
                "other"
            };

            return allowed.Contains(type) ? type : "meeting";
        }

        public class SaveCalendarEventDto
        {
            public int Id { get; set; }
            public string Title { get; set; } = "";
            public string? Description { get; set; }
            public DateTime EventDate { get; set; }
            public string? EventType { get; set; }
            public string? LocationOrLink { get; set; }
            public int? ProjectId { get; set; }
        }

        public class DeleteCalendarEventDto
        {
            public int Id { get; set; }
        }
    }
}
