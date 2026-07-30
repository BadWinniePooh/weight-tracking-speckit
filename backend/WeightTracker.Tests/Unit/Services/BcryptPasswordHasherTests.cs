using WeightTracker.Infrastructure.Services;
using Xunit;

namespace WeightTracker.Tests.Unit.Services;

public class BcryptPasswordHasherTests
{
    private readonly BcryptPasswordHasher _hasher = new();

    [Fact]
    public void Hash_ReturnsNonEmptyBcryptString()
    {
        var hash = _hasher.Hash("mypassword");

        Assert.NotNull(hash);
        Assert.Equal(60, hash.Length);
        Assert.StartsWith("$2", hash);
    }

    [Fact]
    public void Verify_CorrectPassword_ReturnsTrue()
    {
        var hash = _hasher.Hash("correctpassword");

        Assert.True(_hasher.Verify("correctpassword", hash));
    }

    [Fact]
    public void Verify_WrongPassword_ReturnsFalse()
    {
        var hash = _hasher.Hash("correctpassword");

        Assert.False(_hasher.Verify("wrongpassword", hash));
    }
}
