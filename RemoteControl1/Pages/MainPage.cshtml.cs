using ClosedXML.Excel;
using DocumentFormat.OpenXml.InkML;
//using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RemoteControl1.Data;
using RemoteControl1.Models;
using RemoteControl1.Services;
using System.Text;
using System.Text.Json;

namespace RemoteControl1.Pages
{
    public class MainPageModel : PageModel
    {
        private readonly AppDbContext _db;
        private readonly TaskService _taskService;
        private readonly IWebHostEnvironment _env;

        public MainPageModel(AppDbContext db, TaskService taskService, IWebHostEnvironment env)
        {
            _db = db;
            _taskService = taskService;
            _env = env;
        }

        public string UserName { get; set; } = "";
        public string UserEmail { get; set; } = "";

        public string TasksJson { get; set; } = "[]";
        public string ProjectsJson { get; set; } = "[]";
        public string ActivityJson { get; set; } = "[]";
        public string UsersJson { get; set; } = "[]";

        public int CurrentUserId { get; set; }
        public bool IsAdmin { get; set; }
        public string CurrentUserRole { get; set; } = "";
        public bool IsManager { get; set; }
        public bool IsEmployee { get; set; }

        public string WorkDaysJson { get; set; } = "[]";

        public string CurrentUserLogin { get; set; } = "";
        public string CurrentUserPhone { get; set; } = "";
        public string CurrentUserPosition { get; set; } = "";
        public decimal CurrentUserRate { get; set; }
        public bool CurrentUserIsActive { get; set; }


        public string CalendarEventsJson { get; set; } = "[]";

        public async Task<IActionResult> OnGetAsync()
        {
            var sessionUserId = HttpContext.Session.GetInt32("user_id");
            if (sessionUserId == null || sessionUserId <= 0)
                return RedirectToPage("/Auth");

            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == sessionUserId.Value);
            if (user == null)
                return RedirectToPage("/Auth");

            UserName = HttpContext.Session.GetString("user_name") ?? "";
            UserEmail = HttpContext.Session.GetString("user_email") ?? "";

            CurrentUserId = user.Id;
            CurrentUserRole = (user.Role ?? "").ToLower();
            IsAdmin = CurrentUserRole == "admin";
            IsManager = !IsAdmin && CurrentUserRole == "manager";
            IsEmployee = !IsAdmin && !IsManager;

            CurrentUserLogin = user.Login ?? "";
            CurrentUserPhone = user.Phone ?? "";
            CurrentUserPosition = user.Position ?? "";
            CurrentUserRate = user.HourlyRate;
            CurrentUserIsActive = user.IsActive;

            List<CalendarEvent> events;

            if (IsAdmin)
            {
                events = await _db.CalendarEvents
                    .OrderBy(x => x.EventDate)
                    .ToListAsync();
            }
            else
            {
                events = await _db.CalendarEvents
                    .Where(x => x.UserId == user.Id)
                    .OrderBy(x => x.EventDate)
                    .ToListAsync();
            }

            CalendarEventsJson = JsonSerializer.Serialize(events);



            var data = await _taskService.GetPageDataAsync(user.Id);

            if (IsEmployee)
                data.Users = new List<UserVm>();

            if (IsEmployee)
                data.Projects = data.Projects
                    .Where(p => data.Tasks.Any(t => t.ProjectId == p.Id))
                    .ToList();

            TasksJson = JsonSerializer.Serialize(data.Tasks);
            ProjectsJson = JsonSerializer.Serialize(data.Projects);
            ActivityJson = JsonSerializer.Serialize(data.Activity);
            UsersJson = JsonSerializer.Serialize(data.Users);
            WorkDaysJson = JsonSerializer.Serialize(data.WorkDays);

            return Page();
        }

        public async Task<JsonResult> OnGetAdminAnalyticsAsync()
        {
            if (!CurrentUserIsManagerOrAdmin())
                return new JsonResult(new { ok = false, error = "Нет прав" });

            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var data = await _taskService.GetAdminAnalyticsAsync(userId.Value, GetCurrentRole());

            return new JsonResult(new
            {
                ok = true,
                analytics = data
            });
        }


        public async Task<JsonResult> OnPostCreateManualTimeRequestAsync()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var form = Request.Form;

            int.TryParse(form["taskId"], out var taskId);
            decimal.TryParse(form["hours"], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var hours);

            var dto = new AddManualTimeDto
            {
                TaskId = taskId,
                Hours = hours,
                Comment = form["comment"].ToString()
            };

            var file = Request.Form.Files.FirstOrDefault();

            if (file != null && file.Length > 0)
            {
                var uploadsRoot = Path.Combine(_env.WebRootPath, "uploads", "manual-time", userId.Value.ToString());
                Directory.CreateDirectory(uploadsRoot);

                var ext = Path.GetExtension(file.FileName);
                var savedName = $"{Guid.NewGuid():N}{ext}";
                var fullPath = Path.Combine(uploadsRoot, savedName);

                using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                dto.AttachmentPath = $"/uploads/manual-time/{userId.Value}/{savedName}";
                dto.AttachmentName = file.FileName;
            }

