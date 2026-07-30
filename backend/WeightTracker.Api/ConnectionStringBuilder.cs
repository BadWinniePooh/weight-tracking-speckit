namespace WeightTracker.Api;

public static class ConnectionStringBuilder
{
    public static string Build(string host, string port, string name, string user, string password)
        => $"Host={host};Port={port};Database={name};Username={user};Password={password}";
}
