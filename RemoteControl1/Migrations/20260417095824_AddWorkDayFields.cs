using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RemoteControl1.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkDayFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "IdleHours",
                table: "ActivityLogs",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "OvertimeHours",
                table: "ActivityLogs",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PlannedHours",
                table: "ActivityLogs",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TrackedHours",
                table: "ActivityLogs",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "UnderworkHours",
                table: "ActivityLogs",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IdleHours",
                table: "ActivityLogs");

            migrationBuilder.DropColumn(
                name: "OvertimeHours",
                table: "ActivityLogs");

            migrationBuilder.DropColumn(
                name: "PlannedHours",
                table: "ActivityLogs");

            migrationBuilder.DropColumn(
                name: "TrackedHours",
                table: "ActivityLogs");

            migrationBuilder.DropColumn(
                name: "UnderworkHours",
                table: "ActivityLogs");
        }
    }
}
