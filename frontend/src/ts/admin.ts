import { checkAuthStatus, enforceRedirect } from "./auth-guard";
import {
  adminListUsers,
  adminCreateUser,
  adminDeactivateUser,
  adminReactivateUser,
  adminDeleteUser,
  adminAssignRole,
  adminResendConfirmation,
  adminGetAuditLog,
  ApiError,
  type AdminUserDto,
} from "./api-client";
import { getUserId } from "./auth-token";
import { loadConfig } from "./config";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function userStatus(user: AdminUserDto): string {
  if (!user.isActive) return "deactivated";
  if (!user.emailConfirmed) return "pending confirmation";
  return "active";
}

function renderUserRow(user: AdminUserDto, currentUserId: string | null): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.dataset.userId = user.id;

  const isOwnAccount = user.id === currentUserId;
  const deletionCell = user.scheduledDeletionAt
    ? `<td>${formatDate(user.scheduledDeletionAt)}</td>`
    : "<td>—</td>";

  const deactivateBtn = user.isActive
    ? `<button data-action="deactivate" data-user-id="${user.id}"${isOwnAccount ? " disabled title=\"Cannot deactivate own account\"" : ""}>Deactivate</button>`
    : "";
  const reactivateBtn = !user.isActive
    ? `<button data-action="reactivate" data-user-id="${user.id}">Reactivate</button>`
    : "";
  const deleteBtn = `<button data-action="delete" data-user-id="${user.id}"${isOwnAccount ? " disabled title=\"Cannot delete own account\"" : ""}>Delete</button>`;
  const changeRoleBtn = `<button data-action="change-role" data-user-id="${user.id}" data-current-role="${user.role}"${isOwnAccount ? " disabled title=\"Cannot change own role\"" : ""}>Change Role</button>`;
  const resendBtn = !user.emailConfirmed
    ? `<button data-action="resend-confirmation" data-user-id="${user.id}">Resend Confirmation</button>`
    : "";

  tr.innerHTML = `
    <td>${user.username}</td>
    <td>${user.email}</td>
    <td>${user.role}</td>
    <td>${userStatus(user)}</td>
    <td>${formatDate(user.lastLoginAt)}</td>
    ${deletionCell}
    <td>
      ${deactivateBtn}
      ${reactivateBtn}
      ${deleteBtn}
      ${changeRoleBtn}
      ${resendBtn}
    </td>
  `;

  return tr;
}

function wireRowActions(tbody: HTMLElement): void {
  tbody.addEventListener("click", async (e) => {
    const btn = (e.target as Element).closest("[data-action]") as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;

    const action = btn.dataset.action;
    const userId = btn.dataset.userId;
    if (!userId) return;

    if (action === "deactivate") {
      if (!window.confirm("Deactivate this user?")) return;
      try {
        await adminDeactivateUser(userId);
        const row = tbody.querySelector(`[data-user-id="${userId}"]`) as HTMLTableRowElement | null;
        if (row) {
          const newRow = renderUserRow(
            { ...parseRowData(row), isActive: false, scheduledDeletionAt: new Date(Date.now() + 30 * 86400000).toISOString() },
            getUserId()
          );
          row.replaceWith(newRow);
        }
      } catch { /* handled silently */ }
    }

    if (action === "reactivate") {
      try {
        await adminReactivateUser(userId);
        const row = tbody.querySelector(`[data-user-id="${userId}"]`) as HTMLTableRowElement | null;
        if (row) {
          const newRow = renderUserRow(
            { ...parseRowData(row), isActive: true, scheduledDeletionAt: null },
            getUserId()
          );
          row.replaceWith(newRow);
        }
      } catch { /* handled silently */ }
    }

    if (action === "delete") {
      if (!window.confirm("Permanently delete this user?")) return;
      try {
        await adminDeleteUser(userId);
        const row = tbody.querySelector(`[data-user-id="${userId}"]`);
        if (row) row.remove();
      } catch { /* handled silently */ }
    }

    if (action === "change-role") {
      const currentRole = btn.dataset.currentRole ?? "user";
      const newRole = currentRole === "admin" ? "user" : "admin";
      try {
        await adminAssignRole(userId, newRole);
        const row = tbody.querySelector(`[data-user-id="${userId}"]`) as HTMLTableRowElement | null;
        if (row) {
          const newRow = renderUserRow(
            { ...parseRowData(row), role: newRole },
            getUserId()
          );
          row.replaceWith(newRow);
        }
      } catch { /* handled silently */ }
    }

    if (action === "resend-confirmation") {
      try {
        await adminResendConfirmation(userId);
      } catch { /* handled silently */ }
    }
  });
}

