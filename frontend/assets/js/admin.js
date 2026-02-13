// public/assets/js/admin.js

import { requireRole } from "./guard.js";
import { wireLogout } from "./logout.js";
import { apiFetch } from "./api.js";

const userNameEl = document.getElementById("userName");
const userLoginIdEl = document.getElementById("userLoginId");

const roleEl = document.getElementById("role");
const companyFields = document.getElementById("companyFields");

const fullNameEl = document.getElementById("fullName");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");

const companyNameEl = document.getElementById("companyName");
const industryEl = document.getElementById("industry");
const companyLocationEl = document.getElementById("companyLocation");

const btnCreate = document.getElementById("btnCreate");
const createMsg = document.getElementById("createMsg");

const usersMsg = document.getElementById("usersMsg");
const usersList = document.getElementById("usersList");
const btnRefreshUsers = document.getElementById("btnRefreshUsers");

const companiesMsg = document.getElementById("companiesMsg");
const companiesList = document.getElementById("companiesList");
const btnRefreshCompanies = document.getElementById("btnRefreshCompanies");

// Optional stats UI
const statsUsersEl = document.getElementById("statUsers");
const statsCompaniesEl = document.getElementById("statCompanies");
const statsListingsEl = document.getElementById("statListings");
const statsApplicationsEl = document.getElementById("statApplications");
const statsMsgEl = document.getElementById("statsMsg");

// Optional filters UI
const usersSearchEl = document.getElementById("usersSearch");
const usersRoleFilterEl = document.getElementById("usersRoleFilter");
const usersSortEl = document.getElementById("usersSort");
const usersShowDisabledEl = document.getElementById("usersShowDisabled");

const companiesSearchEl = document.getElementById("companiesSearch");

let allUsers = [];
let allCompanies = [];

// Basic HTML escaping for any user-provided / database strings rendered into the page
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Normalize text for simple client-side searching
function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

// Show/hide company-only fields when creating accounts
function toggleCompanyFields() {
  const role = roleEl?.value;
  companyFields?.classList.toggle("hidden", role !== "company");
}

// Shared Tailwind class helpers for consistent button styling
function primaryBtnClasses() {
  return "px-3 py-1.5 rounded-lg bg-black text-white text-xs hover:opacity-90";
}

function secondaryBtnClasses() {
  return "px-3 py-1.5 rounded-lg border text-xs hover:bg-slate-50";
}

function dangerBtnClasses() {
  return "px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs hover:bg-red-100";
}

