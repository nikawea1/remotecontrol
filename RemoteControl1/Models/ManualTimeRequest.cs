using System.ComponentModel.DataAnnotations;

namespace RemoteControl1.Models
{
    public class ManualTimeRequest
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User? User { get; set; }

        public int TaskItemId { get; set; }
        public TaskItem? TaskItem { get; set; }

        public int ProjectId { get; set; }
        public Project? Project { get; set; }

        public double Hours { get; set; }

        public string Comment { get; set; } = "";

        public string Status { get; set; } = "pending";
        // pending
        // approved
        // rejected

        public string? ManagerComment { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        public DateTime? ReviewedAtUtc { get; set; }

        public int? ReviewedByUserId { get; set; }

        public string? AttachmentPath { get; set; }
        public string? AttachmentName { get; set; }
    }
}