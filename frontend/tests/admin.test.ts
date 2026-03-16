import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AdminUserDto, AuditLogEntryDto } from "../src/ts/api-client";

vi.mock("../src/ts/auth-guard", () => ({
  checkAuthStatus: vi.fn().mockResolvedValue({ isAuthenticated: true, setupRequired: false, role: "admin" }),
  enforceRedirect: vi.fn(),
}));

vi.mock("../src/ts/auth-token", () => ({
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue("mock-token"),
  clearAccessToken: vi.fn(),
  getUserRole: vi.fn().mockReturnValue("admin"),
  getUserId: vi.fn().mockReturnValue("admin-id-111"),
}));

vi.mock("../src/ts/config", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue(undefined),
    getApiUrl: vi.fn().mockReturnValue(""),
  };
});

const mockUsers: AdminUserDto[] = [
  {
    id: "admin-id-111",
    username: "admin_user",
    email: "admin@example.com",
    role: "admin",
    isActive: true,
    emailConfirmed: true,
    createdAt: "2026-01-01T00:00:00Z",
    lastLoginAt: "2026-03-15T10:00:00Z",
    scheduledDeletionAt: null,
    hasActiveSession: true,
  },
  {
    id: "user-id-222",
    username: "regular_user",
    email: "user@example.com",
    role: "user",
    isActive: true,
    emailConfirmed: true,
    createdAt: "2026-01-02T00:00:00Z",
    lastLoginAt: "2026-03-14T10:00:00Z",
    scheduledDeletionAt: null,
    hasActiveSession: false,
  },
  {
    id: "user-id-333",
    username: "inactive_user",
    email: "inactive@example.com",
    role: "user",
    isActive: false,
    emailConfirmed: true,
    createdAt: "2026-01-03T00:00:00Z",
    lastLoginAt: null,
    scheduledDeletionAt: "2026-04-15T00:00:00Z",
    hasActiveSession: false,
  },
];

vi.mock("../src/ts/api-client", () => ({
  adminListUsers: vi.fn().mockResolvedValue({ users: mockUsers }),
  adminCreateUser: vi.fn().mockResolvedValue({
    id: "new-id-444", username: "new_user", email: "new@example.com",
    role: "user", isActive: true, emailConfirmed: false,
    createdAt: "2026-03-16T00:00:00Z", lastLoginAt: null, scheduledDeletionAt: null,
    hasActiveSession: false,
  }),
  adminDeactivateUser: vi.fn().mockResolvedValue({ id: "user-id-222", isActive: false, scheduledDeletionAt: "2026-04-15T00:00:00Z" }),
  adminReactivateUser: vi.fn().mockResolvedValue({ id: "user-id-333", isActive: true, scheduledDeletionAt: null }),
  adminDeleteUser: vi.fn().mockResolvedValue(undefined),
  adminAssignRole: vi.fn().mockResolvedValue({ id: "user-id-222", role: "admin" }),
  adminResendConfirmation: vi.fn().mockResolvedValue(undefined),
  adminGetAuditLog: vi.fn().mockResolvedValue({
    entries: [
      {
        id: "entry-id-001",
        actionType: "UserDeactivated",
        actorUserId: "admin-id-111",
        actorUsername: "admin_user",
        targetUserId: "user-id-222",
        targetUsername: "regular_user",
        ipAddress: "127.0.0.1",
        timestamp: "2026-03-15T10:00:00Z",
      } as AuditLogEntryDto,
    ],
    totalCount: 1,
    page: 1,
    pageSize: 20,
  }),
  ApiError: class ApiError extends Error {
    status: number; field?: string;
    constructor(message: string, status: number, field?: string) {
      super(message); this.name = "ApiError"; this.status = status; this.field = field;
    }
  },
}));

function setupDom() {
  document.body.innerHTML = `
    <div class="stat-value" id="stat-total-users"></div>
    <div class="stat-value" id="stat-active-sessions"></div>
    <table><tbody id="user-table-body"></tbody></table>
    <button id="create-user-btn">Create User</button>
    <dialog id="create-user-modal">
      <form id="create-user-form">
        <input id="cu-username" type="text" />
        <input id="cu-email" type="email" />
        <select id="cu-role"><option value="user">user</option><option value="admin">admin</option></select>
        <div id="cu-feedback"></div>
        <button type="submit" id="cu-submit-btn">Create</button>
        <button type="button" id="cu-cancel-btn">Cancel</button>
      </form>
    </dialog>
    <dialog id="confirm-modal">
      <button id="confirm-modal-yes">Confirm</button>
      <button id="confirm-modal-cancel">Cancel</button>
    </dialog>
    <table><tbody id="audit-table-body"></tbody></table>
    <input id="audit-filter-from" type="date" />
    <input id="audit-filter-to" type="date" />
    <select id="audit-filter-action"><option value="">All</option><option value="user_created">UserCreated</option><option value="user_deactivated">UserDeactivated</option><option value="user_reactivated">UserReactivated</option><option value="user_deleted">UserDeleted</option><option value="role_changed">RoleChanged</option><option value="password_reset">PasswordReset</option></select>
    <button id="audit-apply-btn">Apply</button>
    <button id="audit-prev-btn">Previous</button>
    <button id="audit-next-btn">Next</button>
    <span id="audit-page-indicator"></span>
  `;
}