// Smooth scroll helper for jumping to sections
function scrollToEl(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Role badge UI
function rolePill(role) {
  const r = String(role || "").toLowerCase();
  const base = "text-xs px-2 py-1 rounded-full border";
  if (r === "admin")
    return `<span class="${base} bg-purple-50 border-purple-200 text-purple-700">admin</span>`;
  if (r === "company")
    return `<span class="${base} bg-blue-50 border-blue-200 text-blue-700">company</span>`;
  return `<span class="${base} bg-slate-50 border-slate-200 text-slate-700">student</span>`;
}

// Account status badge UI
function statusPill(disabled) {
  const base = "text-xs px-2 py-1 rounded-full border";
  if (disabled) {
    return `<span class="${base} bg-red-50 border-red-200 text-red-700">deactivated</span>`;
  }
  return `<span class="${base} bg-green-50 border-green-200 text-green-700">active</span>`;
}

// Render a single user entry card
function userRow(u) {
  const email = u.email || "";
  const name = u.full_name || "";
  const role = u.role || "";
  const disabled = !!u.disabled;

  const actionBtn = disabled
    ? `<button data-action="activate" data-user-id="${escapeHtml(
        u.id,
      )}" class="${primaryBtnClasses()}">Activate</button>`
    : `<button data-action="deactivate" data-user-id="${escapeHtml(
        u.id,
      )}" class="${primaryBtnClasses()}">Deactivate</button>`;

  return `
    <div class="border rounded-xl p-3 bg-white">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900 truncate">${escapeHtml(
            name,
          )}</div>
          <div class="text-xs text-slate-500 truncate">${escapeHtml(email)}</div>

          <div class="mt-1 flex items-center gap-2">
            ${rolePill(role)}
            ${statusPill(disabled)}
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            data-action="edit-user"
            data-user-id="${escapeHtml(u.id)}"
            class="${secondaryBtnClasses()}"
          >
            Edit
          </button>

          <button
            data-action="reset"
            data-user-id="${escapeHtml(u.id)}"
            class="${secondaryBtnClasses()}"
          >
            Reset Password
          </button>

          ${actionBtn}
        </div>
      </div>
    </div>
  `;
}

// Render a single company entry card
function companyRow(c) {
  const id = c.id || "";
  return `
    <div class="border rounded-xl p-3 bg-white">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900 truncate">${escapeHtml(
            c.company_name || "Company",
          )}</div>
          <div class="text-xs text-slate-500 truncate">
            ${escapeHtml(c.industry || "—")} • ${escapeHtml(c.location || "—")}
          </div>
          <div class="text-[11px] text-slate-400 mt-1 truncate">
            Company ID: ${escapeHtml(id)}
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            data-action="edit-company"
            data-company-id="${escapeHtml(id)}"
            class="${secondaryBtnClasses()}"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  `;
}

// Read the current filter/search/sort controls for users
function getUserControls() {
  return {
    q: norm(usersSearchEl?.value || ""),
    role: norm(usersRoleFilterEl?.value || "all"),
    sort: norm(usersSortEl?.value || "newest"),
    showDisabled: String(usersShowDisabledEl?.value || "all"),
  };
}

// Apply local filter + sort to users already loaded from the API
function filterAndSortUsers(list) {
  const { q, role, sort, showDisabled } = getUserControls();

  let filtered = (list || []).filter((u) => {
    if (role !== "all" && norm(u.role) !== role) return false;

    const disabled = !!u.disabled;
    if (showDisabled === "active" && disabled) return false;
    if (showDisabled === "disabled" && !disabled) return false;

    if (q) {
      const hay = `${u.full_name || ""} ${u.email || ""} ${u.login_id || ""} ${
        u.id || ""
      }`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const cmp = {
    newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    name_az: (a, b) => (a.full_name || "").localeCompare(b.full_name || ""),
    name_za: (a, b) => (b.full_name || "").localeCompare(a.full_name || ""),
    email_az: (a, b) => (a.email || "").localeCompare(b.email || ""),
    email_za: (a, b) => (b.email || "").localeCompare(a.email || ""),
  }[sort];

  if (cmp) filtered = filtered.sort(cmp);
  return filtered;
}

// Apply local search to companies already loaded from the API
function filterCompanies(list) {
  const q = norm(companiesSearchEl?.value || "");
  if (!q) return list || [];

  return (list || []).filter((c) => {
    const hay = `${c.company_name || ""} ${c.industry || ""} ${
      c.location || ""
    } ${c.id || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

// Render users list based on current filters
function renderUsers() {
  const visible = filterAndSortUsers(allUsers);

  if (!visible.length) {
    usersList.innerHTML =
      "<div class='text-sm text-slate-600'>No matching users.</div>";
    return;
  }

  usersList.innerHTML = visible.map(userRow).join("");
  wireUserActions();
}

// Render companies list based on current search
function renderCompanies() {
  const visible = filterCompanies(allCompanies);

  if (!visible.length) {
    companiesList.innerHTML =
      "<div class='text-sm text-slate-600'>No matching companies.</div>";
    return;
  }

  companiesList.innerHTML = visible.map(companyRow).join("");
  wireCompanyActions();
}

// Load users from backend and render
async function loadUsers() {
  usersMsg.textContent = "Loading users...";
  usersList.innerHTML = "";

  const { users } = await apiFetch("/admin/users");
  allUsers = users || [];

  usersMsg.textContent = `${allUsers.length} user(s)`;
  renderUsers();
}

// Load companies from backend and render
async function loadCompanies() {
  companiesMsg.textContent = "Loading companies...";
  companiesList.innerHTML = "";

  const { companies } = await apiFetch("/admin/companies");
  allCompanies = companies || [];

  companiesMsg.textContent = `${allCompanies.length} company(s)`;
  renderCompanies();
}

// Load stats (if stats UI is present)
async function loadStats() {
  if (!statsUsersEl && !statsMsgEl) return;

  if (statsMsgEl) statsMsgEl.textContent = "Loading stats...";

  try {
    const { stats } = await apiFetch("/admin/stats");
    if (statsUsersEl) statsUsersEl.textContent = String(stats?.users ?? 0);
    if (statsCompaniesEl)
      statsCompaniesEl.textContent = String(stats?.companies ?? 0);
    if (statsListingsEl)
      statsListingsEl.textContent = String(stats?.listings ?? 0);
    if (statsApplicationsEl)
      statsApplicationsEl.textContent = String(stats?.applications ?? 0);
    if (statsMsgEl) statsMsgEl.textContent = "";
  } catch (e) {
    if (statsMsgEl)
      statsMsgEl.textContent = e.message || "Failed to load stats";
  }
}

// Disable a user account (prevents login)
async function deactivateUser(userId, btn) {
  if (!confirm("Deactivate this user? They will NOT be able to login.")) return;

  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "Working...";

  try {
    await apiFetch(`/admin/users/${userId}/deactivate`, { method: "PATCH" });
    await loadUsers();
    await loadStats();
  } catch (e) {
    alert(e.message || "Deactivate failed");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

// Re-enable a deactivated user account
async function activateUser(userId, btn) {
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "Working...";

  try {
    await apiFetch(`/admin/users/${userId}/activate`, { method: "PATCH" });
    await loadUsers();
    await loadStats();
  } catch (e) {
    alert(e.message || "Activate failed");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

// Admin password reset for a user
async function resetPassword(userId, btn) {
  const newPw = prompt("Enter a NEW password (min 6 chars).");
  if (!newPw) return;

  if (String(newPw).trim().length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "Saving...";

  try {
    await apiFetch(`/admin/users/${userId}/reset-password`, {
      method: "POST",
      body: { password: String(newPw).trim() },
    });
    alert("Password updated. Give the new password to the user.");
  } catch (e) {
    alert(e.message || "Reset password failed");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

// Create the Edit User modal once and reuse it
function ensureUserEditModal() {
  let modal = document.getElementById("adminUserEditModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "adminUserEditModal";
  modal.className =
    "fixed inset-0 bg-black/40 hidden items-center justify-center p-4 z-50";

  modal.innerHTML = `
    <div class="bg-white w-full max-w-xl rounded-2xl border shadow-sm overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <div class="min-w-0">
          <div class="text-base font-semibold text-slate-900">Edit User</div>
          <div id="userEditSub" class="text-xs text-slate-500 mt-0.5 truncate"></div>
        </div>
        <button id="userEditClose" class="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-50">Close</button>
      </div>

      <div class="p-5 space-y-4">
        <div>
          <label class="text-xs text-slate-600">Full Name</label>
          <input id="userEditName" class="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white" placeholder="Full name" />
        </div>

        <div>
          <label class="text-xs text-slate-600">Email</label>
          <input id="userEditEmail" class="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white" placeholder="Email" />
          <div class="mt-1 text-[11px] text-slate-500">
            Note: changing email depends on backend support (profiles + auth email rules).
          </div>
        </div>

        <div id="userEditMsg" class="text-sm text-slate-600"></div>

        <div class="flex items-center justify-end gap-2 pt-1">
          <button id="userEditCancel" class="${secondaryBtnClasses()}">Cancel</button>
          <button id="userEditSave" class="${primaryBtnClasses()}">Save</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  };

  modal.querySelector("#userEditClose")?.addEventListener("click", close);
  modal.querySelector("#userEditCancel")?.addEventListener("click", close);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  return modal;
}

// Open the Edit User modal and bind its save handler
async function openEditUserModal(userId) {
  const u = (allUsers || []).find((x) => x.id === userId);
  if (!u) return alert("User not found");

  const modal = ensureUserEditModal();
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  const subEl = modal.querySelector("#userEditSub");
  const nameEl = modal.querySelector("#userEditName");
  const emailEl2 = modal.querySelector("#userEditEmail");
  const msgEl = modal.querySelector("#userEditMsg");
  const saveBtn = modal.querySelector("#userEditSave");

  subEl.textContent = `${u.full_name || "—"} • ${u.email || "—"}`;
  nameEl.value = u.full_name || "";
  emailEl2.value = u.email || "";
  msgEl.textContent = "";

  saveBtn.disabled = false;
  saveBtn.textContent = "Save";

  saveBtn.onclick = async () => {
    const fullName = String(nameEl.value || "").trim();
    const email = String(emailEl2.value || "")
      .trim()
      .toLowerCase();

    if (!fullName) {
      msgEl.textContent = "Full Name is required.";
      return;
    }
    if (!email) {
      msgEl.textContent = "Email is required.";
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    msgEl.textContent = "Updating...";

    try {
      await apiFetch(`/admin/users/${userId}`, {
        method: "PATCH",
        body: { fullName, email },
      });

      msgEl.textContent = "Updated";
      await loadUsers();
      await loadStats();

      setTimeout(() => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
      }, 400);
    } catch (e) {
      msgEl.textContent = e.message || "Update failed";
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  };
}

// Wire button actions within the user list
function wireUserActions() {
  usersList?.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.getAttribute("data-action");
      const userId = btn.getAttribute("data-user-id");
      if (!action || !userId) return;

      if (action === "deactivate") return deactivateUser(userId, btn);
      if (action === "activate") return activateUser(userId, btn);
      if (action === "reset") return resetPassword(userId, btn);
      if (action === "edit-user") return openEditUserModal(userId);
    });
  });
}

// Edit company fields using simple prompts
async function editCompany(companyId) {
  const company = (allCompanies || []).find((c) => c.id === companyId);
  if (!company) return alert("Company not found");

  const newName = prompt("Company Name:", company.company_name || "");
  if (newName == null) return;

  const newIndustry = prompt(
    "Industry (blank = clear):",
    company.industry || "",
  );
  if (newIndustry == null) return;

  const newLocation = prompt(
    "Location (blank = clear):",
    company.location || "",
  );
  if (newLocation == null) return;

  try {
    await apiFetch(`/admin/companies/${companyId}`, {
      method: "PATCH",
      body: {
        companyName: String(newName || "").trim(),
        industry: String(newIndustry || "").trim(),
        location: String(newLocation || "").trim(),
      },
    });
    await loadCompanies();
  } catch (e) {
    alert(e.message || "Update company failed");
  }
}

// Wire button actions within the company list
function wireCompanyActions() {
  companiesList?.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.getAttribute("data-action");
      const companyId = btn.getAttribute("data-company-id");
      if (!action || !companyId) return;

      if (action === "edit-company") return editCompany(companyId);
    });
  });
}

