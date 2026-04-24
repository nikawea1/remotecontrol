// Τΰιλ: RemoteControl1/Pages/Reports.cshtml.cs
//Reports.cshtml.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Services;
using System.Text.Json;

namespace RemoteControl1.Pages
{
    public class ReportsModel : PageModel
    {
        private readonly AppDbContext _db;
        private readonly TaskService _taskService;

        public ReportsModel(AppDbContext db, TaskService taskService)
        {
            _db = db;
            _taskService = taskService;
        }

        public int CurrentUserId { get; set; }
        public string CurrentUserRole { get; set; } = "";
        public bool IsAdmin { get; set; }
        public bool IsManager { get; set; }
        public bool IsEmployee { get; set; }

        public string TasksJson { get; set; } = "[]";
        public string ProjectsJson { get; set; } = "[]";
        public string UsersJson { get; set; } = "[]";

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

            var data = await _taskService.GetPageDataAsync(user.Id);

            if (IsEmployee)
                data.Users = new List<UserVm>();

            if (IsEmployee)
                data.Projects = data.Projects
                    .Where(p => data.Tasks.Any(t => t.ProjectId == p.Id))
                    .ToList();

            TasksJson = JsonSerializer.Serialize(data.Tasks);
            ProjectsJson = JsonSerializer.Serialize(data.Projects);
            UsersJson = JsonSerializer.Serialize(data.Users);

            return Page();
        }
    }
}