describe("admin page — auth guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
  });

  it("calls checkAuthStatus and enforceRedirect('admin') on init", async () => {
    const { checkAuthStatus, enforceRedirect } = await import("../src/ts/auth-guard");
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();
    expect(checkAuthStatus).toHaveBeenCalled();
    expect(enforceRedirect).toHaveBeenCalledWith("admin", expect.any(Object));
  });
});

describe("admin page — stats bar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
  });

  it("displays total user count from user list length", async () => {
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();
    const totalEl = document.getElementById("stat-total-users");
    expect(totalEl?.textContent).toBe("3");
  });

  it("displays active session count from hasActiveSession field", async () => {
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();
    // admin_user: hasActiveSession=true → counts
    // regular_user: hasActiveSession=false → does not count
    // inactive_user: hasActiveSession=false → does not count
    const sessionsEl = document.getElementById("stat-active-sessions");
    expect(sessionsEl?.textContent).toBe("1");
  });
});

describe("admin page — user table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
  });

  it("renders a row for each user", async () => {
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();
    const rows = document.querySelectorAll("#user-table-body tr");
    expect(rows).toHaveLength(3);
  });

  it("shows scheduled deletion date only for deactivated users", async () => {
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();
    const tbody = document.getElementById("user-table-body")!;
    const html = tbody.innerHTML;
    expect(html).toContain("2026-04-15");
  });

  it("disables deactivate, delete, and change-role for the admin's own row", async () => {
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();
    const ownRow = document.querySelector(`[data-user-id="admin-id-111"]`) as HTMLElement;
    expect(ownRow).toBeTruthy();
    const deactivateBtn = ownRow.querySelector(`[data-action="deactivate"]`) as HTMLButtonElement | null;
    const deleteBtn = ownRow.querySelector(`[data-action="delete"]`) as HTMLButtonElement | null;
    const changeRoleBtn = ownRow.querySelector(`[data-action="change-role"]`) as HTMLButtonElement | null;
    if (deactivateBtn) expect(deactivateBtn.disabled).toBe(true);
    if (deleteBtn) expect(deleteBtn.disabled).toBe(true);
    if (changeRoleBtn) expect(changeRoleBtn.disabled).toBe(true);
  });

  it("shows reactivate only for deactivated users", async () => {
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();
    const inactiveRow = document.querySelector(`[data-user-id="user-id-333"]`) as HTMLElement;
    const reactivateBtn = inactiveRow.querySelector(`[data-action="reactivate"]`);
    expect(reactivateBtn).toBeTruthy();

    const activeRow = document.querySelector(`[data-user-id="user-id-222"]`) as HTMLElement;
    const noReactivate = activeRow.querySelector(`[data-action="reactivate"]`);
    expect(noReactivate).toBeNull();
  });
});

describe("admin page — destructive actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
    // Auto-confirm: simulate user clicking "Confirm" in the dialog
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function () {
      document.getElementById("confirm-modal-yes")?.click();
    });
    HTMLDialogElement.prototype.close = vi.fn();
  });

  it("calls confirm dialog before deactivating a user", async () => {
    const { adminDeactivateUser } = await import("../src/ts/api-client");
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    const row = document.querySelector(`[data-user-id="user-id-222"]`) as HTMLElement;
    const btn = row.querySelector(`[data-action="deactivate"]`) as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(adminDeactivateUser).toHaveBeenCalledWith("user-id-222");
  });

  it("calls confirm dialog before deleting a user", async () => {
    const { adminDeleteUser } = await import("../src/ts/api-client");
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    const row = document.querySelector(`[data-user-id="user-id-222"]`) as HTMLElement;
    const btn = row.querySelector(`[data-action="delete"]`) as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(adminDeleteUser).toHaveBeenCalledWith("user-id-222");
  });

  it("does not call API when user cancels the dialog", async () => {
    // Auto-cancel: simulate user clicking "Cancel" in the dialog
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function () {
      document.getElementById("confirm-modal-cancel")?.click();
    });
    const { adminDeactivateUser, adminDeleteUser } = await import("../src/ts/api-client");
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    const row = document.querySelector(`[data-user-id="user-id-222"]`) as HTMLElement;
    const deactivateBtn = row.querySelector(`[data-action="deactivate"]`) as HTMLButtonElement;
    deactivateBtn.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(adminDeactivateUser).not.toHaveBeenCalled();
    expect(adminDeleteUser).not.toHaveBeenCalled();
  });
});

