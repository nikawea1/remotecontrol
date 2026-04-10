using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RemoteControl1.Migrations
{
    /// <inheritdoc />
    public partial class AddIsIdleToActivityLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsIdle",
                table: "ActivityLogs",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsIdle",
                table: "ActivityLogs");
        }
    }
}