// Create a new account from the form fields
async function createAccount() {
  const role = String(roleEl?.value || "").trim();
  const email = String(emailEl?.value || "")
    .trim()
    .toLowerCase();

  const payload = {
    role,
    fullName: (fullNameEl?.value || "").trim(),
    email,
    password: (passwordEl?.value || "").trim(),
  };

  if (!payload.fullName)
    return (createMsg.textContent = "Full Name is required.");
  if (!payload.email) return (createMsg.textContent = "Email is required.");
  if (!payload.password)
    return (createMsg.textContent = "Password is required.");

  if (role === "company") {
    payload.companyName = (companyNameEl?.value || "").trim();
    payload.industry = (industryEl?.value || "").trim();
    payload.location = (companyLocationEl?.value || "").trim();

    if (!payload.companyName) {
      createMsg.textContent = "Company Name is required for company accounts.";
      return;
    }
  }

  createMsg.textContent = "Creating...";
  btnCreate.disabled = true;

  try {
    await apiFetch("/admin/users", { method: "POST", body: payload });
    createMsg.textContent = "Created";

    passwordEl.value = "";
    if (role === "company") {
      companyNameEl.value = "";
      industryEl.value = "";
      companyLocationEl.value = "";
    }

    await loadUsers();
    await loadCompanies();
    await loadStats();
  } catch (e) {
    createMsg.textContent = e.message || "Create failed";
  } finally {
    btnCreate.disabled = false;
  }
}

