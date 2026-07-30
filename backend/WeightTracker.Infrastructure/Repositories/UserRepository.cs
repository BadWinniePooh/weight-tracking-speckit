using Microsoft.EntityFrameworkCore;
using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Interfaces.Repositories;
using WeightTracker.Infrastructure.Data;

namespace WeightTracker.Infrastructure.Repositories;

public class UserRepository(AppDbContext db) : IUserRepository
{
    public async Task<User?> GetByIdAsync(Guid id) =>
        await db.Users.FindAsync(id);

    public async Task<User?> GetByUsernameAsync(string username) =>
        await db.Users.FirstOrDefaultAsync(u =>
            u.Username.ToLower() == username.ToLower());

    public async Task<User?> GetByEmailAsync(string email) =>
        await db.Users.FirstOrDefaultAsync(u =>
            u.Email.ToLower() == email.ToLower());

    public async Task<bool> ExistsAnyAsync() =>
        await db.Users.AnyAsync();

    public async Task<bool> ExistsByUsernameAsync(string username) =>
        await db.Users.AnyAsync(u => u.Username.ToLower() == username.ToLower());

    public async Task<bool> ExistsByEmailAsync(string email) =>
        await db.Users.AnyAsync(u => u.Email.ToLower() == email.ToLower());

    public async Task<User> AddAsync(User user)
    {
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    public async Task UpdateAsync(User user)
    {
        db.Users.Update(user);
        await db.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        var user = await db.Users.FindAsync(id);
        if (user is not null)
        {
            db.Users.Remove(user);
            await db.SaveChangesAsync();
        }
    }

    public async Task<IReadOnlyList<User>> GetAllAsync() =>
        await db.Users.OrderBy(u => u.CreatedAt).ToListAsync();
}
