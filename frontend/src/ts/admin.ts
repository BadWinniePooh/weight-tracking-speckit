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
import { initNavbar } from "./navbar";
import { initTheme } from "./theme";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("sv-SE").slice(0, 16);
}

function renderStatusBadge(user: AdminUserDto): string {
  if (!user.isActive) {
    return '<span data-status="inactive" class="badge badge-error">Deactivated</span>';
  }
  if (!user.emailConfirmed) {
    return '<span data-status="pending" class="badge badge-warning">Pending</span>';
  }
  return '<span data-status="active" class="badge badge-success">Active</span>';
}

function refreshStats(users: AdminUserDto[]): void {
  const totalEl = document.getElementById("stat-total-users");
  const sessionsEl = document.getElementById("stat-active-sessions");
  if (totalEl) totalEl.textContent = String(users.length);
  if (sessionsEl) sessionsEl.textContent = String(users.filter((u) => u.hasActiveSession).length);
}

function showConfirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal") as HTMLDialogElement | null;
    const yesBtn = document.getElementById("confirm-modal-yes");
    const cancelBtn = document.getElementById("confirm-modal-cancel");

    if (!modal || !yesBtn || !cancelBtn) {
      resolve(window.confirm(message));
      return;
    }

    const onYes = () => { cleanup(); modal.close(); resolve(true); };
    const onCancel = () => { cleanup(); modal.close(); resolve(false); };
    const cleanup = () => {
      yesBtn.removeEventListener("click", onYes);
      cancelBtn.removeEventListener("click", onCancel);
    };

    yesBtn.addEventListener("click", onYes);
    cancelBtn.addEventListener("click", onCancel);
    modal.showModal();
  });
}

function renderUserRow(user: AdminUserDto, currentUserId: string | null): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.dataset.userId = user.id;
  tr.dataset.emailConfirmed = String(user.emailConfirmed);

  const isOwnAccount = user.id === currentUserId;
  const deletionCell = user.scheduledDeletionAt
    ? `<td>${formatDate(user.scheduledDeletionAt)}</td>`
    : "<td>—</td>";

  const deactivateBtn = user.isActive
    ? `<button class="btn btn-sm btn-ghost" data-action="deactivate" data-user-id="${user.id}"${isOwnAccount ? " disabled title=\"Cannot deactivate own account\"" : ""}>Deactivate</button>`
    : "";
  const reactivateBtn = !user.isActive
    ? `<button class="btn btn-sm btn-ghost" data-action="reactivate" data-user-id="${user.id}">Reactivate</button>`
    : "";
  const deleteBtn = `<button class="btn btn-sm btn-ghost text-error" data-action="delete" data-user-id="${user.id}"${isOwnAccount ? " disabled title=\"Cannot delete own account\"" : ""}>Delete</button>`;
  const changeRoleBtn = `<button class="btn btn-sm btn-ghost" data-action="change-role" data-user-id="${user.id}" data-current-role="${user.role}"${isOwnAccount ? " disabled title=\"Cannot change own role\"" : ""}>Change Role</button>`;
  const resendBtn = !user.emailConfirmed
    ? `<button class="btn btn-sm btn-ghost" data-action="resend-confirmation" data-user-id="${user.id}">Resend Confirmation</button>`
    : "";

  tr.innerHTML = `
    <td>${user.username}</td>
    <td>${user.email}</td>
    <td>${user.role}</td>
    <td>${renderStatusBadge(user)}</td>
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

function parseRowData(row: HTMLTableRowElement): AdminUserDto {
  const statusBadge = row.cells[3]?.querySelector("[data-status]") as HTMLElement | null;
  const status = statusBadge?.dataset.status;
  return {
    id: row.dataset.userId ?? "",
    username: row.cells[0]?.textContent?.trim() ?? "",
    email: row.cells[1]?.textContent?.trim() ?? "",
    role: row.cells[2]?.textContent?.trim() ?? "user",
    isActive: status === "active" || status === "pending",
    emailConfirmed: row.dataset.emailConfirmed === "true",
    createdAt: "",
    lastLoginAt: null,
    scheduledDeletionAt: null,
    hasActiveSession: false,
  };
}

function wireRowActions(tbody: HTMLElement): void {
  tbody.addEventListener("click", async (e) => {
    const btn = (e.target as Element).closest("[data-action]") as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;

    const action = btn.dataset.action;
    const userId = btn.dataset.userId;
    if (!userId) return;

    function setLoading(el: HTMLButtonElement, on: boolean): void {
      el.disabled = on;
      el.dataset.loading = on ? "true" : "false";
      if (on) el.classList.add("loading"); else el.classList.remove("loading");
    }

    if (action === "deactivate") {
      if (!await showConfirmDialog("Deactivate this user?")) return;
      setLoading(btn, true);
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
        const { users: fresh } = await adminListUsers();
        refreshStats(fresh);
      } catch { setLoading(btn, false); }
    }

    if (action === "reactivate") {
      setLoading(btn, true);
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
        const { users: fresh } = await adminListUsers();
        refreshStats(fresh);
      } catch { setLoading(btn, false); }
    }

    if (action === "delete") {
      if (!await showConfirmDialog("Permanently delete this user?")) return;
      setLoading(btn, true);
      try {
        await adminDeleteUser(userId);
        const row = tbody.querySelector(`[data-user-id="${userId}"]`);
        if (row) row.remove();
        const { users: fresh } = await adminListUsers();
        refreshStats(fresh);
      } catch { setLoading(btn, false); }
    }

    if (action === "change-role") {
      const currentRole = btn.dataset.currentRole ?? "user";
      const newRole = currentRole === "admin" ? "user" : "admin";
      setLoading(btn, true);
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
        const { users: fresh } = await adminListUsers();
        refreshStats(fresh);
      } catch { setLoading(btn, false); }
    }

    if (action === "resend-confirmation") {
      setLoading(btn, true);
      try {
        await adminResendConfirmation(userId);
      } finally { setLoading(btn, false); }
    }
  });
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
        <td>${formatDateTime(entry.timestamp)}</td>
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
  initTheme();
  await loadConfig();
  const state = await checkAuthStatus();
  enforceRedirect("admin", state);
  initNavbar("admin");

  const currentUserId = getUserId();

  // Load users and populate stats + table
  const { users } = await adminListUsers();
  refreshStats(users);

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

  // Cancel button for create modal
  const cancelBtn = document.getElementById("cu-cancel-btn");
  if (cancelBtn && modal) {
    cancelBtn.addEventListener("click", () => modal.close());
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
        const { users: fresh } = await adminListUsers();
        refreshStats(fresh);
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