// Create the shared Listings/Applications modal once and reuse it
function ensureModal() {
  let modal = document.getElementById("adminModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "adminModal";
  modal.className =
    "fixed inset-0 bg-black/40 hidden items-center justify-center p-4 z-50";

  modal.innerHTML = `
    <div class="bg-white w-full max-w-6xl rounded-2xl border shadow-sm overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <div class="min-w-0">
          <div id="adminModalTitle" class="text-base font-semibold text-slate-900">Details</div>
          <div id="adminModalSub" class="text-xs text-slate-500 mt-0.5 truncate"></div>
        </div>
        <button id="adminModalClose" class="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-50">Close</button>
      </div>

      <div class="p-5">
        <div class="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div class="flex-1">
            <input
              id="adminModalSearch"
              class="w-full border rounded-xl px-3 py-2 text-sm bg-white"
              placeholder="Search..."
            />
          </div>
          <div class="w-full lg:w-60">
            <select
              id="adminModalFilter"
              class="w-full border rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="all">All</option>
            </select>
          </div>
        </div>

        <div id="adminModalMsg" class="mt-3 text-sm text-slate-600"></div>

        <div id="adminModalList" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-auto pr-1"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("#adminModalClose")?.addEventListener("click", () => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
  });

  return modal;
}

// Open the shared modal and reset its state
function openModal(title, sub) {
  const modal = ensureModal();
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  modal.querySelector("#adminModalTitle").textContent = title || "Details";
  modal.querySelector("#adminModalSub").textContent = sub || "";

  modal.querySelector("#adminModalMsg").textContent = "Loading...";
  modal.querySelector("#adminModalList").innerHTML = "";
  modal.querySelector("#adminModalSearch").value = "";

  return modal;
}

// Populate dropdown filter options for the shared modal
function setModalFilterOptions(selectEl, options) {
  selectEl.innerHTML = options
    .map(
      (o) =>
        `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`,
    )
    .join("");
}

// Small status badge helper used in modal cards
function badge(text, type = "default") {
  const base =
    "text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap leading-none";
  if (type === "open")
    return `<span class="${base} bg-green-50 border-green-200 text-green-700">${escapeHtml(
      text,
    )}</span>`;
  if (type === "closed")
    return `<span class="${base} bg-slate-50 border-slate-200 text-slate-700">${escapeHtml(
      text,
    )}</span>`;
  if (type === "draft")
    return `<span class="${base} bg-amber-50 border-amber-200 text-amber-700">${escapeHtml(
      text,
    )}</span>`;
  if (type === "danger")
    return `<span class="${base} bg-red-50 border-red-200 text-red-700">${escapeHtml(
      text,
    )}</span>`;
  if (type === "info")
    return `<span class="${base} bg-blue-50 border-blue-200 text-blue-700">${escapeHtml(
      text,
    )}</span>`;
  return `<span class="${base} bg-slate-50 border-slate-200 text-slate-700">${escapeHtml(
    text,
  )}</span>`;
}

// Just to keep dropdown values consistent
function normalizeListingStatus(v) {
  const s = norm(v);
  if (s === "close") return "closed";
  if (["open", "closed", "draft"].includes(s)) return s;
  return null;
}

// Render one listing card in the modal
// ✅ Updated: adds status dropdown + save button (so admin can actually close a listing)
function listingCard(l) {
  const c = l.companies || {};
  const status = String(l.status || "").toLowerCase();
  const statusType =
    status === "open" ? "open" : status === "draft" ? "draft" : "closed";

  const allowance =
    l.allowance === null || l.allowance === undefined || l.allowance === ""
      ? "—"
      : `$${l.allowance}`;

  const remote = l.allow_remote ? "Remote" : "Onsite";
  const companyName = c.company_name || "Company";

  const logoUrl = c.logo_url;
  const logo = logoUrl
    ? `<img
         src="${escapeHtml(logoUrl)}"
         alt="${escapeHtml(companyName)} logo"
         class="w-11 h-11 rounded-xl object-contain bg-slate-50 p-2 border shrink-0"
       />`
    : `<div class="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold shrink-0">
         ${(companyName[0] || "C").toUpperCase()}
       </div>`;

  const statusSelectId = `listing-status-${l.id}`;
  const statusMsgId = `listing-msg-${l.id}`;

  return `
    <div class="border rounded-2xl p-4 bg-white" data-listing-card="${escapeHtml(
      l.id,
    )}">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3 min-w-0">
          ${logo}

          <div class="min-w-0">
            <div class="text-sm font-semibold text-slate-900 truncate">
              ${escapeHtml(l.title || "Listing")}
            </div>

            <div class="text-xs text-slate-500 truncate">
              ${escapeHtml(companyName)}
              ${companyName ? " • " : ""}
              ${escapeHtml(l.location || "—")}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          ${badge(status || "—", statusType)}
        </div>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div class="border rounded-xl px-3 py-2">
          <div class="text-[11px] text-slate-400">Allowance</div>
          <div class="font-medium text-slate-800">${escapeHtml(allowance)}</div>
        </div>
        <div class="border rounded-xl px-3 py-2">
          <div class="text-[11px] text-slate-400">Mode</div>
          <div class="font-medium text-slate-800">${escapeHtml(remote)}</div>
        </div>
      </div>

      ${
        l.description
          ? `<div class="mt-3 text-xs text-slate-600 line-clamp-3">
              ${escapeHtml(l.description)}
            </div>`
          : ""
      }

      <div class="mt-3 text-[11px] text-slate-400 truncate">
        ID: ${escapeHtml(l.id || "")}
      </div>

      <!-- ✅ Admin controls -->
      <div class="mt-3 flex items-center gap-2">
        <select
          id="${escapeHtml(statusSelectId)}"
          class="border rounded-lg px-3 py-2 text-xs bg-white"
        >
          <option value="open" ${status === "open" ? "selected" : ""}>Open</option>
          <option value="closed" ${status === "closed" ? "selected" : ""}>Closed</option>
          <option value="draft" ${status === "draft" ? "selected" : ""}>Draft</option>
        </select>

        <button
          data-action="save-listing-status"
          data-listing-id="${escapeHtml(l.id)}"
          class="${primaryBtnClasses()}"
        >
          Save
        </button>

        <div id="${escapeHtml(
          statusMsgId,
        )}" class="text-xs text-slate-500"></div>
      </div>
    </div>
  `;
}

// Render one application card in the modal
function applicationCard(a) {
  const s = a.profiles || {};
  const l = a.internship_listings || {};
  const c = l.companies || {};

  const when = a.created_at ? new Date(a.created_at).toLocaleString() : "";
  const status = String(a.status || "").toLowerCase();
  const statusType =
    status === "accepted" ? "open" : status === "rejected" ? "danger" : "info";

  const companyName = c.company_name || "Company";
  const title = l.title || "Listing";

  const logoUrl = c.logo_url;
  const logo = logoUrl
    ? `<img
         src="${escapeHtml(logoUrl)}"
         alt="${escapeHtml(companyName)} logo"
         class="w-11 h-11 rounded-xl object-contain bg-slate-50 p-2 border shrink-0"
       />`
    : `<div class="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold shrink-0">
         ${(companyName[0] || "C").toUpperCase()}
       </div>`;

  return `
    <div class="border rounded-2xl p-4 bg-white">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3 min-w-0">
          ${logo}

          <div class="min-w-0">
            <div class="text-sm font-semibold text-slate-900 truncate">
              ${escapeHtml(s.full_name || "Student")}
            </div>
            <div class="text-xs text-slate-500 truncate">
              ${escapeHtml(s.email || "")}
              ${when ? ` • ${escapeHtml(when)}` : ""}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          ${badge(status || "—", statusType)}
        </div>
      </div>

      <div class="mt-3 border rounded-xl px-3 py-2">
        <div class="text-[11px] text-slate-400">Listing</div>
        <div class="text-xs font-medium text-slate-800 truncate">
          ${escapeHtml(title)}
        </div>
        <div class="text-[11px] text-slate-500 truncate">
          ${escapeHtml(companyName)}
        </div>
      </div>

      <div class="mt-3 text-[11px] text-slate-400 truncate">
        Application ID: ${escapeHtml(a.id || "")}
      </div>
    </div>
  `;
}

// Save listing status (calls backend PATCH /admin/listings/:id/status)
async function saveListingStatus(listingId, newStatus, btn) {
  const status = normalizeListingStatus(newStatus);
  if (!status) return alert("Invalid status");

  const msgEl = document.getElementById(`listing-msg-${listingId}`);
  if (msgEl) msgEl.textContent = "Saving...";

  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "Saving...";

  try {
    await apiFetch(`/admin/listings/${listingId}/status`, {
      method: "PATCH",
      body: { status },
    });

    if (msgEl) msgEl.textContent = "Saved";
  } catch (e) {
    if (msgEl) msgEl.textContent = e.message || "Save failed";
    alert(e.message || "Save failed");
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

// Wire listing modal actions (save status)
function wireListingModalActions(modal) {
  modal
    ?.querySelectorAll("button[data-action='save-listing-status']")
    .forEach((btn) => {
      btn.addEventListener("click", async () => {
        const listingId = btn.getAttribute("data-listing-id");
        if (!listingId) return;

        const selectEl = modal.querySelector(`#listing-status-${listingId}`);
        const newStatus = selectEl?.value || "";

        await saveListingStatus(listingId, newStatus, btn);

        // Refresh the modal list so badge updates too
        // (Instead of doing complicated DOM edits)
        const reloadBtn = modal.querySelector("#adminModalSearch");
        if (reloadBtn) reloadBtn.dispatchEvent(new Event("input"));
      });
    });
}

