import { requireRole } from "./guard.js";
import { wireLogout } from "./logout.js";
import { apiFetch } from "./api.js";
import { API_BASE_URL } from "./config.js";

const userNameEl = document.getElementById("userName");
const userLoginIdEl = document.getElementById("userLoginId");

const tabBrowse = document.getElementById("tabBrowse");
const tabApps = document.getElementById("tabApps");
const panelBrowse = document.getElementById("panelBrowse");
const panelApps = document.getElementById("panelApps");

const listingsGrid = document.getElementById("listingsGrid");
const browseMsg = document.getElementById("browseMsg");

const appsList = document.getElementById("appsList");
const appsMsg = document.getElementById("appsMsg");

const searchInput = document.getElementById("searchInput");
const filterIndustry = document.getElementById("filterIndustry");
const filterRemote = document.getElementById("filterRemote");

// Apply modal elements
const applyModal = document.getElementById("applyModal");
const applyClose = document.getElementById("applyClose");
const applyCancel = document.getElementById("applyCancel");
const applySubmit = document.getElementById("applySubmit");
const applyResumeFile = document.getElementById("applyResumeFile");
const applyCoverNote = document.getElementById("applyCoverNote");
const applyStatus = document.getElementById("applyStatus");
const modalJobTitle = document.getElementById("modalJobTitle");
const resumeHint = document.getElementById("resumeHint");

let appliedListingIds = new Set();
let allListings = [];

// Apply modal state
let pendingListingId = null;
let pendingListingLabel = "";

function setActiveTab(which) {
  const browseActive = which === "browse";

  tabBrowse.className = browseActive
    ? "px-4 py-2 rounded-lg bg-black text-white text-sm"
    : "px-4 py-2 rounded-lg bg-white border text-sm";

  tabApps.className = !browseActive
    ? "px-4 py-2 rounded-lg bg-black text-white text-sm"
    : "px-4 py-2 rounded-lg bg-white border text-sm";

  panelBrowse.classList.toggle("hidden", !browseActive);
  panelApps.classList.toggle("hidden", browseActive);
}

function statusBadge(status) {
  const base = "text-xs font-medium px-2 py-1 rounded-full border";
  if (status === "accepted")
    return `<span class="${base} bg-green-50 border-green-200 text-green-700">Accepted</span>`;
  if (status === "rejected")
    return `<span class="${base} bg-red-50 border-red-200 text-red-700">Rejected</span>`;
  if (status === "shortlisted")
    return `<span class="${base} bg-amber-50 border-amber-200 text-amber-800">Shortlisted</span>`;
  if (status === "reviewing")
    return `<span class="${base} bg-blue-50 border-blue-200 text-blue-700">Reviewing</span>`;
  return `<span class="${base} bg-slate-50 border-slate-200 text-slate-700">Submitted</span>`;
}

