using WeightTracker.Domain.Entities;
using WeightTracker.Domain.Models;

namespace WeightTracker.Domain.Interfaces.Repositories;

public interface IAuditLogRepository
{
    Task AppendAsync(AuditLogEntry entry);
    Task<AuditLogPage> QueryAsync(AuditLogFilter filter);
}
