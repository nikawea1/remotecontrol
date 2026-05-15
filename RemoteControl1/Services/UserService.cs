using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Models;

namespace RemoteControl1.Services
{
    public class UserService
    {
        private readonly AppDbContext _db;

        public UserService(AppDbContext db)
        {
            _db = db;
        }

        private sealed class PerformanceMetrics
        {
            public decimal PlannedHours { get; set; }
            public decimal TrackedHours { get; set; }
            public decimal WorkDayHours { get; set; }
            public decimal IdleHours { get; set; }
            public decimal SalaryHours { get; set; }
            public decimal WorkloadDiff { get; set; }
            public decimal TimeCompletionPercent { get; set; }
            public int TaskCompletionPercent { get; set; }
            public int Efficiency { get; set; }
            public int OpenTasks { get; set; }
            public int NewTasks { get; set; }
            public int ProgressTasks { get; set; }
            public int ReviewTasks { get; set; }
            public int DoneTasks { get; set; }
            public int OverdueTasks { get; set; }
            public string ProductivityState { get; set; } = "normal";
            public int BonusPercent { get; set; }
            public string BonusReason { get; set; } = "Нет данных";
        }

        public async Task<List<UserVm>> GetUsersAsync()
        {
            var users = await _db.Users
                .OrderBy(u => u.LastName)
                .ThenBy(u => u.FirstName)
                .ToListAsync();

            var allTasks = await _db.Tasks.ToListAsync();
            var allActivities = await _db.ActivityLogs.ToListAsync();

            return users
                .Select(u => BuildUserVm(u, allTasks, allActivities))
                .ToList();
        }

        public async Task<ServiceResult<UserVm>> AddUserAsync(AddUserDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.LastName) ||
                string.IsNullOrWhiteSpace(dto.FirstName) ||
                string.IsNullOrWhiteSpace(dto.Login) ||
                string.IsNullOrWhiteSpace(dto.Password) ||
                string.IsNullOrWhiteSpace(dto.Position))
            {
                return ServiceResult<UserVm>.Fail("Заполните обязательные поля");
            }

            var loginExists = await _db.Users.AnyAsync(x => x.Login == dto.Login.Trim());
            if (loginExists)
                return ServiceResult<UserVm>.Fail("Логин уже существует");

            var email = (dto.Email ?? "").Trim().ToLowerInvariant();
            if (!string.IsNullOrWhiteSpace(email))
            {
                var emailExists = await _db.Users.AnyAsync(x => x.Email == email);
                if (emailExists)
                    return ServiceResult<UserVm>.Fail("Email уже существует");
            }

            var workMode = NormalizeWorkMode(dto.WorkMode);
            TimeSpan? plannedStartTime = null;
            TimeSpan? plannedEndTime = null;

            if (workMode == "fixed")
            {
                if (dto.RequiredDailyHours <= 0)
                    return ServiceResult<UserVm>.Fail("Для фиксированного графика укажите норму часов");

                if (!string.IsNullOrWhiteSpace(dto.PlannedStartTime))
                {
                    if (!TimeSpan.TryParse(dto.PlannedStartTime, out var start))
                        return ServiceResult<UserVm>.Fail("Некорректное время начала рабочего дня");
                    plannedStartTime = start;
                }

                if (!string.IsNullOrWhiteSpace(dto.PlannedEndTime))
                {
                    if (!TimeSpan.TryParse(dto.PlannedEndTime, out var end))
                        return ServiceResult<UserVm>.Fail("Некорректное время окончания рабочего дня");
                    plannedEndTime = end;
                }

                if (plannedStartTime.HasValue && plannedEndTime.HasValue && plannedEndTime <= plannedStartTime)
                    return ServiceResult<UserVm>.Fail("Время окончания должно быть позже времени начала");
            }
            else
            {
                if (dto.RequiredDailyHours < 0)
                    return ServiceResult<UserVm>.Fail("Норма часов не может быть отрицательной");
            }

            var user = new User
            {
                LastName = dto.LastName.Trim(),
                FirstName = dto.FirstName.Trim(),
                MiddleName = dto.MiddleName?.Trim(),
                Login = dto.Login.Trim(),
                Email = email,
                PasswordHash = HashPassword(dto.Password.Trim()),
                Position = dto.Position.Trim(),
                Role = NormalizeRole(dto.Role),
                HourlyRate = dto.Rate,
                Phone = dto.Phone?.Trim(),
                IsActive = dto.Status != "blocked",
                WorkMode = workMode,
                RequiredDailyHours = dto.RequiredDailyHours,
                PlannedStartTime = plannedStartTime,
                PlannedEndTime = plannedEndTime,
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            var allTasks = await _db.Tasks.ToListAsync();
            var allActivities = await _db.ActivityLogs.ToListAsync();

            return ServiceResult<UserVm>.Success(BuildUserVm(user, allTasks, allActivities));
        }

