using Microsoft.EntityFrameworkCore;
using RemoteControl1.Models;

namespace RemoteControl1.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Project> Projects { get; set; } = null!;
        public DbSet<TaskItem> Tasks { get; set; } = null!;
        public DbSet<ActivityLog> ActivityLogs { get; set; } = null!;

        public DbSet<ProjectMember> ProjectMembers { get; set; } = null!;

        public DbSet<ManualTimeRequest> ManualTimeRequests { get; set; } = null!;

        public DbSet<CalendarEvent> CalendarEvents { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Login)
                .IsUnique();

            modelBuilder.Entity<User>()
                .Property(u => u.HourlyRate)
                .HasPrecision(10, 2);

            modelBuilder.Entity<Project>()
                .Property(p => p.ProjectType)
                .HasMaxLength(50)
                .HasDefaultValue("functional");

            modelBuilder.Entity<Project>()
                .Property(p => p.StageNamesJson)
                .HasDefaultValue("[]");

            modelBuilder.Entity<Project>()
                .HasOne(p => p.Manager)
                .WithMany()
                .HasForeignKey(p => p.ManagerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.Project)
                .WithMany()
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.User)
                .WithMany()
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<TaskItem>()
                .Property(t => t.StageName)
                .HasMaxLength(200)
                .HasDefaultValue("");

            modelBuilder.Entity<ProjectMember>()
                .HasOne(x => x.Project)
                .WithMany(x => x.Members)
                .HasForeignKey(x => x.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ProjectMember>()
                .HasOne(x => x.User)
                .WithMany(x => x.ProjectMembers)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ProjectMember>()
                .HasIndex(x => new { x.ProjectId, x.UserId })
                .IsUnique();

            modelBuilder.Entity<ManualTimeRequest>()
                .HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ManualTimeRequest>()
                .HasOne(x => x.TaskItem)
                .WithMany()
                .HasForeignKey(x => x.TaskItemId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ManualTimeRequest>()
                .HasOne(x => x.Project)
                .WithMany()
                .HasForeignKey(x => x.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<CalendarEvent>()
    .HasOne(x => x.Project)
    .WithMany()
    .HasForeignKey(x => x.ProjectId)
    .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<CalendarEvent>()
                .HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CalendarEvent>()
                .HasOne(x => x.CreatedByUser)
                .WithMany()
                .HasForeignKey(x => x.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            base.OnModelCreating(modelBuilder);
        }
    }
}