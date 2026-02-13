import { requireRole } from "./guard.js";
import { wireLogout } from "./logout.js";
import { apiFetch } from "./api.js";

const userNameEl = document.getElementById("userName");
const userLoginIdEl = document.getElementById("userLoginId");

const btnOpenCreate = document.getElementById("btnOpenCreate");

const listingsMsg = document.getElementById("listingsMsg");
const listingsList = document.getElementById("listingsList");
const listingsCount = document.getElementById("listingsCount");

const listingSearch = document.getElementById("listingSearch");
const listingStatus = document.getElementById("listingStatus");

const selectedListingTitle = document.getElementById("selectedListingTitle");
const applicantsMsg = document.getElementById("applicantsMsg");
const applicantsList = document.getElementById("applicantsList");
const appStatusFilter = document.getElementById("appStatusFilter");

// Listing details panel
const detailsTitle = document.getElementById("detailsTitle");
const detailsStatus = document.getElementById("detailsStatus");
const btnSaveStatus = document.getElementById("btnSaveStatus");
const btnDeleteListing = document.getElementById("btnDeleteListing"); // NEW
const detailsMeta = document.getElementById("detailsMeta");
const detailsDesc = document.getElementById("detailsDesc");
const detailsReq = document.getElementById("detailsReq");
const detailsMsg = document.getElementById("detailsMsg");

// Create modal
const createModal = document.getElementById("createModal");
const createClose = document.getElementById("createClose");
const createCancel = document.getElementById("createCancel");
const createSubmit = document.getElementById("createSubmit");
const createMsg = document.getElementById("createMsg");

const fTitle = document.getElementById("fTitle");
const fAllowance = document.getElementById("fAllowance");
const fLocation = document.getElementById("fLocation");
const fRemote = document.getElementById("fRemote");
const fStatus = document.getElementById("fStatus");
const fDescription = document.getElementById("fDescription");
const fRequirements = document.getElementById("fRequirements");

let allListings = [];
let selectedListingId = null;
let applicantsCache = [];

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAllowance(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `$${n}`;
}

function badge(status) {
  const base = "text-xs font-medium px-2 py-1 rounded-full border";
  if (status === "open")
    return `<span class="${base} bg-green-50 border-green-200 text-green-700">Open</span>`;
  if (status === "closed")
    return `<span class="${base} bg-slate-50 border-slate-200 text-slate-700">Closed</span>`;
  if (status === "draft")
    return `<span class="${base} bg-amber-50 border-amber-200 text-amber-800">Draft</span>`;
  return `<span class="${base} bg-slate-50 border-slate-200 text-slate-700">${escapeHtml(
    status || "—",
  )}</span>`;
}

function appBadge(status) {
  const s = String(status || "submitted").toLowerCase();
  const base = "text-xs font-medium px-2 py-1 rounded-full border";
  if (s === "accepted")
    return `<span class="${base} bg-green-50 border-green-200 text-green-700">Accepted</span>`;
  if (s === "rejected")
    return `<span class="${base} bg-red-50 border-red-200 text-red-700">Rejected</span>`;
  if (s === "shortlisted")
    return `<span class="${base} bg-amber-50 border-amber-200 text-amber-800">Shortlisted</span>`;
  if (s === "reviewing")
    return `<span class="${base} bg-blue-50 border-blue-200 text-blue-700">Reviewing</span>`;
  return `<span class="${base} bg-slate-50 border-slate-200 text-slate-700">Submitted</span>`;
}

function currentSelectedListing() {
  return (allListings || []).find((l) => l.id === selectedListingId) || null;
}

// Listing details panel state
function clearDetailsPanel() {
  if (!detailsTitle) return;
  detailsTitle.textContent = "Select a listing to view details";
  detailsMeta.textContent = "";
  detailsDesc.textContent = "";
  detailsReq.textContent = "";
  detailsMsg.textContent = "";
  detailsStatus.value = "open";
  detailsStatus.disabled = true;
  btnSaveStatus.disabled = true;
  if (btnDeleteListing) btnDeleteListing.disabled = true; // NEW
}

