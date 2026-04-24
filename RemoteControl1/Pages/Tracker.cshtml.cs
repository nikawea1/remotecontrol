// Τΰιλ: RemoteControl1/Pages/Tracker.cshtml.cs
//Tracker.cshtml.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using RemoteControl1.Data;
using RemoteControl1.Services;
using System.Text.Json;

namespace RemoteControl1.Pages
{
    public class TrackerModel : PageModel
    {
        private readonly AppDbContext _db;
        private readonly TaskService _taskService;

        public TrackerModel(AppDbContext db, TaskService taskService)
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
        public string WorkDaysJson { get; set; } = "[]";

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

            TasksJson = JsonSerializer.Serialize(data.Tasks);
            WorkDaysJson = JsonSerializer.Serialize(data.WorkDays);

            return Page();
        }
    }
}
