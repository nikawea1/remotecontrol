using System.ComponentModel.DataAnnotations;

namespace RemoteControl1.Models
{
    public class TaskItem
    {
        public int Id { get; set; }

        [Required]
        public string Title { get; set; } = "";

        public string Description { get; set; } = "";

        public string Status { get; set; } = "new";

        public string Priority { get; set; } = "medium";

        public string Assignee { get; set; } = "";

        public double PlannedTimeHours { get; set; }

        public DateTime? Deadline { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        public int ProjectId { get; set; }
        public Project? Project { get; set; }

        public int UserId { get; set; }
        public User? User { get; set; }

        // Название этапа внутри проекта
        public string StageName { get; set; } = "";
    }
}