describe("admin page — create user modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
    // jsdom does not support showModal; stub it
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  it("opens the create user modal when create-user-btn is clicked", async () => {
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    document.getElementById("create-user-btn")!.click();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  });

  it("calls adminCreateUser and prepends new row on form submit", async () => {
    const { adminCreateUser } = await import("../src/ts/api-client");
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    const initialRows = document.querySelectorAll("#user-table-body tr").length;

    (document.getElementById("cu-username") as HTMLInputElement).value = "new_user";
    (document.getElementById("cu-email") as HTMLInputElement).value = "new@example.com";
    (document.getElementById("cu-role") as HTMLSelectElement).value = "user";
    document.getElementById("create-user-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 10));

    expect(adminCreateUser).toHaveBeenCalledWith("new_user", "new@example.com", "user");
    const newRows = document.querySelectorAll("#user-table-body tr").length;
    expect(newRows).toBe(initialRows + 1);
  });
});

describe("admin page — user status after reactivation (Bug #7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  // Bug #7: reactivating a user whose email is unconfirmed must show "pending confirmation"
  it("reactivated user with emailConfirmed=false shows 'pending confirmation' status and resend button", async () => {
    const { adminListUsers } = await import("../src/ts/api-client");
    (adminListUsers as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      users: [{
        id: "pending-id-999",
        username: "pending_user",
        email: "pending@example.com",
        role: "user",
        isActive: false,        // deactivated
        emailConfirmed: false,  // email also unconfirmed
        createdAt: "2026-01-01T00:00:00Z",
        lastLoginAt: null,
        scheduledDeletionAt: "2026-04-15T00:00:00Z",
        hasActiveSession: false,
      }],
    });

    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    // Initial status must be "inactive" badge (isActive=false takes precedence)
    const row = document.querySelector(`[data-user-id="pending-id-999"]`) as HTMLTableRowElement;
    expect(row).toBeTruthy();
    const initBadge = row.cells[3]?.querySelector("[data-status]") as HTMLElement | null;
    expect(initBadge?.dataset.status).toBe("inactive");

    // Reactivate
    const reactivateBtn = row.querySelector(`[data-action="reactivate"]`) as HTMLButtonElement;
    expect(reactivateBtn).toBeTruthy();
    reactivateBtn.click();
    await new Promise((r) => setTimeout(r, 10));

    // After reactivation: isActive=true, emailConfirmed=false → must show "pending" badge
    const newRow = document.querySelector(`[data-user-id="pending-id-999"]`) as HTMLTableRowElement;
    const newBadge = newRow.cells[3]?.querySelector("[data-status]") as HTMLElement | null;
    expect(newBadge?.dataset.status).toBe("pending"); // fails before fix
    // Resend Confirmation button must be visible
    expect(newRow.querySelector(`[data-action="resend-confirmation"]`)).toBeTruthy(); // fails before fix
  });

  it("reactivated user with emailConfirmed=true shows 'active' status and no resend button", async () => {
    const { adminListUsers } = await import("../src/ts/api-client");
    (adminListUsers as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      users: [{
        id: "active-id-888",
        username: "active_user",
        email: "active@example.com",
        role: "user",
        isActive: false,
        emailConfirmed: true,
        createdAt: "2026-01-01T00:00:00Z",
        lastLoginAt: null,
        scheduledDeletionAt: "2026-04-15T00:00:00Z",
        hasActiveSession: false,
      }],
    });

    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    const row = document.querySelector(`[data-user-id="active-id-888"]`) as HTMLTableRowElement;
    row.querySelector<HTMLButtonElement>(`[data-action="reactivate"]`)!.click();
    await new Promise((r) => setTimeout(r, 10));

    const newRow = document.querySelector(`[data-user-id="active-id-888"]`) as HTMLTableRowElement;
    const activeBadge = newRow.cells[3]?.querySelector("[data-status]") as HTMLElement | null;
    expect(activeBadge?.dataset.status).toBe("active");
    expect(newRow.querySelector(`[data-action="resend-confirmation"]`)).toBeNull();
  });
});