function listingStatusBadge(statusRaw) {
  const status = String(statusRaw || "").toLowerCase();
  const base = "text-[11px] px-2 py-0.5 rounded-full border";

  if (status === "open") {
    return `<span class="${base} bg-green-50 border-green-200 text-green-700">Open</span>`;
  }

  if (status === "closed") {
    return `<span class="${base} bg-slate-100 border-slate-200 text-slate-700">Closed</span>`;
  }

  // draft is not supposed to be shown to students at all
  return "";
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getIndustry(listing) {
  const c = listing.companies || {};
  return String(c.industry || "").trim();
}

function populateIndustryOptions() {
  if (!filterIndustry) return;

  const industries = Array.from(
    new Set((allListings || []).map(getIndustry).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const current = filterIndustry.value || "all";

  filterIndustry.innerHTML =
    `<option value="all">All industries</option>` +
    industries
      .map((i) => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`)
      .join("");

  if (industries.includes(current)) filterIndustry.value = current;
}

function compactLines(text = "") {
  return String(text)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .join("\n");
}

// ✅ UPDATED: Requirements alignment + comma-to-bullets
function renderRequirements(requirementsRaw) {
  const cleaned = compactLines(requirementsRaw);
  if (!cleaned) return "";

  const hasNewlines = cleaned.includes("\n");
  const hasCommas = cleaned.includes(",");

  const lines = cleaned.split("\n");
  const looksLikeBullets = lines.some((l) => /^[-•*]/.test(l));

  // Case 1: comma-separated single line => make bullets
  if (!hasNewlines && hasCommas && !looksLikeBullets) {
    const items = cleaned
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 6);

    if (!items.length) return "";

    return `
      <div class="mt-3 text-left break-words">
        <div class="text-xs font-semibold text-slate-900">Requirements</div>
        <ul class="mt-2 text-sm text-slate-700 list-disc pl-5 space-y-1 text-left">
          ${items.map((it) => `<li>${escapeHtml(it)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  // Case 2: bullet-ish input => keep bullets
  if (looksLikeBullets) {
    const items = lines
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 6);

    if (!items.length) return "";

    return `
      <div class="mt-3 text-left break-words">
        <div class="text-xs font-semibold text-slate-900">Requirements</div>
        <ul class="mt-2 text-sm text-slate-700 list-disc pl-5 space-y-1 text-left">
          ${items.map((it) => `<li>${escapeHtml(it)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  // Case 3: plain text => force left + wrap
  return `
    <div class="mt-3 text-left break-words">
      <div class="text-xs font-semibold text-slate-900">Requirements</div>
      <div class="mt-2 text-sm text-slate-700 line-clamp-2 whitespace-pre-wrap text-left break-words">
        ${escapeHtml(cleaned)}
      </div>
    </div>
  `;
}

function listingCard(listing) {
  const c = listing.companies || {};
  const companyName = c.company_name || "Company";
  const title = listing.title || "Internship";
  const location = listing.location || c.location || "—";
  const allowance =
    listing.allowance != null && listing.allowance !== ""
      ? `$${listing.allowance}`
      : "—";
  const remote = listing.allow_remote ? "Remote OK" : "On-site";
  const industry = getIndustry(listing);

  const status = String(listing.status || "open").toLowerCase();
  const isClosed = status === "closed";

  const alreadyApplied = appliedListingIds.has(listing.id);

  // Button rules:
  // - Applied: disabled + "Applied"
  // - Closed: disabled + "Closed"
  // - Open: normal Apply
  const btnDisabled = alreadyApplied || isClosed;

  const btnLabel = alreadyApplied ? "Applied" : isClosed ? "Closed" : "Apply";

  const btnClass = alreadyApplied
    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
    : isClosed
      ? "bg-slate-200 text-slate-600 cursor-not-allowed"
      : "bg-black text-white hover:opacity-90";

  const logoUrl = c.logo_url;
  const logo = logoUrl
    ? `<img
       src="${escapeHtml(logoUrl)}"
       alt="${escapeHtml(companyName)} logo"
       class="w-12 h-12 rounded-xl object-contain bg-slate-50 p-2 border"
     />`
    : `<div class="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold">
       ${(companyName[0] || "C").toUpperCase()}
     </div>`;

  return `
    <div class="bg-white rounded-2xl border p-5 hover:shadow-sm transition">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-4 flex-1 min-w-0">
          ${logo}

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="text-sm text-slate-600 truncate">
                ${escapeHtml(companyName)}
              </span>

              ${
                industry
                  ? `<span class="text-[11px] px-2 py-0.5 rounded-full border bg-white text-slate-600">
                    ${escapeHtml(industry)}
                   </span>`
                  : ""
              }

              <span class="text-[11px] px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600">
                ${remote}
              </span>

              ${listingStatusBadge(status)}
            </div>

            <div class="text-lg font-semibold text-slate-900 truncate">
              ${escapeHtml(title)}
            </div>

            <div class="text-xs text-slate-500 mt-1">
              ${escapeHtml(location)} • Allowance:
              <span class="font-semibold text-slate-800">
                ${escapeHtml(allowance)}
              </span>
            </div>

            ${
              listing.description
                ? `<div class="mt-3 text-sm text-slate-700">
                    ${escapeHtml(listing.description)}
                   </div>`
                : ""
            }

            ${listing.requirements ? renderRequirements(listing.requirements) : ""}
          </div>
        </div>

        <button
          data-listing-id="${listing.id}"
          data-label="${escapeHtml(title)} • ${escapeHtml(companyName)}"
          class="${btnClass} px-4 py-2 rounded-lg text-sm shrink-0"
          ${btnDisabled ? "disabled" : ""}
          ${isClosed ? 'title="This listing is closed."' : ""}
        >
          ${btnLabel}
        </button>
      </div>
    </div>
  `;
}

async function getResumeUrlForApplication(applicationId) {
  const data = await apiFetch(
    `/student/applications/${applicationId}/documents`,
  );
  const docs = data?.documents || [];
  const resume = docs.find((d) => d.doc_type === "resume");
  return resume?.public_url || "";
}

function applicationRow(app) {
  const l = app.internship_listings || {};
  const c = l.companies || {};
  const companyName = c.company_name || "Company";
  const title = l.title || "Listing";
  const when = app.created_at ? new Date(app.created_at).toLocaleString() : "";

  const resumeUrl = app._resume_url || "";

  return `
    <div class="bg-white rounded-2xl border p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm text-slate-500 truncate">${escapeHtml(companyName)}</div>
          <div class="text-lg font-semibold leading-tight text-slate-900 truncate">${escapeHtml(title)}</div>

          <div class="mt-2 text-xs text-slate-500">Applied: ${escapeHtml(when)}</div>

          <div class="mt-2 text-sm">
            ${
              resumeUrl
                ? `<a href="${escapeHtml(resumeUrl)}" target="_blank" class="text-blue-600 hover:underline">View Resume</a>`
                : `<span class="text-red-600">Resume missing</span>`
            }
          </div>
        </div>

        <div class="shrink-0">${statusBadge(app.status)}</div>
      </div>
    </div>
  `;
}

async function loadApplications() {
  appsMsg.textContent = "Loading applications...";
  appsList.innerHTML = "";

  const { applications } = await apiFetch("/student/applications");

  appliedListingIds = new Set(
    (applications || []).map((a) => a?.internship_listings?.id).filter(Boolean),
  );

  if (!applications || applications.length === 0) {
    appsMsg.textContent = "No applications yet. Apply to a listing first.";
    return;
  }

  const enriched = await Promise.all(
    (applications || []).map(async (a) => {
      try {
        const url = await getResumeUrlForApplication(a.id);
        return { ...a, _resume_url: url };
      } catch {
        return { ...a, _resume_url: "" };
      }
    }),
  );

  appsMsg.textContent = "";
  appsList.innerHTML = enriched.map(applicationRow).join("");
}

function wireApplyButtons() {
  listingsGrid.querySelectorAll("button[data-listing-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const listingId = btn.getAttribute("data-listing-id");
      if (!listingId || btn.disabled) return;

      const label = btn.getAttribute("data-label") || "";
      openApplyModal(listingId, label);
    });
  });
}

function renderListings() {
  const q = (searchInput?.value || "").trim().toLowerCase();
  const industryFilter = filterIndustry?.value || "all";
  const remoteFilter = filterRemote?.value || "all";

  const filtered = (allListings || [])
    // Students should never see draft listings
    .filter((l) => String(l.status || "").toLowerCase() !== "draft")
    .filter((l) => {
      const c = l.companies || {};
      const hay =
        `${l.title || ""} ${l.description || ""} ${l.location || ""} ${c.company_name || ""}`.toLowerCase();

      if (q && !hay.includes(q)) return false;

      const industry = getIndustry(l);
      if (industryFilter !== "all" && industry !== industryFilter) return false;

      if (remoteFilter === "remote" && !l.allow_remote) return false;
      if (remoteFilter === "onsite" && l.allow_remote) return false;

      return true;
    });

  if (!filtered.length) {
    browseMsg.textContent = "No listings match your search / filters.";
    listingsGrid.innerHTML = "";
    return;
  }

  browseMsg.textContent = "";
  listingsGrid.innerHTML = filtered.map(listingCard).join("");
  wireApplyButtons();
}

async function loadListings() {
  browseMsg.textContent = "Loading listings...";
  listingsGrid.innerHTML = "";

  const { listings } = await apiFetch("/public/listings", { auth: false });
  allListings = listings || [];

  // Safety: hide drafts even if backend accidentally returns them
  allListings = (allListings || []).filter(
    (l) => String(l.status || "").toLowerCase() !== "draft",
  );

  if (!allListings.length) {
    browseMsg.textContent = "No listings available right now.";
    return;
  }

  populateIndustryOptions();
  renderListings();
}

function openApplyModal(listingId, label) {
  pendingListingId = listingId;
  pendingListingLabel = label || "";

  if (modalJobTitle) modalJobTitle.textContent = pendingListingLabel;

  if (applyStatus)
    applyStatus.textContent = "Resume is required to submit your application.";
  if (applyResumeFile) applyResumeFile.value = "";
  if (applyCoverNote) applyCoverNote.value = "";
  if (resumeHint) resumeHint.classList.add("hidden");

  if (applySubmit) applySubmit.disabled = true;

  applyModal?.classList.remove("hidden");
}

function closeApplyModal() {
  pendingListingId = null;
  pendingListingLabel = "";
  applyModal?.classList.add("hidden");
}

function getToken() {
  return localStorage.getItem("access_token") || "";
}

async function fetchForm(path, formData) {
  const token = getToken();
  if (!token) throw new Error("Missing access token. Please login again.");

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(text || "Request failed");
  }

  if (!res.ok) throw new Error(json?.error || "Request failed");
  return json;
}

async function submitApplicationWithResume() {
  const listingId = pendingListingId;
  if (!listingId) throw new Error("Missing listingId");

  const file = applyResumeFile?.files?.[0];
  if (!file) {
    resumeHint?.classList.remove("hidden");
    throw new Error("Resume is required");
  }

  const form = new FormData();
  form.append("listingId", listingId);
  form.append("coverNote", (applyCoverNote?.value || "").trim());
  form.append("resume", file);

  return await fetchForm("/student/apply", form);
}

function wireApplyModal() {
  applyClose?.addEventListener("click", closeApplyModal);
  applyCancel?.addEventListener("click", closeApplyModal);

  applyResumeFile?.addEventListener("change", () => {
    const hasFile = !!applyResumeFile?.files?.length;
    if (applySubmit) applySubmit.disabled = !hasFile;
    if (hasFile) resumeHint?.classList.add("hidden");
  });

  applySubmit?.addEventListener("click", async () => {
    if (!pendingListingId) return;

    applySubmit.disabled = true;
    applySubmit.textContent = "Submitting...";
    applyStatus.textContent = "Submitting application...";

    try {
      await submitApplicationWithResume();

      await loadApplications();
      await loadListings();

      applySubmit.textContent = "Submit application";
      closeApplyModal();
    } catch (err) {
      applyStatus.textContent = err?.message || "Submission failed";
      applySubmit.disabled = false;
      applySubmit.textContent = "Submit application";
    }
  });
}

(async () => {
  const profile = await requireRole(["student"]);
  if (!profile) return;

  wireLogout();
  wireApplyModal();

  userNameEl.textContent = profile.full_name || "Student";
  userLoginIdEl.textContent = profile.login_id || "";

  tabBrowse.addEventListener("click", async () => {
    setActiveTab("browse");
    await loadListings();
  });

  tabApps.addEventListener("click", async () => {
    setActiveTab("apps");
    await loadApplications();
  });

  if (searchInput) searchInput.addEventListener("input", renderListings);
  if (filterIndustry) filterIndustry.addEventListener("change", renderListings);
  if (filterRemote) filterRemote.addEventListener("change", renderListings);

  await loadApplications();
  await loadListings();
})();
