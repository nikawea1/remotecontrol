using System.ComponentModel.DataAnnotations;

namespace RemoteControl1.Models
{
    public class ActivityLog
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User? User { get; set; }

        public int? TaskItemId { get; set; }
        public TaskItem? TaskItem { get; set; }

        public int? ProjectId { get; set; }
        public Project? Project { get; set; }

        [Required]
        public string ActivityType { get; set; } = "";
        // workday
        // task_timer
        // manual_time

        public DateTime StartedAtUtc { get; set; }

        public DateTime? EndedAtUtc { get; set; }

        public decimal DurationHours { get; set; }
            
        public string? Comment { get; set; }

        public bool IsActive { get; set; } = true;

        public bool IsIdle { get; set; } = false;





        public decimal TrackedHours { get; set; }
        public decimal IdleHours { get; set; }
        public decimal PlannedHours { get; set; }
        public decimal OvertimeHours { get; set; }
        public decimal UnderworkHours { get; set; }



    }
}