function renderDetailsPanel() {
  const l = currentSelectedListing();
  if (!l) return clearDetailsPanel();

  detailsTitle.textContent = l.title || "Listing";
  detailsMeta.textContent = `${l.location || "—"} • ${
    l.allow_remote ? "Remote OK" : "On-site"
  } • Allowance: ${formatAllowance(l.allowance)}`;

  detailsDesc.textContent = l.description || "";
  detailsReq.textContent = l.requirements || "—";

  detailsStatus.value = l.status || "open";
  detailsStatus.disabled = false;
  btnSaveStatus.disabled = false;
  if (btnDeleteListing) btnDeleteListing.disabled = false; // NEW
  detailsMsg.textContent = "";
}

async function saveListingStatus() {
  const l = currentSelectedListing();
  if (!l) return;

  const newStatus = detailsStatus.value;

  btnSaveStatus.disabled = true;
  const oldText = btnSaveStatus.textContent;
  btnSaveStatus.textContent = "Saving...";
  detailsMsg.textContent = "Updating listing status...";

  try {
    const { listing } = await apiFetch(`/company/listings/${l.id}/status`, {
      method: "PATCH",
      body: { status: newStatus },
    });

    allListings = allListings.map((x) => (x.id === listing.id ? listing : x));
    detailsMsg.textContent = "Saved";
    renderListings();
    renderDetailsPanel();
  } catch (e) {
    detailsMsg.textContent = e.message || "Failed to update status";
  } finally {
    btnSaveStatus.disabled = false;
    btnSaveStatus.textContent = oldText;
  }
}

// Delete the currently selected listing
async function deleteSelectedListing() {
  const l = currentSelectedListing();
  if (!l) return;

  const ok = confirm(
    `Delete this listing?\n\n"${l.title || "Listing"}"\n\nThis cannot be undone.`,
  );
  if (!ok) return;

  if (btnDeleteListing) btnDeleteListing.disabled = true;
  const oldText = btnDeleteListing ? btnDeleteListing.textContent : "";
  if (btnDeleteListing) btnDeleteListing.textContent = "Deleting...";
  detailsMsg.textContent = "Deleting listing...";

  try {
    await apiFetch(`/company/listings/${l.id}`, { method: "DELETE" });

    allListings = (allListings || []).filter((x) => x.id !== l.id);

    selectedListingId = allListings.length ? allListings[0].id : null;

    applicantsCache = [];
    applicantsList.innerHTML = "";
    applicantsMsg.textContent = selectedListingId
      ? "Select a listing to view applicants"
      : "No listing selected.";
    selectedListingTitle.textContent = "Select a listing to view applicants";

    detailsMsg.textContent = "Deleted";
    await loadListings();
  } catch (e) {
    detailsMsg.textContent = e.message || "Failed to delete listing";
  } finally {
    if (btnDeleteListing) {
      btnDeleteListing.disabled = false;
      btnDeleteListing.textContent = oldText || "Delete";
    }
  }
}

// Listings left panel rendering
function listingCard(l) {
  const active = l.id === selectedListingId;
  const allowance = formatAllowance(l.allowance);

  return `
    <button
      data-id="${l.id}"
      class="${
        active ? "border-black" : "border-slate-200"
      } w-full text-left bg-white rounded-xl border p-3 hover:shadow-sm transition"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900 truncate">${escapeHtml(
            l.title || "Listing",
          )}</div>
          <div class="text-xs text-slate-500 mt-1 truncate">
            ${escapeHtml(l.location || "—")} • Allowance:
            <span class="font-semibold text-slate-800">${escapeHtml(
              allowance,
            )}</span>
          </div>
        </div>
        <div class="shrink-0">${badge(l.status)}</div>
      </div>

      <div class="text-xs text-slate-500 mt-2 line-clamp-2">
        ${escapeHtml(l.description || "")}
      </div>
    </button>
  `;
}