            var result = await _taskService.CreateManualTimeRequestAsync(userId.Value, dto);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                request = result.Data
            });
        }

        public async Task<JsonResult> OnGetManualTimeRequestsAsync()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var items = await _taskService.GetManualTimeRequestsAsync(userId.Value, GetCurrentRole());

            return new JsonResult(new
            {
                ok = true,
                items
            });
        }

        public async Task<JsonResult> OnPostApproveManualTimeRequestAsync([FromBody] ApproveManualTimeDto dto)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _taskService.ApproveManualTimeRequestAsync(userId.Value, GetCurrentRole(), dto);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error
            });
        }

        public async Task<JsonResult> OnPostRejectManualTimeRequestAsync([FromBody] RejectManualTimeDto dto)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _taskService.RejectManualTimeRequestAsync(userId.Value, GetCurrentRole(), dto);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error
            });
        }


        public async Task<JsonResult> OnPostAddTaskAsync([FromBody] AddTaskDto dto)
        {
            if (!CurrentUserIsManagerOrAdmin())
                return new JsonResult(new { ok = false, error = "Нет прав" });

            var result = await _taskService.AddTaskAsync(CurrentUserOrZero(), dto);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                task = result.Data
            });
        }

        public async Task<JsonResult> OnPostUpdateTaskAsync([FromBody] UpdateTaskDto dto)
        {
            var currentUserId = CurrentUserOrZero();
            if (currentUserId <= 0)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            if (CurrentUserIsManagerOrAdmin())
            {
                var result = await _taskService.UpdateTaskAsync(currentUserId, dto);

                return new JsonResult(new
                {
                    ok = result.Ok,
                    error = result.Error,
                    task = result.Data
                });
            }

            if (CurrentUserIsEmployee())
            {
                var isMyTask = await IsMyTaskAsync(dto.Id);
                if (!isMyTask)
                    return new JsonResult(new { ok = false, error = "Нет прав" });

                var result = await _taskService.UpdateTaskAsync(currentUserId, dto);

                return new JsonResult(new
                {
                    ok = result.Ok,
                    error = result.Error,
                    task = result.Data
                });
            }

            return new JsonResult(new { ok = false, error = "Нет прав" });
        }

        public async Task<JsonResult> OnPostDeleteTaskAsync([FromBody] DeleteTaskDto dto)
        {
            var currentUserId = CurrentUserOrZero();
            if (currentUserId <= 0)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            if (!CurrentUserIsManagerOrAdmin())
                return new JsonResult(new { ok = false, error = "Нет прав" });

            var result = await _taskService.DeleteTaskAsync(currentUserId, dto.Id);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error
            });
        }

        public async Task<JsonResult> OnPostAddProjectAsync([FromBody] AddProjectDto dto)
        {
            if (!CurrentUserIsManagerOrAdmin())
                return new JsonResult(new { ok = false, error = "Нет прав" });

            var result = await _taskService.AddProjectAsync(CurrentUserOrZero(), dto);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                project = result.Data
            });
        }
        public async Task<JsonResult> OnPostUpdateProjectAsync([FromBody] UpdateProjectDto dto)
        {
            if (!CurrentUserIsManagerOrAdmin())
                return new JsonResult(new { ok = false, error = "Нет прав" });

            if (dto == null || dto.Id <= 0)
                return new JsonResult(new { ok = false, error = "Проект не найден" });

            if (string.IsNullOrWhiteSpace(dto.Name))
                return new JsonResult(new { ok = false, error = "Введите название проекта" });

            var currentUserId = CurrentUserOrZero();

            var project = await _db.Projects
                .Include(p => p.Manager)
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == dto.Id);

            if (project == null)
                return new JsonResult(new { ok = false, error = "Проект не найден" });

            if (CurrentUserIsManager() && project.ManagerId != currentUserId)
                return new JsonResult(new { ok = false, error = "Нет прав на этот проект" });

            int managerId;

            if (CurrentUserIsAdmin())
            {
                if (!dto.ManagerId.HasValue || dto.ManagerId.Value <= 0)
                    return new JsonResult(new { ok = false, error = "Выберите менеджера проекта" });

                managerId = dto.ManagerId.Value;
            }
            else
            {
                managerId = currentUserId;
            }

            var manager = await _db.Users.FirstOrDefaultAsync(x => x.Id == managerId);
            if (manager == null)
                return new JsonResult(new { ok = false, error = "Менеджер не найден" });

            project.Name = dto.Name.Trim();
            project.Description = dto.Description?.Trim() ?? "";
            project.ManagerId = managerId;

            project.ProjectType = NormalizeProjectType(dto.ProjectType);
            project.StageNamesJson = SerializeStageNames(dto.StageNames);

            var newMemberIds = (dto.MemberIds ?? new List<int>())
                .Where(x => x > 0)
                .Distinct()
                .ToList();

            if (!newMemberIds.Contains(managerId))
                newMemberIds.Add(managerId);

            var existingMembers = await _db.ProjectMembers
                .Where(x => x.ProjectId == project.Id)
                .ToListAsync();

            var membersToDelete = existingMembers
                .Where(x => !newMemberIds.Contains(x.UserId))
                .ToList();

            if (membersToDelete.Count > 0)
                _db.ProjectMembers.RemoveRange(membersToDelete);

            var existingUserIds = existingMembers.Select(x => x.UserId).ToHashSet();

            foreach (var memberId in newMemberIds)
            {
                if (existingUserIds.Contains(memberId))
                    continue;

                var userExists = await _db.Users.AnyAsync(x => x.Id == memberId);
                if (!userExists)
                    continue;

                _db.ProjectMembers.Add(new ProjectMember
                {
                    ProjectId = project.Id,
                    UserId = memberId
                });
            }

            await _db.SaveChangesAsync();

            var tasksCount = await _db.Tasks.CountAsync(t => t.ProjectId == project.Id);
            var doneCount = await _db.Tasks.CountAsync(t => t.ProjectId == project.Id && t.Status == "done");

            var stageNames = JsonSerializer.Deserialize<List<string>>(project.StageNamesJson ?? "[]") ?? new List<string>();

            var stagePercents = new List<int>();

            foreach (var stageName in stageNames)
            {
                var stageTasks = await _db.Tasks
                    .Where(t => t.ProjectId == project.Id && t.StageName == stageName)
                    .ToListAsync();

                if (stageTasks.Count == 0)
                {
                    stagePercents.Add(0);
                    continue;
                }

                var stageDone = stageTasks.Count(t => t.Status == "done");
                var stageProgress = (int)Math.Round(stageDone * 100.0 / stageTasks.Count);
                stagePercents.Add(stageProgress);
            }

            var projectProgress = stagePercents.Count > 0
                ? (int)Math.Round(stagePercents.Average())
                : 0;

            return new JsonResult(new
            {
                ok = true,
                project = new
                {
                    id = project.Id,
                    name = project.Name,
                    description = project.Description ?? "",
                    tasksCount = tasksCount,
                    progress = projectProgress,
                    managerId = project.ManagerId,
                    managerName = string.Join(" ", new[] { manager.LastName, manager.FirstName, manager.MiddleName }
                        .Where(x => !string.IsNullOrWhiteSpace(x))),
                    memberIds = newMemberIds,
                    membersCount = newMemberIds.Count,
                    projectTypeName = project.ProjectType switch
                    {
                        "linear" => "Линейный",
                        "hybrid" => "Гибридный",
                        _ => "Функциональный"
                    },
                    stageNames = stageNames
                }
            });
        }
        public async Task<JsonResult> OnPostDeleteProjectAsync([FromBody] DeleteProjectDto dto)
        {
            var currentUserId = CurrentUserOrZero();
            if (currentUserId <= 0)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            if (!CurrentUserIsManagerOrAdmin())
                return new JsonResult(new { ok = false, error = "Нет прав" });

            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == dto.Id);

            if (project == null)
                return new JsonResult(new { ok = false, error = "Проект не найден" });

            if (CurrentUserIsManager() && project.ManagerId != currentUserId)
                return new JsonResult(new { ok = false, error = "Нет прав на этот проект" });

            var projectTaskIds = await _db.Tasks
                .Where(t => t.ProjectId == dto.Id)
                .Select(t => t.Id)
                .ToListAsync();

            var activityLogs = await _db.ActivityLogs
                .Where(a =>
                    a.ProjectId == dto.Id ||
                    (a.TaskItemId.HasValue && projectTaskIds.Contains(a.TaskItemId.Value)))
                .ToListAsync();

            if (activityLogs.Count > 0)
                _db.ActivityLogs.RemoveRange(activityLogs);

            var projectTasks = await _db.Tasks
                .Where(t => t.ProjectId == dto.Id)
                .ToListAsync();

            if (projectTasks.Count > 0)
                _db.Tasks.RemoveRange(projectTasks);

            var projectMembers = await _db.ProjectMembers
                .Where(x => x.ProjectId == dto.Id)
                .ToListAsync();

            if (projectMembers.Count > 0)
                _db.ProjectMembers.RemoveRange(projectMembers);

            _db.Projects.Remove(project);

            await _db.SaveChangesAsync();

            return new JsonResult(new { ok = true });
        }

        public async Task<JsonResult> OnPostStartWorkDayAsync()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _taskService.StartWorkDayAsync(userId.Value);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error
            });
        }

        public async Task<JsonResult> OnPostStopWorkDayAsync()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _taskService.StopWorkDayAsync(userId.Value);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                hours = result.Data
            });
        }

        public async Task<JsonResult> OnPostStartTaskTimerAsync([FromBody] StartTaskTimerDto dto)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var isMyTask = await IsMyTaskAsync(dto.TaskId);
            if (!isMyTask)
                return new JsonResult(new { ok = false, error = "Можно запускать только свои задачи" });

            var result = await _taskService.StartTaskTimerAsync(userId.Value, dto);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error
            });
        }

        public async Task<JsonResult> OnPostPauseTaskTimerAsync()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _taskService.PauseTaskTimerAsync(userId.Value);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                hours = result.Data
            });
        }

        public async Task<JsonResult> OnPostStopTaskTimerAsync()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _taskService.StopTaskTimerAsync(userId.Value);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                hours = result.Data
            });
        }

        public async Task<JsonResult> OnPostAddManualTimeAsync([FromBody] AddManualTimeDto dto)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var isMyTask = await IsMyTaskAsync(dto.TaskId);
            if (!isMyTask)
                return new JsonResult(new { ok = false, error = "Можно учитывать время только по своим задачам" });

            var result = await _taskService.AddManualTimeAsync(userId.Value, dto);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                entry = result.Data == null ? null : new
                {
                    date = result.Data.Date,
                    task = result.Data.Task,
                    hours = result.Data.Hours,
                    comment = result.Data.Comment
                }
            });
        }

        public async Task<JsonResult> OnPostAddUserAsync([FromBody] AddUserDto dto)
        {
            if (!CurrentUserIsAdmin())
                return new JsonResult(new { ok = false, error = "Нет прав" });

            var result = await _taskService.AddUserAsync(dto);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                user = result.Data
            });
        }

        public async Task<JsonResult> OnPostUpdateUserAsync([FromBody] UpdateUserDto dto)
        {
            if (!CurrentUserIsAdmin())
                return new JsonResult(new { ok = false, error = "Нет прав" });

            var result = await _taskService.UpdateUserAsync(dto);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                user = result.Data
            });
        }

        public async Task<JsonResult> OnPostToggleUserStatusAsync([FromBody] ToggleUserStatusDto dto)
        {
            if (!CurrentUserIsAdmin())
                return new JsonResult(new { ok = false, error = "Нет прав" });

            var result = await _taskService.ToggleUserStatusAsync(dto.Id);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                user = result.Data
            });
        }

        public async Task<JsonResult> OnPostUploadScreenshotAsync()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var file = Request.Form.Files.FirstOrDefault();
            if (file == null || file.Length == 0)
                return new JsonResult(new { ok = false, error = "Файл не получен" });

            var taskIdText = Request.Form["taskId"].ToString();
            int.TryParse(taskIdText, out var taskId);

            var folder = Path.Combine(
                @"C:\Users\Lenovo\Pictures\Screenshots",
                userId.Value.ToString()
            );
            Directory.CreateDirectory(folder);

            var fileName = $"{DateTime.Now:yyyyMMdd_HHmmss}.png";
            var filePath = Path.Combine(folder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return new JsonResult(new
            {
                ok = true,
                fileName,
                taskId
            });
        }

        public async Task<JsonResult> OnPostUploadWebcamScreenshotAsync()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var file = Request.Form.Files.FirstOrDefault();
            if (file == null || file.Length == 0)
                return new JsonResult(new { ok = false, error = "Файл не получен" });

            var folder = Path.Combine(
                @"C:\Users\Lenovo\Pictures\Screenshots",
                userId.Value.ToString()
            );
            Directory.CreateDirectory(folder);

            var fileName = $"webcam_{DateTime.Now:yyyyMMdd_HHmmss}.png";
            var filePath = Path.Combine(folder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return new JsonResult(new
            {
                ok = true,
                fileName
            });
        }
      
        public async Task<IActionResult> OnGetExportCsvAsync(string? dateFrom, string? dateTo, int? projectId)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return RedirectToPage("/Auth");


            var selectedUserId = Request.Query["userId"].FirstOrDefault();
            int? userIdParsed = int.TryParse(selectedUserId, out var uid) ? uid : null;



            var data = await BuildExportDataAsync(userIdParsed, dateFrom, dateTo, projectId);

            var sb = new StringBuilder();
            sb.AppendLine("Дата;Задача;Проект;Часы;Комментарий;Статус;Исполнитель;Дедлайн");

            foreach (var row in data.Rows)
            {
                sb.AppendLine(
                    $"{EscapeCsv(row.Date)};" +
                    $"{EscapeCsv(row.Task)};" +
                    $"{EscapeCsv(row.Project)};" +
                    $"{row.Hours.ToString("0.##")};" +
                    $"{EscapeCsv(row.Comment)};" +
                    $"{EscapeCsv(row.Status)};" +
                    $"{EscapeCsv(row.Assignee)};" +
                    $"{EscapeCsv(row.Deadline)}");
            }

            var bytes = Encoding.UTF8.GetPreamble()
                .Concat(Encoding.UTF8.GetBytes(sb.ToString()))
                .ToArray();

            return File(bytes, "text/csv; charset=utf-8", "report.csv");
        }

        public async Task<IActionResult> OnGetExportExcelAsync(string? dateFrom, string? dateTo, int? projectId)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return RedirectToPage("/Auth");

            var selectedUserId = Request.Query["userId"].FirstOrDefault();
            int? userIdParsed = int.TryParse(selectedUserId, out var uid) ? uid : null;

            var data = await BuildExportDataAsync(userIdParsed, dateFrom, dateTo, projectId);

            using var wb = new XLWorkbook();

            var ws1 = wb.Worksheets.Add("Сводка");
            ws1.Cell(1, 1).Value = "Показатель";
            ws1.Cell(1, 2).Value = "Значение";

            ws1.Cell(2, 1).Value = "Пользователь";
            ws1.Cell(2, 2).Value = data.UserName;

            ws1.Cell(3, 1).Value = "Часов всего";
            ws1.Cell(3, 2).Value = data.TotalHours;

            ws1.Cell(4, 1).Value = "Записей";
            ws1.Cell(4, 2).Value = data.Rows.Count;

            ws1.Cell(5, 1).Value = "Завершенных задач";
            ws1.Cell(5, 2).Value = data.DoneTasks;

            ws1.Columns().AdjustToContents();

            var ws2 = wb.Worksheets.Add("Активность");
            ws2.Cell(1, 1).Value = "Дата";
            ws2.Cell(1, 2).Value = "Задача";
            ws2.Cell(1, 3).Value = "Проект";
            ws2.Cell(1, 4).Value = "Часы";
            ws2.Cell(1, 5).Value = "Комментарий";
            ws2.Cell(1, 6).Value = "Статус";
            ws2.Cell(1, 7).Value = "Исполнитель";
            ws2.Cell(1, 8).Value = "Дедлайн";

            var rowIndex = 2;
            foreach (var row in data.Rows)
            {
                ws2.Cell(rowIndex, 1).Value = row.Date;
                ws2.Cell(rowIndex, 2).Value = row.Task;
                ws2.Cell(rowIndex, 3).Value = row.Project;
                ws2.Cell(rowIndex, 4).Value = row.Hours;
                ws2.Cell(rowIndex, 5).Value = row.Comment;
                ws2.Cell(rowIndex, 6).Value = row.Status;
                ws2.Cell(rowIndex, 7).Value = row.Assignee;
                ws2.Cell(rowIndex, 8).Value = row.Deadline;
                rowIndex++;
            }

            ws2.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            wb.SaveAs(stream);

            return File(
                stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "report.xlsx");
        }

        public async Task<IActionResult> OnGetExportWordAsync(string? dateFrom, string? dateTo, int? projectId)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return RedirectToPage("/Auth");

            var selectedUserId = Request.Query["userId"].FirstOrDefault();
            int? userIdParsed = int.TryParse(selectedUserId, out var uid) ? uid : null;

            var data = await BuildExportDataAsync(userIdParsed, dateFrom, dateTo, projectId);

            var html = new StringBuilder();
            html.AppendLine("<html><head><meta charset='utf-8'></head><body>");
            html.AppendLine("<h1>Отчет Remote Control</h1>");
            html.AppendLine($"<p><b>Пользователь:</b> {System.Net.WebUtility.HtmlEncode(data.UserName)}</p>");
            html.AppendLine($"<p><b>Всего часов:</b> {data.TotalHours:0.##}</p>");
            html.AppendLine($"<p><b>Записей:</b> {data.Rows.Count}</p>");
            html.AppendLine($"<p><b>Завершенных задач:</b> {data.DoneTasks}</p>");

            html.AppendLine("<table border='1' cellpadding='5' cellspacing='0'>");
            html.AppendLine("<tr><th>Дата</th><th>Задача</th><th>Проект</th><th>Часы</th><th>Комментарий</th><th>Статус</th><th>Исполнитель</th><th>Дедлайн</th></tr>");

            foreach (var row in data.Rows)
            {
                html.AppendLine("<tr>");
                html.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(row.Date)}</td>");
                html.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(row.Task)}</td>");
                html.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(row.Project)}</td>");
                html.AppendLine($"<td>{row.Hours:0.##}</td>");
                html.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(row.Comment)}</td>");
                html.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(row.Status)}</td>");
                html.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(row.Assignee)}</td>");
                html.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(row.Deadline)}</td>");
                html.AppendLine("</tr>");
            }

            html.AppendLine("</table>");
            html.AppendLine("</body></html>");

            return File(
                Encoding.UTF8.GetBytes(html.ToString()),
                "application/msword",
                "report.doc");
        }


        /*public async Task<JsonResult> OnGetReportDataAsync(string? dateFrom, string? dateTo, int? projectId, int? userId)
        {
            var currentUserId = await GetCurrentUserIdAsync();
            if (currentUserId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            int targetUserId = currentUserId.Value;

            if (CurrentUserIsAdmin())
            {
                if (userId.HasValue)
                    targetUserId = userId.Value;
            }
            else if (CurrentUserIsManager())
            {
                if (userId.HasValue)
                {
                    var managerProjectIds = await _db.Projects
                        .Where(p => p.ManagerId == currentUserId)
                        .Select(p => p.Id)
                        .Distinct()
                        .ToListAsync();

                    var allowed = await _db.Tasks.AnyAsync(t =>
                        t.UserId == userId.Value &&
                        managerProjectIds.Contains(t.ProjectId));

                    if (allowed)
                        targetUserId = userId.Value;
                }
            }

            var result = await _taskService.GetReportDataAsync(targetUserId, dateFrom, dateTo, projectId);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                data = result.Data
            });
        }
        */

        public async Task<JsonResult> OnGetReportsDataAsync(string? dateFrom, string? dateTo, int? projectId, int? employeeId)
        {
            var currentUserId = await GetCurrentUserIdAsync();
            if (currentUserId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var data = await _taskService.GetReportsDataAsync(
                currentUserId.Value,
                GetCurrentRole(),
                CurrentUserIsAdmin(),
                dateFrom,
                dateTo,
                projectId,
                employeeId
            );

            return new JsonResult(new
            {
                ok = true,
                data
            });
        }


        public async Task<IActionResult> OnGetExportPdfAsync(string? dateFrom, string? dateTo, int? projectId)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return RedirectToPage("/Auth");

            var selectedUserId = Request.Query["userId"].FirstOrDefault();
            int? userIdParsed = int.TryParse(selectedUserId, out var uid) ? uid : null;

            var data = await BuildExportDataAsync(userIdParsed, dateFrom, dateTo, projectId);


            var pdfBytes = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Margin(20);
                    page.Size(PageSizes.A4);
                    page.DefaultTextStyle(x => x.FontSize(10));

                    page.Content().Column(col =>
                    {
                        col.Item().Text("Отчет Remote Control").FontSize(18).Bold();
                        col.Item().Text($"Пользователь: {data.UserName}");
                        col.Item().Text($"Всего часов: {data.TotalHours:0.##}");
                        col.Item().Text($"Записей: {data.Rows.Count}");
                        col.Item().Text($"Завершенных задач: {data.DoneTasks}");
                        col.Item().PaddingTop(10);

                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(2);
                                columns.RelativeColumn(3);
                                columns.RelativeColumn(3);
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(3);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Element(CellStyle).Text("Дата");
                                header.Cell().Element(CellStyle).Text("Задача");
                                header.Cell().Element(CellStyle).Text("Проект");
                                header.Cell().Element(CellStyle).Text("Часы");
                                header.Cell().Element(CellStyle).Text("Комментарий");
                            });

                            foreach (var row in data.Rows)
                            {
                                table.Cell().Element(CellStyle).Text(row.Date);
                                table.Cell().Element(CellStyle).Text(row.Task);
                                table.Cell().Element(CellStyle).Text(row.Project);
                                table.Cell().Element(CellStyle).Text($"{row.Hours:0.##}");
                                table.Cell().Element(CellStyle).Text(row.Comment);
                            }
                        });
                    });
                });
            }).GeneratePdf();

            return File(pdfBytes, "application/pdf", "report.pdf");
        }

        private static IContainer CellStyle(IContainer container)
        {
            return container
                .Border(1)
                .BorderColor(QuestPDF.Helpers.Colors.Grey.Lighten2)
                .Padding(4);
        }

       private async Task<ExportDataVm> BuildExportDataAsync(int? selectedUserId, string? dateFrom, string? dateTo, int? projectId)
{
    var currentUserId = await GetCurrentUserIdAsync();
    if (currentUserId == null)
        return new ExportDataVm();

    int targetUserId = currentUserId.Value;

    if (CurrentUserIsAdmin())
    {
        if (selectedUserId.HasValue)
            targetUserId = selectedUserId.Value;
    }
    else if (CurrentUserIsManager())
    {
        if (selectedUserId.HasValue)
        {
            var managerProjectIds = await _db.Projects
                .Where(p => p.ManagerId == currentUserId.Value)
                .Select(p => p.Id)
                .ToListAsync();

            var allowed = await _db.Tasks.AnyAsync(t =>
                t.UserId == selectedUserId.Value &&
                managerProjectIds.Contains(t.ProjectId));

            if (allowed)
                targetUserId = selectedUserId.Value;
        }
    }

    var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == targetUserId);

    DateTime? from = null;
    DateTime? to = null;

    if (DateTime.TryParse(dateFrom, out var fromDate))
        from = fromDate.Date;

    if (DateTime.TryParse(dateTo, out var toDate))
        to = toDate.Date.AddDays(1).AddTicks(-1);

    var query = _db.ActivityLogs
        .Include(a => a.TaskItem)
            .ThenInclude(t => t!.Project)
        .Where(a =>
            a.UserId == targetUserId &&
            (a.ActivityType == "task_timer" || a.ActivityType == "manual_time"));

    if (CurrentUserIsManager())
    {
        var managerProjectIds = await _db.Projects
            .Where(p => p.ManagerId == currentUserId.Value)
            .Select(p => p.Id)
            .ToListAsync();

        query = query.Where(a => a.ProjectId.HasValue && managerProjectIds.Contains(a.ProjectId.Value));
    }

    if (from.HasValue)
        query = query.Where(a => (a.EndedAtUtc ?? a.StartedAtUtc) >= from.Value);

    if (to.HasValue)
        query = query.Where(a => (a.EndedAtUtc ?? a.StartedAtUtc) <= to.Value);

    if (projectId.HasValue)
        query = query.Where(a => a.ProjectId == projectId.Value);

    var logs = await query
        .OrderByDescending(a => a.EndedAtUtc ?? a.StartedAtUtc)
        .ToListAsync();

    var rows = logs.Select(a => new ExportRowVm
    {
        Date = (a.EndedAtUtc ?? a.StartedAtUtc).ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
        Task = a.TaskItem?.Title ?? "Без задачи",
        Project = a.TaskItem?.Project?.Name ?? "Без проекта",
        Hours = a.DurationHours,
        Comment = string.IsNullOrWhiteSpace(a.Comment) ? "Без комментария" : a.Comment!,
        Status = a.TaskItem?.Status ?? "-",
        Assignee = a.TaskItem?.Assignee ?? "-",
        Deadline = a.TaskItem?.Deadline.HasValue == true
            ? a.TaskItem.Deadline.Value.ToString("dd.MM.yyyy")
            : "-"
    }).ToList();

    var taskIds = logs
        .Where(a => a.TaskItemId.HasValue)
        .Select(a => a.TaskItemId!.Value)
        .Distinct()
        .ToList();

    var doneTasks = await _db.Tasks
        .Where(t => taskIds.Contains(t.Id) && t.Status == "done")
        .CountAsync();

    return new ExportDataVm
    {
        UserName = user == null
            ? ""
            : string.Join(" ", new[] { user.LastName, user.FirstName, user.MiddleName }
                .Where(x => !string.IsNullOrWhiteSpace(x))),
        TotalHours = logs.Sum(x => x.DurationHours),
        DoneTasks = doneTasks,
        Rows = rows
    };
}
        
        private static string EscapeCsv(string? value)
        {
            var text = value ?? "";
            text = text.Replace("\"", "\"\"");
            return $"\"{text}\"";
        }

        private int CurrentUserOrZero()
        {
            return HttpContext.Session.GetInt32("user_id") ?? 0;
        }

        private Task<int?> GetCurrentUserIdAsync()
        {
            return Task.FromResult(HttpContext.Session.GetInt32("user_id"));
        }


        public class ChangePasswordDto
        {
            public string OldPassword { get; set; } = "";
            public string NewPassword { get; set; } = "";
        }

        public async Task<JsonResult> OnPostChangePasswordAsync([FromBody] ChangePasswordDto dto)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _taskService.ChangePasswordAsync(userId.Value, dto.OldPassword, dto.NewPassword);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error
            });
        }

        private string GetCurrentRole()
        {
            return HttpContext.Session.GetString("user_role") ?? "employee";
        }

        private bool CurrentUserIsAdmin() => GetCurrentRole() == "admin";
        private bool CurrentUserIsManager() => GetCurrentRole() == "manager";
        private bool CurrentUserIsEmployee() => GetCurrentRole() == "employee";


        private bool CurrentUserIsManagerOrAdmin()
        {
            return CurrentUserIsAdmin() || CurrentUserIsManager();
        }


        private async Task<List<Project>> GetAvailableProjects()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new List<Project>();

            if (CurrentUserIsAdmin())
            {
                return await _db.Projects.ToListAsync();
            }

            if (CurrentUserIsManager())
            {
                return await _db.Projects
                    .Where(p => p.ManagerId == userId.Value)
                    .ToListAsync();
            }

            return await _db.Projects
                .Where(p => _db.Tasks.Any(t => t.ProjectId == p.Id && t.UserId == userId.Value))
                .ToListAsync();
        }

        private async Task<List<TaskItem>> GetAvailableTasks()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new List<TaskItem>();

            if (CurrentUserIsAdmin())
            {
                return await _db.Tasks.ToListAsync();
            }

            if (CurrentUserIsManager())
            {
                var projectIds = await _db.Projects
                    .Where(p => p.ManagerId == userId.Value)
                    .Select(p => p.Id)
                    .ToListAsync();

                return await _db.Tasks
                    .Where(t => projectIds.Contains(t.ProjectId))
                    .ToListAsync();
            }

            return await _db.Tasks
    .Where(t => t.UserId == userId.Value)
    .ToListAsync();
        }

        private async Task<bool> IsMyTaskAsync(int taskId)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return false;

            var task = await _db.Tasks.FirstOrDefaultAsync(x => x.Id == taskId);
            if (task == null)
                return false;

            return task.UserId == userId.Value;
        }

        public IActionResult OnPostLogout()
        {
            HttpContext.Session.Clear();
            return new JsonResult(new { ok = true, redirect = "/Auth" });
        }

        private int GetCurrentUserId()
        {
            return HttpContext.Session.GetInt32("user_id") ?? 0;
        }

       

        public class SaveProfileContactNoteDto
        {
            public string? ContactNote { get; set; }
        }

        public class SaveProfilePreferencesDto
        {
            public bool NotifyInUi { get; set; }
            public bool RememberLastTask { get; set; }
            public bool AllowScreenShots { get; set; }
            public bool AllowWebcamShots { get; set; }
            public string? PersonalNote { get; set; }
        }

        public async Task<JsonResult> OnGetProfile()
        {
            var userId = CurrentUserOrZero();
            if (userId <= 0)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            return new JsonResult(new
            {
                ok = true,
                profile = new
                {
                    contactNote = user.ContactNote ?? "",
                    personalNote = user.PersonalNote ?? "",
                    notifyInUi = user.NotifyInUi,
                    rememberLastTask = user.RememberLastTask,
                    allowScreenShots = user.AllowScreenShots,
                    allowWebcamShots = user.AllowWebcamShots,
                    screenIntervalSeconds = user.ScreenIntervalSeconds,
                    webcamIntervalSeconds = user.WebcamIntervalSeconds,
                    idleTimeoutMinutes = user.IdleTimeoutMinutes
                }
            });
        }

        public async Task<JsonResult> OnPostSaveProfileContactNote([FromBody] SaveProfileContactNoteDto dto)
        {
            var userId = CurrentUserOrZero();
            if (userId <= 0)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            user.ContactNote = dto.ContactNote?.Trim() ?? "";
            await _db.SaveChangesAsync();

            return new JsonResult(new { ok = true });
        }

        public async Task<JsonResult> OnPostSaveProfilePreferences([FromBody] SaveProfilePreferencesDto dto)
        {
            var userId = CurrentUserOrZero();
            if (userId <= 0)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (user == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            user.NotifyInUi = dto.NotifyInUi;
            user.RememberLastTask = dto.RememberLastTask;
            user.AllowScreenShots = dto.AllowScreenShots;
            user.AllowWebcamShots = dto.AllowWebcamShots;
            user.PersonalNote = dto.PersonalNote?.Trim() ?? "";

            await _db.SaveChangesAsync();

            return new JsonResult(new { ok = true });
        }


        public class SaveProfileDto
        {
            public string? Email { get; set; }
            public string? Phone { get; set; }
            public string? ContactNote { get; set; }

            public bool NotifyInUi { get; set; }
            public bool RememberLastTask { get; set; }
            public bool AllowScreenShots { get; set; }
            public bool AllowWebcamShots { get; set; }

            public int ScreenIntervalSeconds { get; set; }
            public int WebcamIntervalSeconds { get; set; }
            public int IdleTimeoutMinutes { get; set; }

            public string? PersonalNote { get; set; }
        }

        public async Task<JsonResult> OnPostSaveProfileAsync([FromBody] SaveProfileDto dto)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId.Value);
            if (user == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var email = (dto.Email ?? "").Trim().ToLowerInvariant();
            var phone = (dto.Phone ?? "").Trim();

            if (string.IsNullOrWhiteSpace(email))
                return new JsonResult(new { ok = false, error = "Введите email" });

            if (!new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email))
                return new JsonResult(new { ok = false, error = "Некорректный email" });

            var emailBusy = await _db.Users.AnyAsync(x => x.Email == email && x.Id != user.Id);
            if (emailBusy)
                return new JsonResult(new { ok = false, error = "Этот email уже занят" });

            user.Email = email;
            user.Phone = string.IsNullOrWhiteSpace(phone) ? null : phone;
            user.ContactNote = dto.ContactNote?.Trim() ?? "";
            user.NotifyInUi = dto.NotifyInUi;
            user.RememberLastTask = dto.RememberLastTask;
            user.AllowScreenShots = dto.AllowScreenShots;
            user.AllowWebcamShots = dto.AllowWebcamShots;
            user.PersonalNote = dto.PersonalNote?.Trim() ?? "";
            user.ScreenIntervalSeconds = dto.ScreenIntervalSeconds < 5 ? 5 : dto.ScreenIntervalSeconds;
            user.WebcamIntervalSeconds = dto.WebcamIntervalSeconds < 5 ? 5 : dto.WebcamIntervalSeconds;
            user.IdleTimeoutMinutes = dto.IdleTimeoutMinutes < 1 ? 1 : dto.IdleTimeoutMinutes;

            await _db.SaveChangesAsync();

            HttpContext.Session.SetString("user_email", user.Email);

            return new JsonResult(new
            {
                ok = true,
                email = user.Email,
                phone = user.Phone ?? "",
                contactNote = user.ContactNote ?? "",
                personalNote = user.PersonalNote ?? "",
                notifyInUi = user.NotifyInUi,
                rememberLastTask = user.RememberLastTask,
                allowScreenShots = user.AllowScreenShots,
                allowWebcamShots = user.AllowWebcamShots,
                screenIntervalSeconds = user.ScreenIntervalSeconds,
                webcamIntervalSeconds = user.WebcamIntervalSeconds,
                idleTimeoutMinutes = user.IdleTimeoutMinutes
            });
        }

        private static string NormalizeProjectType(string? value)
        {
            var type = (value ?? "").Trim().ToLower();

            if (type == "linear" || type == "functional" || type == "hybrid")
                return type;

            return "functional";
        }

        private static string SerializeStageNames(List<string>? items)
        {
            var clean = (items ?? new List<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim())
                .Distinct()
                .ToList();

            return JsonSerializer.Serialize(clean);
        }

        public async Task<JsonResult> OnGetMyOwnTasksAsync()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, items = new List<object>() });

            var items = await _db.Tasks
                .Include(t => t.Project)
                .Where(t => t.UserId == userId.Value)
                .OrderByDescending(t => t.Id)
                .Select(t => new
                {
                    id = t.Id,
                    name = t.Title,
                    description = t.Description,
                    project = t.Project != null ? t.Project.Name : "",
                    projectId = t.ProjectId,
                    userId = t.UserId,
                    assignee = t.Assignee,
                    priority = t.Priority,
                    status = t.Status,
                    plannedTime = t.PlannedTimeHours,
                    deadline = t.Deadline.HasValue ? t.Deadline.Value.ToString("dd.MM.yyyy") : "",
                    deadlineRaw = t.Deadline.HasValue ? t.Deadline.Value.ToString("yyyy-MM-dd") : "",
                    stageName = t.StageName ?? ""
                })
                .ToListAsync();

            return new JsonResult(new
            {
                ok = true,
                items
            });
        }

        public async Task<JsonResult> OnGetWorkDayStatusAsync()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var data = await _taskService.GetCurrentWorkDayStatusAsync(userId.Value);
            return new JsonResult(new { ok = true, status = data });
        }


        private class ExportDataVm
        {
            public string UserName { get; set; } = "";
            public decimal TotalHours { get; set; }
            public int DoneTasks { get; set; }
            public List<ExportRowVm> Rows { get; set; } = new();
        }

        private class ExportRowVm
        {
            public string Date { get; set; } = "";
            public string Task { get; set; } = "";
            public string Project { get; set; } = "";
            public decimal Hours { get; set; }
            public string Comment { get; set; } = "";
            public string Status { get; set; } = "";
            public string Assignee { get; set; } = "";
            public string Deadline { get; set; } = "";
        }
            

    }
}