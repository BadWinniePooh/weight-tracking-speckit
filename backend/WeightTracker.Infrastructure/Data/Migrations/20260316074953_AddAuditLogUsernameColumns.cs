using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeightTracker.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditLogUsernameColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ActorUsername",
                table: "AuditLog",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TargetUsername",
                table: "AuditLog",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActorUsername",
                table: "AuditLog");

            migrationBuilder.DropColumn(
                name: "TargetUsername",
                table: "AuditLog");
        }
    }
}