function renderListings() {
  const q = (listingSearch?.value || "").trim().toLowerCase();
  const status = listingStatus?.value || "all";

  const filtered = (allListings || []).filter((l) => {
    const hay =
      `${l.title || ""} ${l.description || ""} ${l.location || ""}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (status !== "all" && String(l.status || "") !== status) return false;
    return true;
  });

  listingsCount.textContent = `${filtered.length} listing(s)`;

  if (!filtered.length) {
    listingsMsg.textContent = "No listings found.";
    listingsList.innerHTML = "";
    return;
  }

  listingsMsg.textContent = "";
  listingsList.innerHTML = filtered.map(listingCard).join("");

  listingsList.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if (!id) return;

      selectedListingId = id;
      renderListings();
      renderDetailsPanel();
      await loadApplicantsForSelected();
    });
  });
}

async function loadListings() {
  listingsMsg.textContent = "Loading listings...";
  listingsList.innerHTML = "";

  const { listings } = await apiFetch("/company/listings");
  allListings = listings || [];

  if (!allListings.length) {
    listingsMsg.textContent = "No listings yet. Create your first listing.";
    listingsCount.textContent = "0 listing(s)";
    selectedListingId = null;

    selectedListingTitle.textContent = "Select a listing to view applicants";
    applicantsMsg.textContent = "No listing selected.";
    applicantsList.innerHTML = "";

    clearDetailsPanel();
    return;
  }

  if (!selectedListingId) selectedListingId = allListings[0].id;

  renderListings();
  renderDetailsPanel();
  await loadApplicantsForSelected();
}

// Applicants rendering
function normalizeSelectableStatus(rawStatus) {
  const s = String(rawStatus || "")
    .trim()
    .toLowerCase();
  if (!s || s === "submitted") return "reviewing";
  if (["reviewing", "shortlisted", "accepted", "rejected"].includes(s))
    return s;
  return "reviewing";
}

function applicantCard(a) {
  const s = a.student || {};
  const when = a.created_at ? new Date(a.created_at).toLocaleString() : "";
  const resume = a.resume?.public_url || "";

  const badgeStatus = String(a.status || "submitted").toLowerCase();
  const selectStatus = normalizeSelectableStatus(a.status);

  return `
    <div class="bg-white rounded-xl border p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-base font-semibold text-slate-900 truncate">${escapeHtml(
            s.full_name || "Student",
          )}</div>
          <div class="text-xs text-slate-500 mt-1 truncate">
            ${escapeHtml(s.login_id || s.email || "")}
            ${when ? `• Applied: ${escapeHtml(when)}` : ""}
          </div>
        </div>

        <div class="shrink-0">${appBadge(badgeStatus)}</div>
      </div>

      ${
        a.cover_note
          ? `<div class="mt-3 text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(
              a.cover_note,
            )}</div>`
          : `<div class="mt-3 text-sm text-slate-500 italic">No cover letter provided.</div>`
      }

      <div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="text-sm">
          ${
            resume
              ? `<a href="${escapeHtml(
                  resume,
                )}" target="_blank" class="text-blue-600 hover:underline">View Resume</a>`
              : `<span class="text-red-600">Resume missing</span>`
          }
        </div>

        <div class="flex items-center gap-2">
          <select
            data-app-id="${a.id}"
            class="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="reviewing" ${
              selectStatus === "reviewing" ? "selected" : ""
            }>Reviewing</option>
            <option value="shortlisted" ${
              selectStatus === "shortlisted" ? "selected" : ""
            }>Shortlisted</option>
            <option value="accepted" ${
              selectStatus === "accepted" ? "selected" : ""
            }>Accepted</option>
            <option value="rejected" ${
              selectStatus === "rejected" ? "selected" : ""
            }>Rejected</option>
          </select>

          <button
            data-update-id="${a.id}"
            class="px-4 py-2 rounded-lg bg-black text-white hover:opacity-90 text-sm"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderApplicants() {
  if (!selectedListingId) {
    applicantsMsg.textContent = "No listing selected.";
    applicantsList.innerHTML = "";
    return;
  }

  const status = appStatusFilter?.value || "all";
  const filtered = (applicantsCache || []).filter((a) => {
    if (status === "all") return true;
    return String(a.status || "submitted") === status;
  });

  if (!filtered.length) {
    applicantsMsg.textContent = "No applicants for this listing.";
    applicantsList.innerHTML = "";
    return;
  }

  applicantsMsg.textContent = "";
  applicantsList.innerHTML = filtered.map(applicantCard).join("");

  applicantsList.querySelectorAll("button[data-update-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const appId = btn.getAttribute("data-update-id");
      if (!appId) return;

      const sel = applicantsList.querySelector(
        `select[data-app-id="${appId}"]`,
      );

      const newStatus = String(sel?.value || "reviewing")
        .trim()
        .toLowerCase();

      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = "Saving...";

      try {
        await apiFetch(`/company/applications/${appId}/status`, {
          method: "PATCH",
          body: { status: newStatus },
        });

        applicantsCache = applicantsCache.map((a) =>
          a.id === appId ? { ...a, status: newStatus } : a,
        );
        renderApplicants();
      } catch (e) {
        alert(e.message || "Update failed");
        btn.disabled = false;
        btn.textContent = oldText;
      }
    });
  });
}