// Open the Listings modal and wire its search/filter controls
async function openListingsModal() {
  const modal = openModal("Listings", "All internship listings");
  const searchEl = modal.querySelector("#adminModalSearch");
  const filterEl = modal.querySelector("#adminModalFilter");
  const msgEl = modal.querySelector("#adminModalMsg");
  const listEl = modal.querySelector("#adminModalList");

  setModalFilterOptions(filterEl, [
    { value: "all", label: "All statuses" },
    { value: "open", label: "Open" },
    { value: "closed", label: "Closed" },
    { value: "draft", label: "Draft" },
  ]);

  let cache = [];

  async function load() {
    msgEl.textContent = "Loading...";
    listEl.innerHTML = "";

    const q = norm(searchEl.value);
    const status = norm(filterEl.value || "all");
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (status && status !== "all") qs.set("status", status);

    const { listings } = await apiFetch(`/admin/listings?${qs.toString()}`);
    cache = listings || [];

    msgEl.textContent = `${cache.length} listing(s)`;
    listEl.innerHTML = cache.map(listingCard).join("") || "";

    // ✅ important: wire up the new Save buttons after rendering
    wireListingModalActions(modal);
  }

  searchEl.oninput = () => load();
  filterEl.onchange = () => load();

  await load();
}

// Open the Applications modal and wire its search/filter controls
async function openApplicationsModal() {
  const modal = openModal("Applications", "All student applications");
  const searchEl = modal.querySelector("#adminModalSearch");
  const filterEl = modal.querySelector("#adminModalFilter");
  const msgEl = modal.querySelector("#adminModalMsg");
  const listEl = modal.querySelector("#adminModalList");

  setModalFilterOptions(filterEl, [
    { value: "all", label: "All statuses" },
    { value: "submitted", label: "Submitted" },
    { value: "reviewing", label: "Reviewing" },
    { value: "shortlisted", label: "Shortlisted" },
    { value: "accepted", label: "Accepted" },
    { value: "rejected", label: "Rejected" },
  ]);

  let cache = [];

  async function load() {
    msgEl.textContent = "Loading...";
    listEl.innerHTML = "";

    const q = norm(searchEl.value);
    const status = norm(filterEl.value || "all");
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (status && status !== "all") qs.set("status", status);

    const { applications } = await apiFetch(
      `/admin/applications?${qs.toString()}`,
    );
    cache = applications || [];

    msgEl.textContent = `${cache.length} application(s)`;
    listEl.innerHTML = cache.map(applicationCard).join("") || "";
  }

  searchEl.oninput = () => load();
  filterEl.onchange = () => load();

  await load();
}

