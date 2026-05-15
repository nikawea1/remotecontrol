// Файл: RemoteControl1/Pages/MainPage.cshtml.cs

//MainPage.cshtml.cs
using ClosedXML.Excel;
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
        private readonly DashboardService _dashboardService;
        private readonly ProjectService _projectService;
        private readonly UserService _userService;
        private readonly ProfileService _profileService;
        private readonly TrackerService _trackerService;
        private readonly ReportService _reportService;
        private readonly FileStorageService _fileStorageService;

        public MainPageModel(
            AppDbContext db,
            TaskService taskService,
            DashboardService dashboardService,
            ProjectService projectService,
            UserService userService,
            ProfileService profileService,
            TrackerService trackerService,
            ReportService reportService,
            FileStorageService fileStorageService)
        {
            _db = db;
            _taskService = taskService;
            _dashboardService = dashboardService;
            _projectService = projectService;
            _userService = userService;
            _profileService = profileService;
            _trackerService = trackerService;
            _reportService = reportService;
            _fileStorageService = fileStorageService;
        }

        public string UserName { get; set; } = "";
        public string UserEmail { get; set; } = "";

        public string TasksJson { get; set; } = "[]";
        public string ProjectsJson { get; set; } = "[]";
        public string ActivityJson { get; set; } = "[]";
        public string UsersJson { get; set; } = "[]";
        public string WorkDaysJson { get; set; } = "[]";
        public string CalendarEventsJson { get; set; } = "[]";

        public int CurrentUserId { get; set; }
        public bool IsAdmin { get; set; }
        public string CurrentUserRole { get; set; } = "";
        public bool IsManager { get; set; }
        public bool IsEmployee { get; set; }

        public string CurrentUserLogin { get; set; } = "";
        public string CurrentUserPhone { get; set; } = "";
        public string CurrentUserPosition { get; set; } = "";
        public decimal CurrentUserRate { get; set; }
        public bool CurrentUserIsActive { get; set; }

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
            else if (IsManager)
            {
                var visibleProjectIds = await _db.Projects
                    .Where(p => p.ManagerId == user.Id || p.Members.Any(m => m.UserId == user.Id))
                    .Select(p => p.Id)
                    .ToListAsync();

                events = await _db.CalendarEvents
                    .Where(x =>
                        x.UserId == user.Id ||
                        x.CreatedByUserId == user.Id ||
                        (x.ProjectId.HasValue && visibleProjectIds.Contains(x.ProjectId.Value)))
                    .OrderBy(x => x.EventDate)
                    .ToListAsync();
            }
            else
            {
                var memberProjectIds = await _db.ProjectMembers
                    .Where(m => m.UserId == user.Id)
                    .Select(m => m.ProjectId)
                    .ToListAsync();

                events = await _db.CalendarEvents
                    .Where(x =>
                        x.UserId == user.Id ||
                        (x.ProjectId.HasValue && memberProjectIds.Contains(x.ProjectId.Value)))
                    .OrderBy(x => x.EventDate)
                    .ToListAsync();
            }

            CalendarEventsJson = JsonSerializer.Serialize(events);
            var data = await _dashboardService.GetPageDataAsync(user.Id);

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

            var data = await _reportService.GetAdminAnalyticsAsync(userId.Value, GetCurrentRole());

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
            int.TryParse(form["requestId"], out var requestId);
            int.TryParse(form["taskId"], out var taskId);
            decimal.TryParse(
                form["hours"],
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var hours);

            var dto = new AddManualTimeDto
            {
                RequestId = requestId,
                TaskId = taskId,
                Hours = hours,
                WorkDate = form["workDate"].ToString(),
                Reason = form["reason"].ToString(),
                Comment = form["comment"].ToString()
            };

            var file = Request.Form.Files.FirstOrDefault();

            if (file != null && file.Length > 0)
            {
                var storedFile = await _fileStorageService.SaveManualTimeAttachmentAsync(userId.Value, file);
                if (storedFile != null)
                {
                    dto.AttachmentPath = storedFile.Path;
                    dto.AttachmentName = storedFile.Name;
                }
            }

            var result = requestId > 0
                ? await _trackerService.UpdateManualTimeRequestAsync(userId.Value, dto)
                : await _trackerService.CreateManualTimeRequestAsync(userId.Value, dto);

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

            var items = await _trackerService.GetManualTimeRequestsAsync(userId.Value, GetCurrentRole());

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

            var result = await _trackerService.ApproveManualTimeRequestAsync(userId.Value, GetCurrentRole(), dto);

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

            var result = await _trackerService.RejectManualTimeRequestAsync(userId.Value, GetCurrentRole(), dto);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error
            });
        }


        public async Task<JsonResult> OnPostNeedsRevisionManualTimeRequestAsync([FromBody] NeedsRevisionManualTimeDto dto)
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Требуется вход" });

            var result = await _trackerService.ReturnManualTimeRequestForRevisionAsync(userId.Value, GetCurrentRole(), dto);

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

        public async Task<JsonResult> OnPostSubmitTaskForReviewAsync([FromBody] SubmitTaskForReviewDto dto)
        {
            var currentUserId = CurrentUserOrZero();
            if (currentUserId <= 0)
                return new JsonResult(new { ok = false, error = "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d" });

            if (!CurrentUserIsEmployee())
                return new JsonResult(new { ok = false, error = "\u041d\u0435\u0442 \u043f\u0440\u0430\u0432" });

            var isMyTask = await IsMyTaskAsync(dto.Id);
            if (!isMyTask)
                return new JsonResult(new { ok = false, error = "\u041d\u0435\u0442 \u043f\u0440\u0430\u0432" });

            var result = await _taskService.SubmitTaskForReviewAsync(currentUserId, dto);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                task = result.Data
            });
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

            var result = await _projectService.AddProjectAsync(CurrentUserOrZero(), dto);

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

            var result = await _projectService.UpdateProjectAsync(CurrentUserOrZero(), dto);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error,
                project = result.Data
            });
        }
        public async Task<JsonResult> OnPostDeleteProjectAsync([FromBody] DeleteProjectDto dto)
        {
            var currentUserId = CurrentUserOrZero();
            if (currentUserId <= 0)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            if (!CurrentUserIsManagerOrAdmin())
                return new JsonResult(new { ok = false, error = "Нет прав" });

            var result = await _projectService.DeleteProjectAsync(currentUserId, dto.Id);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error
            });
        }
        public async Task<JsonResult> OnPostStartWorkDayAsync()
        {
            var userId = await GetCurrentUserIdAsync();
            if (userId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _trackerService.StartWorkDayAsync(userId.Value);

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

            var result = await _trackerService.StopWorkDayAsync(userId.Value);

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

            var result = await _trackerService.StartTaskTimerAsync(userId.Value, dto);

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

            var result = await _trackerService.PauseTaskTimerAsync(userId.Value);

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

            var result = await _trackerService.StopTaskTimerAsync(userId.Value);

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

            var result = await _trackerService.AddManualTimeAsync(userId.Value, dto);

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

            var result = await _userService.AddUserAsync(dto);

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

            var result = await _userService.UpdateUserAsync(dto);

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

            var result = await _userService.ToggleUserStatusAsync(dto.Id);

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

            var storedFile = await _fileStorageService.SaveScreenshotAsync(userId.Value, file);
            if (storedFile == null)
                return new JsonResult(new { ok = false, error = "Файл не получен" });

            return new JsonResult(new
            {
                ok = true,
                fileName = storedFile.SavedName,
                filePath = storedFile.Path,
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

            var storedFile = await _fileStorageService.SaveWebcamSnapshotAsync(userId.Value, file);
            if (storedFile == null)
                return new JsonResult(new { ok = false, error = "Файл не получен" });

            return new JsonResult(new
            {
                ok = true,
                fileName = storedFile.SavedName,
                filePath = storedFile.Path
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
                    $"{row.Hours:0.##};" +
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

        public async Task<JsonResult> OnGetReportsDataAsync(string? dateFrom, string? dateTo, int? projectId, int? employeeId)
        {
            var currentUserId = await GetCurrentUserIdAsync();
            if (currentUserId == null)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var data = await _reportService.GetReportsDataAsync(
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
                .BorderColor(Colors.Grey.Lighten2)
                .Padding(4);
        }

        private Task<RemoteControl1.Services.ExportDataVm> BuildExportDataAsync(int? selectedUserId, string? dateFrom, string? dateTo, int? projectId)
        {
            return _reportService.BuildExportDataAsync(
                CurrentUserOrZero(),
                GetCurrentRole(),
                selectedUserId,
                dateFrom,
                dateTo,
                projectId);
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

            var result = await _profileService.ChangePasswordAsync(userId.Value, dto.OldPassword, dto.NewPassword);

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

            var result = await _profileService.GetProfileAsync(userId);
            if (!result.Ok || result.Data == null)
                return new JsonResult(new { ok = false, error = result.Error });

            var profile = result.Data;
            return new JsonResult(new
            {
                ok = true,
                profile = new
                {
                    contactNote = profile.ContactNote,
                    personalNote = profile.PersonalNote,
                    notifyInUi = profile.NotifyInUi,
                    rememberLastTask = profile.RememberLastTask,
                    allowScreenShots = profile.AllowScreenShots,
                    allowWebcamShots = profile.AllowWebcamShots,
                    screenIntervalSeconds = profile.ScreenIntervalSeconds,
                    webcamIntervalSeconds = profile.WebcamIntervalSeconds,
                    idleTimeoutMinutes = profile.IdleTimeoutMinutes
                }
            });
        }
        public async Task<JsonResult> OnPostSaveProfileContactNote([FromBody] SaveProfileContactNoteDto dto)
        {
            var userId = CurrentUserOrZero();
            if (userId <= 0)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _profileService.SaveProfileContactNoteAsync(userId, dto.ContactNote);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error
            });
        }
        public async Task<JsonResult> OnPostSaveProfilePreferences([FromBody] SaveProfilePreferencesDto dto)
        {
            var userId = CurrentUserOrZero();
            if (userId <= 0)
                return new JsonResult(new { ok = false, error = "Пользователь не найден" });

            var result = await _profileService.SaveProfilePreferencesAsync(
                userId,
                dto.NotifyInUi,
                dto.RememberLastTask,
                dto.AllowScreenShots,
                dto.AllowWebcamShots,
                dto.PersonalNote);

            return new JsonResult(new
            {
                ok = result.Ok,
                error = result.Error
            });
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

            var result = await _profileService.SaveProfileAsync(
                userId.Value,
                dto.Email,
                dto.Phone,
                dto.ContactNote,
                dto.NotifyInUi,
                dto.RememberLastTask,
                dto.AllowScreenShots,
                dto.AllowWebcamShots,
                dto.ScreenIntervalSeconds,
                dto.WebcamIntervalSeconds,
                dto.IdleTimeoutMinutes,
                dto.PersonalNote);

            if (!result.Ok || result.Data == null)
                return new JsonResult(new { ok = false, error = result.Error });

            var profile = result.Data;
            HttpContext.Session.SetString("user_email", profile.Email);

            return new JsonResult(new
            {
                ok = true,
                email = profile.Email,
                phone = profile.Phone,
                contactNote = profile.ContactNote,
                personalNote = profile.PersonalNote,
                notifyInUi = profile.NotifyInUi,
                rememberLastTask = profile.RememberLastTask,
                allowScreenShots = profile.AllowScreenShots,
                allowWebcamShots = profile.AllowWebcamShots,
                screenIntervalSeconds = profile.ScreenIntervalSeconds,
                webcamIntervalSeconds = profile.WebcamIntervalSeconds,
                idleTimeoutMinutes = profile.IdleTimeoutMinutes
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

            var data = await _trackerService.GetCurrentWorkDayStatusAsync(userId.Value);
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
