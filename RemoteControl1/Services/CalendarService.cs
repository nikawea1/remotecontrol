using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Models;

namespace RemoteControl1.Services
{
    public class CalendarService
    {
        private readonly AppDbContext _db;

        public CalendarService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<CalendarPageDataVm?> GetCalendarPageDataAsync(int userId)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return null;

            var projects = await BuildManageableCalendarProjectsQuery(user)
                .Select(p => new CalendarProjectVm
                {
                    Id = p.Id,
                    Name = p.Name
                })
                .OrderBy(p => p.Name)
                .ToListAsync();

            var calendarItems = await BuildVisibleCalendarItemsAsync(user);
            var role = (user.Role ?? "").ToLower();

            return new CalendarPageDataVm
            {
                CurrentUserId = user.Id,
                CurrentUserRole = role,
                IsAdmin = role == "admin",
                IsManager = role == "manager",
                IsEmployee = role != "admin" && role != "manager",
                Projects = projects,
                CalendarItems = calendarItems
            };
        }

        public async Task<ServiceResult<List<object>>> GetEventsAsync(int userId)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult<List<object>>.Fail("Пользователь не найден");

            var calendarItems = await BuildVisibleCalendarItemsAsync(user);
            return ServiceResult<List<object>>.Success(calendarItems);
        }

        public async Task<ServiceResult<object>> SaveEventAsync(int userId, CalendarEventSaveRequest dto)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult<object>.Fail("Пользователь не найден");

            if (dto == null || string.IsNullOrWhiteSpace(dto.Title))
                return ServiceResult<object>.Fail("Введите название события");

            var role = (user.Role ?? "").ToLower();
            if (role != "admin" && role != "manager")
                return ServiceResult<object>.Fail("Нет прав");

            var projectId = dto.ProjectId.HasValue && dto.ProjectId.Value > 0
                ? dto.ProjectId
                : null;

            if (projectId.HasValue && !await CanUseProjectForCalendarAsync(user, projectId.Value))
                return ServiceResult<object>.Fail("Нет прав на этот проект");

            CalendarEvent item;

            if (dto.Id > 0)
            {
                var existingEvent = await _db.CalendarEvents.FirstOrDefaultAsync(x => x.Id == dto.Id);
                if (existingEvent == null)
                    return ServiceResult<object>.Fail("Событие не найдено");

                item = existingEvent;

                if (!await CanManageCalendarEventAsync(user, item))
                    return ServiceResult<object>.Fail("Нет прав на это событие");
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
            return ServiceResult<object>.Success(ToCalendarEventJson(item, canManage));
        }

        public async Task<ServiceResult> DeleteEventAsync(int userId, int id)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return ServiceResult.Fail("Пользователь не найден");

            if (id <= 0)
                return ServiceResult.Fail("Событие не найдено");

            var item = await _db.CalendarEvents.FirstOrDefaultAsync(x => x.Id == id);
            if (item == null)
                return ServiceResult.Fail("Событие не найдено");

            if (!await CanManageCalendarEventAsync(user, item))
                return ServiceResult.Fail("Нет прав на это событие");

            _db.CalendarEvents.Remove(item);
            await _db.SaveChangesAsync();

            return ServiceResult.Success();
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
                canManage,
                canEdit = canManage,
                canDelete = canManage
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
                canManage = false,
                canEdit = false,
                canDelete = false
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
    }

    public class CalendarPageDataVm
    {
        public int CurrentUserId { get; set; }
        public string CurrentUserRole { get; set; } = "";
        public bool IsAdmin { get; set; }
        public bool IsManager { get; set; }
        public bool IsEmployee { get; set; }
        public List<object> CalendarItems { get; set; } = new();
        public List<CalendarProjectVm> Projects { get; set; } = new();
    }

    public class CalendarProjectVm
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
    }

    public class CalendarEventSaveRequest
    {
        public int Id { get; set; }
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public DateTime EventDate { get; set; }
        public string? EventType { get; set; }
        public string? LocationOrLink { get; set; }
        public int? ProjectId { get; set; }
    }
}