function parseRowData(row: HTMLTableRowElement): AdminUserDto {
  return {
    id: row.dataset.userId ?? "",
    username: row.cells[0]?.textContent?.trim() ?? "",
    email: row.cells[1]?.textContent?.trim() ?? "",
    role: row.cells[2]?.textContent?.trim() ?? "user",
    isActive: row.cells[3]?.textContent?.trim() === "active",
    emailConfirmed: row.cells[3]?.textContent?.trim() !== "pending confirmation",
    createdAt: "",
    lastLoginAt: null,
    scheduledDeletionAt: null,
  };
}

let auditPage = 1;

async function loadAuditLog(page: number): Promise<void> {
  const fromInput = document.getElementById("audit-filter-from") as HTMLInputElement | null;
  const toInput = document.getElementById("audit-filter-to") as HTMLInputElement | null;
  const actionSelect = document.getElementById("audit-filter-action") as HTMLSelectElement | null;
  const tbody = document.getElementById("audit-table-body");
  const pageIndicator = document.getElementById("audit-page-indicator");
  const prevBtn = document.getElementById("audit-prev-btn") as HTMLButtonElement | null;
  const nextBtn = document.getElementById("audit-next-btn") as HTMLButtonElement | null;

  if (!tbody) return;

  const params = {
    page,
    pageSize: 20,
    fromDate: fromInput?.value || undefined,
    toDate: toInput?.value || undefined,
    actionType: actionSelect?.value || undefined,
  };

  try {
    const result = await adminGetAuditLog(params);
    tbody.innerHTML = "";
    for (const entry of result.entries) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDate(entry.timestamp)}</td>
        <td>${entry.actorUsername}</td>
        <td>${entry.actionType}</td>
        <td>${entry.targetUsername ?? "—"}</td>
      `;
      tbody.appendChild(tr);
    }

    auditPage = result.page;
    const totalPages = Math.ceil(result.totalCount / result.pageSize) || 1;
    if (pageIndicator) pageIndicator.textContent = `Page ${result.page} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = result.page <= 1;
    if (nextBtn) nextBtn.disabled = result.page >= totalPages;
  } catch { /* handled silently */ }
}

export async function initAdminPage(): Promise<void> {
  await loadConfig();
  const state = await checkAuthStatus();
  enforceRedirect("admin", state);

  const currentUserId = getUserId();

  // Load users and populate stats + table
  const { users } = await adminListUsers();

  const totalEl = document.getElementById("stats-total-users");
  const sessionsEl = document.getElementById("stats-active-sessions");
  if (totalEl) totalEl.textContent = String(users.length);
  if (sessionsEl) {
    const activeSessions = users.filter((u) => u.hasActiveSession).length;
    sessionsEl.textContent = String(activeSessions);
  }

  const tbody = document.getElementById("user-table-body");
  if (tbody) {
    tbody.innerHTML = "";
    for (const user of users) {
      tbody.appendChild(renderUserRow(user, currentUserId));
    }
    wireRowActions(tbody);
  }

  // Create user modal
  const createBtn = document.getElementById("create-user-btn");
  const modal = document.getElementById("create-user-modal") as HTMLDialogElement | null;
  const createForm = document.getElementById("create-user-form") as HTMLFormElement | null;
  const cuFeedback = document.getElementById("cu-feedback");

  if (createBtn && modal) {
    createBtn.addEventListener("click", () => {
      modal.showModal();
    });
  }

  if (createForm && modal && tbody) {
    createForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (cuFeedback) cuFeedback.textContent = "";

      const username = (document.getElementById("cu-username") as HTMLInputElement).value.trim();
      const email = (document.getElementById("cu-email") as HTMLInputElement).value.trim();
      const role = (document.getElementById("cu-role") as HTMLSelectElement).value;

      try {
        const newUser = await adminCreateUser(username, email, role);
        const newRow = renderUserRow(newUser, currentUserId);
        tbody.prepend(newRow);
        modal.close();
        createForm.reset();
      } catch (err) {
        if (cuFeedback) {
          cuFeedback.textContent = err instanceof ApiError ? err.message : "Failed to create user.";
        }
      }
    });
  }

  // Audit log
  const applyBtn = document.getElementById("audit-apply-btn");
  const prevBtn = document.getElementById("audit-prev-btn");
  const nextBtn = document.getElementById("audit-next-btn");

  await loadAuditLog(1);

  if (applyBtn) applyBtn.addEventListener("click", () => void loadAuditLog(1));
  if (prevBtn) prevBtn.addEventListener("click", () => void loadAuditLog(auditPage - 1));
  if (nextBtn) nextBtn.addEventListener("click", () => void loadAuditLog(auditPage + 1));
}

document.addEventListener("DOMContentLoaded", () => void initAdminPage());