describe("admin page — audit log section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  it("renders actorUsername in audit table (not UUID)", async () => {
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    const tbody = document.getElementById("audit-table-body")!;
    expect(tbody.innerHTML).toContain("admin_user");
    expect(tbody.innerHTML).not.toContain("admin-id-111");
  });

  it("renders targetUsername in audit table", async () => {
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    const tbody = document.getElementById("audit-table-body")!;
    expect(tbody.innerHTML).toContain("regular_user");
  });

  it("calls adminGetAuditLog with filter params when apply button clicked", async () => {
    const { adminGetAuditLog } = await import("../src/ts/api-client");
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    (document.getElementById("audit-filter-from") as HTMLInputElement).value = "2026-01-01";
    (document.getElementById("audit-filter-to") as HTMLInputElement).value = "2026-03-31";
    (document.getElementById("audit-filter-action") as HTMLSelectElement).value = "user_deactivated";
    document.getElementById("audit-apply-btn")!.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(adminGetAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        fromDate: "2026-01-01",
        toDate: "2026-03-31",
        actionType: "user_deactivated",
        page: 1,
      })
    );
  });

  // Bug #10: dropdown values must use snake_case to match backend expectations
  it("sends snake_case action type to API (not PascalCase)", async () => {
    const { adminGetAuditLog } = await import("../src/ts/api-client");
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    (document.getElementById("audit-filter-action") as HTMLSelectElement).value = "user_deactivated";
    document.getElementById("audit-apply-btn")!.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(adminGetAuditLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ actionType: "user_deactivated" })
    );
  });

  it("shows page indicator with current page", async () => {
    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    const indicator = document.getElementById("audit-page-indicator");
    expect(indicator?.textContent).toContain("1");
  });

  it("renders empty audit table when entries array is empty", async () => {
    const { adminGetAuditLog } = await import("../src/ts/api-client");
    (adminGetAuditLog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      entries: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
    });

    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    const tbody = document.getElementById("audit-table-body")!;
    expect(tbody.querySelectorAll("tr")).toHaveLength(0);
  });
});

describe("admin page — stats bar live refresh (FR-028)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function () {
      document.getElementById("confirm-modal-yes")?.click();
    });
    HTMLDialogElement.prototype.close = vi.fn();
  });

  it("stat-total-users updates after creating a new user (T055)", async () => {
    const { adminListUsers } = await import("../src/ts/api-client");
    const newUser = {
      id: "new-id-444", username: "new_user", email: "new@example.com",
      role: "user", isActive: true, emailConfirmed: false,
      createdAt: "2026-03-16T00:00:00Z", lastLoginAt: null, scheduledDeletionAt: null,
      hasActiveSession: false,
    };
    (adminListUsers as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ users: mockUsers })
      .mockResolvedValueOnce({ users: [...mockUsers, newUser] });

    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    expect(document.getElementById("stat-total-users")?.textContent).toBe("3");

    (document.getElementById("cu-username") as HTMLInputElement).value = "new_user";
    (document.getElementById("cu-email") as HTMLInputElement).value = "new@example.com";
    (document.getElementById("cu-role") as HTMLSelectElement).value = "user";
    document.getElementById("create-user-form")!.dispatchEvent(new Event("submit"));
    await new Promise((r) => setTimeout(r, 30));

    expect(document.getElementById("stat-total-users")?.textContent).toBe("4");
  });

  it("stat-active-sessions updates after deactivating a user (T055)", async () => {
    const { adminListUsers } = await import("../src/ts/api-client");
    const usersAfterDeactivate = mockUsers.map((u) => ({ ...u, hasActiveSession: false }));
    (adminListUsers as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ users: mockUsers })
      .mockResolvedValueOnce({ users: usersAfterDeactivate });

    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    expect(document.getElementById("stat-active-sessions")?.textContent).toBe("1");

    const row = document.querySelector(`[data-user-id="user-id-222"]`) as HTMLElement;
    const btn = row.querySelector(`[data-action="deactivate"]`) as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 30));

    expect(document.getElementById("stat-active-sessions")?.textContent).toBe("0");
  });
});

describe("admin page — audit log datetime format (FR-030)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  it("renders audit log timestamp as YYYY-MM-DD HH:mm pattern (T061)", async () => {
    const { adminGetAuditLog } = await import("../src/ts/api-client");
    (adminGetAuditLog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      entries: [
        {
          id: "entry-id-001",
          actionType: "UserDeactivated",
          actorUserId: "admin-id-111",
          actorUsername: "admin_user",
          targetUserId: "user-id-222",
          targetUsername: "regular_user",
          ipAddress: "127.0.0.1",
          timestamp: "2026-03-16T14:30:00Z",
        } as AuditLogEntryDto,
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
    });

    const { initAdminPage } = await import("../src/ts/admin");
    await initAdminPage();

    const tbody = document.getElementById("audit-table-body")!;
    const firstRow = tbody.querySelector("tr");
    const timestampCell = firstRow?.cells[0];
    const text = timestampCell?.textContent?.trim() ?? "";

    // Must be 16 chars and match YYYY-MM-DD HH:mm pattern (not date-only)
    expect(text).toHaveLength(16);
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
