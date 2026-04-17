using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RemoteControl1.Migrations
{
    /// <inheritdoc />
    public partial class AddUserWorkMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeSpan>(
                name: "PlannedEndTime",
                table: "Users",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<TimeSpan>(
                name: "PlannedStartTime",
                table: "Users",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RequiredDailyHours",
                table: "Users",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "WorkMode",
                table: "Users",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "fixed");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PlannedEndTime",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PlannedStartTime",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RequiredDailyHours",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "WorkMode",
                table: "Users");
        }
    }
}
