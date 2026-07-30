namespace WeightTracker.Domain;

/// <summary>
/// Single source of truth for authentication lifetimes. The refresh window slides:
/// every successful refresh issues a new token valid for another
/// <see cref="RefreshTokenDays"/>, which is what guarantees "signed in for at
/// least one week" of inactivity.
/// </summary>
public static class AuthConstants
{
    public const int AccessTokenMinutes = 15;
    public const int AccessTokenSeconds = AccessTokenMinutes * 60;
    public const int RefreshTokenDays = 7;

    /// <summary>
    /// How long a rotated (replaced) refresh token stays usable so a client that
    /// lost the rotation response over a flaky connection can retry instead of
    /// being logged out. Accepted trade-off: a captured token is replayable for
    /// this window. Explicit revocation (logout) is immediate and not graced.
    /// </summary>
    public const int RotationGraceSeconds = 60;
}
