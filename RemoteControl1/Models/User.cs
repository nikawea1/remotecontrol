using System.ComponentModel.DataAnnotations;

namespace RemoteControl1.Models
{
    public class User
    {
        public int Id { get; set; }

        [Required]
        public string FirstName { get; set; } = "";

        [Required]
        public string LastName { get; set; } = "";

        public string? MiddleName { get; set; }

        [Required]
        public string Email { get; set; } = "";

        [Required]
        public string Login { get; set; } = "";

        [Required]
        public string PasswordHash { get; set; } = "";

        [Required]
        public string Role { get; set; } = "employee";

        public string Position { get; set; } = "";

        public decimal HourlyRate { get; set; }

        public string? Phone { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<ProjectMember> ProjectMembers { get; set; } = new();

        public bool IsWorking { get; set; } = false;
        public DateTime? WorkStartUtc { get; set; }

        public bool NotifyInUi { get; set; } = true;
        public bool RememberLastTask { get; set; } = false;
        public bool AllowScreenShots { get; set; } = true;
        public bool AllowWebcamShots { get; set; } = true;

        public int ScreenIntervalSeconds { get; set; } = 10;
        public int WebcamIntervalSeconds { get; set; } = 10;
        public int IdleTimeoutMinutes { get; set; } = 3;

        public string? PersonalNote { get; set; }
        public string? ContactNote { get; set; }


        public string WorkMode { get; set; } = "fixed"; // fixed / flexible
        public decimal RequiredDailyHours { get; set; } = 8m;

        public TimeSpan? PlannedStartTime { get; set; }
        public TimeSpan? PlannedEndTime { get; set; }


    }
}