async function loadApplicantsForSelected() {
  applicantsMsg.textContent = "Loading applicants...";
  applicantsList.innerHTML = "";

  const listing = currentSelectedListing();
  selectedListingTitle.textContent = listing?.title || "Selected listing";

  const { applicants, listing: listingInfo } = await apiFetch(
    `/company/listings/${selectedListingId}/applicants`,
  );

  applicantsCache = applicants || [];
  selectedListingTitle.textContent =
    listingInfo?.title || selectedListingTitle.textContent;

  renderApplicants();
}

// Create modal behavior
function openCreateModal() {
  createMsg.textContent = "";
  fTitle.value = "";
  fAllowance.value = "";
  fLocation.value = "";
  fRemote.checked = false;
  fStatus.value = "open";
  fDescription.value = "";
  fRequirements.value = "";

  createModal.classList.remove("hidden");
}

function closeCreateModal() {
  createModal.classList.add("hidden");
}

function wireCreateModal() {
  btnOpenCreate?.addEventListener("click", openCreateModal);
  createClose?.addEventListener("click", closeCreateModal);
  createCancel?.addEventListener("click", closeCreateModal);

  createSubmit?.addEventListener("click", async () => {
    const title = (fTitle.value || "").trim();
    const description = (fDescription.value || "").trim();

    if (!title || !description) {
      createMsg.textContent = "Title and Description are required.";
      return;
    }

    createSubmit.disabled = true;
    const old = createSubmit.textContent;
    createSubmit.textContent = "Creating...";
    createMsg.textContent = "Creating listing...";

    try {
      await apiFetch("/company/listings", {
        method: "POST",
        body: {
          title,
          description,
          requirements: (fRequirements.value || "").trim(),
          allowance: fAllowance.value ? Number(fAllowance.value) : null,
          location: (fLocation.value || "").trim(),
          allowRemote: !!fRemote.checked,
          status: fStatus.value || "open",
        },
      });

      closeCreateModal();
      selectedListingId = null;
      await loadListings();
    } catch (e) {
      createMsg.textContent = e.message || "Create failed";
    } finally {
      createSubmit.disabled = false;
      createSubmit.textContent = old;
    }
  });
}

// Boot
(async () => {
  const profile = await requireRole(["company"]);
  if (!profile) return;

  wireLogout();
  wireCreateModal();

  userNameEl.textContent = profile.full_name || "Company User";
  userLoginIdEl.textContent = profile.login_id || "";

  listingSearch?.addEventListener("input", renderListings);
  listingStatus?.addEventListener("change", renderListings);
  appStatusFilter?.addEventListener("change", renderApplicants);

  btnSaveStatus?.addEventListener("click", saveListingStatus);
  btnDeleteListing?.addEventListener("click", deleteSelectedListing); // NEW

  await loadListings();
})();
