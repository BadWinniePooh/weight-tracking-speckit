using WeightTracker.Api;

namespace WeightTracker.Tests.Unit;

public class ConnectionStringBuilderTests
{
    [Fact]
    public void BuildConnectionString_WithAllVars_ReturnsValidNpgsqlConnectionString()
    {
        // Arrange
        var host = "db";
        var port = "5432";
        var name = "weighttracker";
        var user = "weighttracker";
        var password = "secret";

        // Act
        var result = ConnectionStringBuilder.Build(host, port, name, user, password);

        // Assert
        Assert.Equal("Host=db;Port=5432;Database=weighttracker;Username=weighttracker;Password=secret", result);
    }

    [Fact]
    public void BuildConnectionString_WithCustomPort_IncludesPortInResult()
    {
        // Arrange & Act
        var result = ConnectionStringBuilder.Build("myhost", "5433", "mydb", "myuser", "mypassword");

        // Assert
        Assert.Contains("Port=5433", result);
        Assert.Contains("Host=myhost", result);
        Assert.Contains("Database=mydb", result);
        Assert.Contains("Username=myuser", result);
        Assert.Contains("Password=mypassword", result);
    }
}
