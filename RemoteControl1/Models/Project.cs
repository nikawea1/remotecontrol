using System.ComponentModel.DataAnnotations;

namespace RemoteControl1.Models
{
    public class Project
    {
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = "";

        public string? Description { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public int? ManagerId { get; set; }
        public User? Manager { get; set; }

        // linear / functional / hybrid
        [Required]
        public string ProjectType { get; set; } = "functional";

        // JSON-строка со списком этапов проекта
        [Required]
        public string StageNamesJson { get; set; } = "[]";

        public List<ProjectMember> Members { get; set; } = new();
    }
}