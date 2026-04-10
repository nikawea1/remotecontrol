using System;
using System.ComponentModel.DataAnnotations;

namespace RemoteControl1.Models
{
    public class CalendarEvent
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        public DateTime EventDate { get; set; }

        [MaxLength(50)]
        public string EventType { get; set; } = "meeting";

        [MaxLength(255)]
        public string? LocationOrLink { get; set; }

        public int? ProjectId { get; set; }
        public Project? Project { get; set; }

        public int UserId { get; set; }
        public User? User { get; set; }

        public int CreatedByUserId { get; set; }
        public User? CreatedByUser { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}