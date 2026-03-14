using WeightTracker.Domain.Entities;

namespace WeightTracker.Domain.Interfaces.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<User> AddAsync(User user);
}