        public async Task<ServiceResult<UserVm>> UpdateUserAsync(UpdateUserDto dto)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == dto.Id);
            if (user == null)
                return ServiceResult<UserVm>.Fail("Сотрудник не найден");

            if (string.IsNullOrWhiteSpace(dto.LastName) ||
                string.IsNullOrWhiteSpace(dto.FirstName) ||
                string.IsNullOrWhiteSpace(dto.Login) ||
                string.IsNullOrWhiteSpace(dto.Position))
            {
                return ServiceResult<UserVm>.Fail("Заполните обязательные поля");
            }

            var loginExists = await _db.Users.AnyAsync(x => x.Login == dto.Login.Trim() && x.Id != dto.Id);
            if (loginExists)
                return ServiceResult<UserVm>.Fail("Логин уже существует");

            var email = (dto.Email ?? "").Trim().ToLowerInvariant();
            if (!string.IsNullOrWhiteSpace(email))
            {
                var emailExists = await _db.Users.AnyAsync(x => x.Email == email && x.Id != dto.Id);
                if (emailExists)
                    return ServiceResult<UserVm>.Fail("Email уже существует");
            }

            var workMode = NormalizeWorkMode(dto.WorkMode);
            TimeSpan? plannedStartTime = null;
            TimeSpan? plannedEndTime = null;

            if (workMode == "fixed")
            {
                if (dto.RequiredDailyHours <= 0)
                    return ServiceResult<UserVm>.Fail("Для фиксированного графика укажите норму часов");

                if (!string.IsNullOrWhiteSpace(dto.PlannedStartTime))
                {
                    if (!TimeSpan.TryParse(dto.PlannedStartTime, out var start))
                        return ServiceResult<UserVm>.Fail("Некорректное время начала рабочего дня");
                    plannedStartTime = start;
                }

                if (!string.IsNullOrWhiteSpace(dto.PlannedEndTime))
                {
                    if (!TimeSpan.TryParse(dto.PlannedEndTime, out var end))
                        return ServiceResult<UserVm>.Fail("Некорректное время окончания рабочего дня");
                    plannedEndTime = end;
                }

                if (plannedStartTime.HasValue && plannedEndTime.HasValue && plannedEndTime <= plannedStartTime)
                    return ServiceResult<UserVm>.Fail("Время окончания должно быть позже времени начала");
            }
            else
            {
                if (dto.RequiredDailyHours < 0)
                    return ServiceResult<UserVm>.Fail("Норма часов не может быть отрицательной");
            }

            user.LastName = dto.LastName.Trim();
            user.FirstName = dto.FirstName.Trim();
            user.MiddleName = dto.MiddleName?.Trim();
            user.Login = dto.Login.Trim();
            user.Email = email;
            user.Position = dto.Position.Trim();
            user.Role = NormalizeRole(dto.Role);
            user.HourlyRate = dto.Rate;
            user.Phone = dto.Phone?.Trim();
            user.IsActive = dto.Status != "blocked";
            user.WorkMode = workMode;
            user.RequiredDailyHours = dto.RequiredDailyHours;
            user.PlannedStartTime = plannedStartTime;
            user.PlannedEndTime = plannedEndTime;

            if (!string.IsNullOrWhiteSpace(dto.Password))
                user.PasswordHash = HashPassword(dto.Password.Trim());

            await _db.SaveChangesAsync();

            var allTasks = await _db.Tasks.ToListAsync();
            var allActivities = await _db.ActivityLogs.ToListAsync();

            return ServiceResult<UserVm>.Success(BuildUserVm(user, allTasks, allActivities));
        }

        public async Task<ServiceResult<UserVm>> ToggleUserStatusAsync(int id)
        {
            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == id);
            if (user == null)
                return ServiceResult<UserVm>.Fail("Сотрудник не найден");

            user.IsActive = !user.IsActive;
            await _db.SaveChangesAsync();

            var allTasks = await _db.Tasks.ToListAsync();
            var allActivities = await _db.ActivityLogs.ToListAsync();

            return ServiceResult<UserVm>.Success(BuildUserVm(user, allTasks, allActivities));
        }

        public static UserVm BuildUserVm(User u, List<TaskItem> allTasks, List<ActivityLog> allActivities)
        {
            var userTasks = allTasks.Where(t => t.UserId == u.Id).ToList();
            var userLogs = allActivities.Where(a => a.UserId == u.Id).ToList();

            var workDayLogs = userLogs
                .Where(a => a.ActivityType == "workday" && !a.IsActive)
                .ToList();

            var taskLogs = userLogs
                .Where(a => a.ActivityType == "task_timer" || a.ActivityType == "manual_time")
                .ToList();

            var metrics = CalculatePerformanceMetrics(userTasks, taskLogs, workDayLogs, DateTime.Today);
            var completionPercent = metrics.TimeCompletionPercent > 999m
                ? 999m
                : metrics.TimeCompletionPercent;
            var bonusAmount = Math.Round(metrics.SalaryHours * u.HourlyRate * metrics.BonusPercent / 100m, 2);

            return new UserVm
            {
                Id = u.Id,
                FullName = BuildFullName(u.LastName, u.FirstName, u.MiddleName),
                Login = u.Login ?? "",
                Position = u.Position ?? "",
                Role = string.IsNullOrWhiteSpace(u.Role) ? "employee" : u.Role,
                HourlyRate = u.HourlyRate,
                Status = u.IsActive ? "active" : "blocked",
                Email = u.Email ?? "",
                Phone = u.Phone ?? "",
                TasksInProgress = metrics.OpenTasks,
                CompletedTasks = metrics.DoneTasks,
                OverdueTasks = metrics.OverdueTasks,
                PlannedHours = metrics.PlannedHours,
                TotalHours = metrics.TrackedHours,
                WorkMode = u.WorkMode ?? "fixed",
                RequiredDailyHours = u.RequiredDailyHours,
                PlannedStartTime = u.PlannedStartTime?.ToString(@"hh\:mm") ?? "",
                PlannedEndTime = u.PlannedEndTime?.ToString(@"hh\:mm") ?? "",
                WorkDayHours = metrics.WorkDayHours,
                TrackedHours = metrics.TrackedHours,
                IdleHours = metrics.IdleHours,
                SalaryHours = metrics.SalaryHours,
                WorkloadDiff = metrics.WorkloadDiff,
                CompletionPercent = completionPercent,
                ProductivityState = metrics.ProductivityState,
                BonusPercent = metrics.BonusPercent,
                BonusReason = metrics.BonusReason,
                BonusAmount = bonusAmount
            };
        }

        public static string NormalizeRole(string? role)
        {
            var value = (role ?? "").Trim().ToLower();

            return value switch
            {
                "admin" => "admin",
                "manager" => "manager",
                _ => "employee"
            };
        }

        public static string NormalizeWorkMode(string? workMode)
        {
            var value = (workMode ?? "fixed").Trim().ToLower();
            return value == "flexible" ? "flexible" : "fixed";
        }

        private static string NormalizeTaskStatusKey(string? value)
        {
            return (value ?? "").Trim().ToLowerInvariant();
        }

        private static bool IsTaskDone(string? value)
        {
            return NormalizeTaskStatusKey(value) == "done";
        }

        private static bool IsOpenTaskStatus(string? value)
        {
            return NormalizeTaskStatusKey(value) switch
            {
                "new" => true,
                "progress" => true,
                "review" => true,
                _ => false
            };
        }

        private static string GetProductivityState(
            decimal plannedHours,
            decimal timeCompletionPercent,
            int openTasks,
            decimal trackedHours)
        {
            if (openTasks <= 0 && trackedHours <= 0m && plannedHours <= 0m)
                return "no_data";

            if (openTasks >= 6 || (plannedHours > 0m && timeCompletionPercent > 120m))
                return "overloaded";

            if (plannedHours > 0m && timeCompletionPercent < 70m)
                return "underloaded";

            return "normal";
        }

        private static (int Percent, string Reason) CalculateBonusRecommendation(
            decimal plannedHours,
            decimal trackedHours,
            int taskCompletionPercent,
            int overdueTasks)
        {
            if (plannedHours <= 0m)
                return (0, "Нет плана по задачам");

            if (trackedHours <= 0m)
                return (0, "Нет фактически учтённого времени");

            var timeCompletionPercent = (trackedHours / plannedHours) * 100m;

            if (overdueTasks > 0)
            {
                if (timeCompletionPercent >= 100m && taskCompletionPercent >= 70)
                    return (5, "Есть просрочки: бонус ограничен");

                return (0, "Есть просроченные задачи");
            }

            if (timeCompletionPercent >= 110m && taskCompletionPercent >= 70)
                return (15, "План перевыполнен без просрочек");

            if (timeCompletionPercent >= 100m && taskCompletionPercent >= 50)
                return (10, "План выполнен без просрочек");

            if (timeCompletionPercent >= 80m)
                return (5, "План близок к выполнению");

            return (0, "План по задачам не выполнен");
        }

        private static PerformanceMetrics CalculatePerformanceMetrics(
            IEnumerable<TaskItem> taskSource,
            IEnumerable<ActivityLog> taskLogSource,
            IEnumerable<ActivityLog> workDayLogSource,
            DateTime referenceDate)
        {
            var tasks = taskSource.ToList();
            var taskLogs = taskLogSource
                .Where(a => a.ActivityType == "task_timer" || a.ActivityType == "manual_time")
                .ToList();
            var workDayLogs = workDayLogSource
                .Where(a => a.ActivityType == "workday" && !a.IsActive)
                .ToList();

            var plannedHours = Math.Round(tasks.Sum(t => t.PlannedTimeHours), 2);
            var trackedFromLogs = Math.Round(taskLogs.Sum(a => a.DurationHours), 2);
            var trackedFromWorkDays = Math.Round(workDayLogs.Sum(a => a.TrackedHours), 2);
            var trackedHours = Math.Max(trackedFromLogs, trackedFromWorkDays);

            var workDayHours = Math.Round(workDayLogs.Sum(a => a.DurationHours), 2);
            var idleStored = Math.Round(workDayLogs.Sum(a => a.IdleHours), 2);
            var idleHours = workDayHours > 0m
                ? Math.Round(Math.Max(0m, workDayHours - trackedHours), 2)
                : idleStored;

            var newTasks = tasks.Count(t => NormalizeTaskStatusKey(t.Status) == "new");
            var progressTasks = tasks.Count(t => NormalizeTaskStatusKey(t.Status) == "progress");
            var reviewTasks = tasks.Count(t => NormalizeTaskStatusKey(t.Status) == "review");
            var doneTasks = tasks.Count(t => IsTaskDone(t.Status));
            var openTasks = tasks.Count(t => IsOpenTaskStatus(t.Status));
            var totalTasks = tasks.Count;

            var overdueTasks = tasks.Count(t =>
                t.Deadline.HasValue &&
                t.Deadline.Value.Date < referenceDate.Date &&
                !IsTaskDone(t.Status));

            var timeCompletionPercent = plannedHours > 0m
                ? Math.Round((trackedHours / plannedHours) * 100m, 0)
                : 0m;

            var taskCompletionPercent = totalTasks > 0
                ? (int)Math.Round((double)doneTasks / totalTasks * 100d)
                : 0;

            var hourRateForEfficiency = plannedHours > 0m
                ? (int)Math.Min(100m, timeCompletionPercent)
                : 0;

            var efficiency = totalTasks > 0 && plannedHours > 0m
                ? (int)Math.Round((taskCompletionPercent + hourRateForEfficiency) / 2d)
                : plannedHours > 0m
                    ? hourRateForEfficiency
                    : taskCompletionPercent;

            var productivityState = GetProductivityState(
                plannedHours,
                timeCompletionPercent,
                openTasks,
                trackedHours);

            var bonus = CalculateBonusRecommendation(
                plannedHours,
                trackedHours,
                taskCompletionPercent,
                overdueTasks);

            return new PerformanceMetrics
            {
                PlannedHours = plannedHours,
                TrackedHours = trackedHours,
                WorkDayHours = workDayHours,
                IdleHours = idleHours,
                SalaryHours = trackedHours,
                WorkloadDiff = Math.Round(trackedHours - plannedHours, 2),
                TimeCompletionPercent = timeCompletionPercent,
                TaskCompletionPercent = taskCompletionPercent,
                Efficiency = efficiency,
                OpenTasks = openTasks,
                NewTasks = newTasks,
                ProgressTasks = progressTasks,
                ReviewTasks = reviewTasks,
                DoneTasks = doneTasks,
                OverdueTasks = overdueTasks,
                ProductivityState = productivityState,
                BonusPercent = bonus.Percent,
                BonusReason = bonus.Reason
            };
        }

        private static string BuildFullName(string? lastName, string? firstName, string? middleName)
        {
            return string.Join(" ", new[] { lastName, firstName, middleName }
                .Where(x => !string.IsNullOrWhiteSpace(x)));
        }

        private static string HashPassword(string value)
        {
            using var sha = System.Security.Cryptography.SHA256.Create();
            return Convert.ToHexString(
                sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(value))
            );
        }
    }
}