// Wire click handlers on stat cards
function wireStatsClicks() {
  if (statsUsersEl) {
    statsUsersEl.style.cursor = "pointer";
    statsUsersEl.title = "Click to jump to users";
    statsUsersEl.addEventListener("click", () => {
      scrollToEl(usersList?.closest(".bg-white") || usersList);
    });
  }

  if (statsCompaniesEl) {
    statsCompaniesEl.style.cursor = "pointer";
    statsCompaniesEl.title = "Click to jump to companies";
    statsCompaniesEl.addEventListener("click", () => {
      scrollToEl(companiesList?.closest(".bg-white") || companiesList);
    });
  }

  if (statsListingsEl) {
    statsListingsEl.style.cursor = "pointer";
    statsListingsEl.title = "Click to view listings";
    statsListingsEl.addEventListener("click", openListingsModal);
  }

  if (statsApplicationsEl) {
    statsApplicationsEl.style.cursor = "pointer";
    statsApplicationsEl.title = "Click to view applications";
    statsApplicationsEl.addEventListener("click", openApplicationsModal);
  }
}

// Wire list filter inputs for live updates
function wireFilters() {
  usersSearchEl?.addEventListener("input", renderUsers);
  usersRoleFilterEl?.addEventListener("change", renderUsers);
  usersSortEl?.addEventListener("change", renderUsers);
  usersShowDisabledEl?.addEventListener("change", renderUsers);

  companiesSearchEl?.addEventListener("input", renderCompanies);
}

// Boot sequence
(async () => {
  const profile = await requireRole(["admin"]);
  if (!profile) return;

  wireLogout();
  if (userNameEl) userNameEl.textContent = profile.full_name || "Admin";
  if (userLoginIdEl) userLoginIdEl.textContent = profile.login_id || "";

  toggleCompanyFields();
  roleEl?.addEventListener("change", toggleCompanyFields);

  btnCreate?.addEventListener("click", createAccount);

  btnRefreshUsers?.addEventListener("click", async () => {
    await loadUsers();
    await loadStats();
  });

  btnRefreshCompanies?.addEventListener("click", loadCompanies);

  wireFilters();
  wireStatsClicks();

  await loadStats();
  await loadUsers();
  await loadCompanies();
})();
