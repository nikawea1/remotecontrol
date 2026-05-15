using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Models;

namespace RemoteControl1.Services
{
    public class DashboardService
    {
        private readonly AppDbContext _db;
        private readonly ProjectService _projectService;

        public DashboardService(AppDbContext db, ProjectService projectService)
        {
            _db = db;
            _projectService = projectService;
        }

        public async Task<PageDataResult> GetPageDataAsync(int userId)
        {
            var currentUser = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (currentUser == null)
                return new PageDataResult();

            var role = (currentUser.Role ?? "").ToLower();
            var isAdmin = role == "admin";
            var isManager = role == "manager";

            var allUsers = await _db.Users
                .OrderBy(u => u.LastName)
                .ThenBy(u => u.FirstName)
                .ToListAsync();

            List<Project> projects;
            List<int> projectIds;
            List<TaskItem> tasks;
            List<User> visibleUsers;

            if (isAdmin)
            {
                projects = await _db.Projects
                    .Include(p => p.Manager)
                    .Include(p => p.Members)
                    .ThenInclude(m => m.User)
                    .OrderBy(p => p.Id)
                    .ToListAsync();

                projectIds = projects.Select(p => p.Id).ToList();

                tasks = await _db.Tasks
                    .Include(t => t.Project)
                    .OrderByDescending(t => t.Id)
                    .ToListAsync();

                visibleUsers = allUsers;
            }
            else if (isManager)
            {
                projects = await _db.Projects
                    .Include(p => p.Manager)
                    .Include(p => p.Members)
                    .ThenInclude(m => m.User)
                    .Where(p => p.ManagerId == userId)
                    .OrderBy(p => p.Id)
                    .ToListAsync();

                projectIds = projects.Select(p => p.Id).ToList();

                tasks = await _db.Tasks
                    .Include(t => t.Project)
                    .Where(t => projectIds.Contains(t.ProjectId))
                    .OrderByDescending(t => t.Id)
                    .ToListAsync();

                var visibleUserIds = await _db.ProjectMembers
                    .Where(x => projectIds.Contains(x.ProjectId))
                    .Select(x => x.UserId)
                    .Distinct()
                    .ToListAsync();

                visibleUsers = allUsers
                    .Where(u =>
                        visibleUserIds.Contains(u.Id) &&
                        u.IsActive &&
                        u.Role != "admin")
                    .ToList();
            }
            else
            {
                var memberProjectIds = await _db.ProjectMembers
                    .Where(x => x.UserId == userId)
                    .Select(x => x.ProjectId)
                    .Distinct()
                    .ToListAsync();

                projects = await _db.Projects
                    .Include(p => p.Manager)
                    .Include(p => p.Members)
                    .ThenInclude(m => m.User)
                    .Where(p => memberProjectIds.Contains(p.Id))
                    .OrderBy(p => p.Id)
                    .ToListAsync();

                projectIds = projects.Select(p => p.Id).ToList();

                tasks = await _db.Tasks
                    .Include(t => t.Project)
                    .Where(t => t.UserId == userId)
                    .OrderByDescending(t => t.Id)
                    .ToListAsync();

                visibleUsers = new List<User>();
            }

            var activities = await _db.ActivityLogs
                .Include(a => a.TaskItem)
                .Where(a =>
                    (a.ActivityType == "task_timer" || a.ActivityType == "manual_time") &&
                    (
                        isAdmin ||
                        (isManager && a.ProjectId.HasValue && projectIds.Contains(a.ProjectId.Value)) ||
                        (!isAdmin && !isManager && a.UserId == userId)
                    ))
                .OrderByDescending(a => a.Id)
                .Take(20)
                .ToListAsync();

            var allTasks = await _db.Tasks.ToListAsync();
            var allActivities = await _db.ActivityLogs.ToListAsync();

            var workDays = await _db.ActivityLogs
                .Where(a => a.UserId == userId && a.ActivityType == "workday" && !a.IsActive)
                .OrderByDescending(a => a.StartedAtUtc)
                .Take(20)
                .ToListAsync();

            var projectVms = new List<ProjectVm>();

            foreach (var project in projects)
            {
                var vm = await _projectService.BuildProjectVm(project);
                projectVms.Add(vm);
            }

            return new PageDataResult
            {
                Tasks = tasks.Select(MapTask).ToList(),
                Projects = projectVms,
                Activity = activities.Select(BuildActivityVm).ToList(),
                Users = visibleUsers.Select(u => UserService.BuildUserVm(u, allTasks, allActivities)).ToList(),
                WorkDays = workDays.Select(x => new WorkDayVm
                {
                    Date = x.StartedAtUtc.ToLocalTime().ToString("dd.MM.yyyy"),
                    Start = x.StartedAtUtc.ToLocalTime().ToString("HH:mm"),
                    End = x.EndedAtUtc.HasValue ? x.EndedAtUtc.Value.ToLocalTime().ToString("HH:mm") : "-",
                    Hours = Math.Round(x.DurationHours, 2)
                }).ToList()
            };
        }

        private static TaskVm MapTask(TaskItem t)
        {
            return new TaskVm
            {
                Id = t.Id,
                Name = t.Title,
                Description = t.Description,
                Project = t.Project?.Name ?? "",
                ProjectId = t.ProjectId,
                UserId = t.UserId,
                Assignee = t.User != null
                    ? BuildFullName(t.User.LastName, t.User.FirstName, t.User.MiddleName)
                    : (t.Assignee ?? ""),
                Priority = t.Priority,
                Status = t.Status,
                PlannedTime = t.PlannedTimeHours,
                Deadline = t.Deadline?.ToString("dd.MM.yyyy") ?? "",
                DeadlineRaw = t.Deadline?.ToString("yyyy-MM-dd") ?? "",
                StageName = t.StageName ?? ""
            };
        }

        private static ActivityVm BuildActivityVm(ActivityLog a)
        {
            return new ActivityVm
            {
                Date = a.EndedAtUtc.HasValue
                    ? a.EndedAtUtc.Value.ToLocalTime().ToString("dd.MM.yyyy")
                    : a.StartedAtUtc.ToLocalTime().ToString("dd.MM.yyyy"),
                Task = a.TaskItem?.Title ?? "Без задачи",
                Hours = a.DurationHours,
                Comment = a.Comment ?? GetActivityComment(a.ActivityType)
            };
        }

        private static string GetActivityComment(string? activityType)
        {
            return activityType switch
            {
                "task_timer" => "Сессия таймера",
                "manual_time" => "Ручное добавление времени",
                _ => "Активность"
            };
        }

        private static string BuildFullName(string? lastName, string? firstName, string? middleName)
        {
            return string.Join(" ", new[] { lastName, firstName, middleName }
                .Where(x => !string.IsNullOrWhiteSpace(x)));
        }
    }
}
