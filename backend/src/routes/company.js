const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth");
const { supabaseAdmin } = require("../lib/supabaseAdmin");

const VALID_APP_STATUSES = new Set([
  "reviewing",
  "shortlisted",
  "rejected",
  "accepted",
]);

async function getCompanyContext(req) {
  const admin = supabaseAdmin();

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("id, role, company_id")
    .eq("id", req.user.id)
    .maybeSingle();

  if (profErr) return { error: profErr.message, status: 500 };
  if (!profile) return { error: "Profile not found", status: 404 };
  if (profile.role !== "company") return { error: "Forbidden", status: 403 };

  if (profile.company_id) return { admin, companyId: profile.company_id };

  // fallback for older accounts where profiles.company_id is not populated
  const { data: company, error: compErr } = await admin
    .from("companies")
    .select("id")
    .eq("owner_user_id", req.user.id)
    .maybeSingle();

  if (compErr) return { error: compErr.message, status: 500 };
  if (!company) {
    return {
      error: "Company account is not linked to a company_id",
      status: 400,
    };
  }

  return { admin, companyId: company.id };
}

async function assertListingOwnedByCompany(admin, listingId, companyId) {
  const { data: listing, error } = await admin
    .from("internship_listings")
    .select("id, company_id, title")
    .eq("id", listingId)
    .maybeSingle();

  if (error) return { error: error.message, status: 500 };
  if (!listing) return { error: "Listing not found", status: 404 };
  if (listing.company_id !== companyId)
    return { error: "Forbidden", status: 403 };

  return { listing };
}

// POST /company/listings
router.post("/listings", requireAuth, async (req, res) => {
  const ctx = await getCompanyContext(req);
  if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

  const { admin, companyId } = ctx;

  const {
    title,
    description,
    requirements,
    allowance,
    location,
    allowRemote,
    status,
  } = req.body || {};

  if (!title || !String(title).trim())
    return res.status(400).json({ error: "title is required" });

  if (!description || !String(description).trim())
    return res.status(400).json({ error: "description is required" });

  const payload = {
    company_id: companyId,
    title: String(title).trim(),
    description: String(description).trim(),
    requirements: requirements ? String(requirements).trim() : null,
    allowance: allowance === "" || allowance == null ? null : Number(allowance),
    location: location ? String(location).trim() : null,
    allow_remote: !!allowRemote,
    status: status ? String(status).trim() : "open",
  };

  if (payload.allowance != null && Number.isNaN(payload.allowance)) {
    return res.status(400).json({ error: "allowance must be a number" });
  }

  const { data, error } = await admin
    .from("internship_listings")
    .insert(payload)
    .select(
      "id, company_id, title, description, requirements, allowance, location, allow_remote, status, created_at",
    )
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ listing: data });
});

// GET /company/listings
router.get("/listings", requireAuth, async (req, res) => {
  const ctx = await getCompanyContext(req);
  if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

  const { admin, companyId } = ctx;

  const { data, error } = await admin
    .from("internship_listings")
    .select(
      "id, company_id, title, description, requirements, allowance, location, allow_remote, status, created_at",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ listings: data || [] });
});

// GET /company/listings/:id/applicants
router.get("/listings/:id/applicants", requireAuth, async (req, res) => {
  const ctx = await getCompanyContext(req);
  if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

  const { admin, companyId } = ctx;
  const listingId = req.params.id;

  const own = await assertListingOwnedByCompany(admin, listingId, companyId);
  if (own.error) return res.status(own.status).json({ error: own.error });

  const { data: apps, error: appsErr } = await admin
    .from("applications")
    .select(
      `
      id, listing_id, student_user_id, cover_note, status, created_at,
      profiles:student_user_id ( id, full_name, login_id, email )
    `,
    )
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });

  if (appsErr) return res.status(500).json({ error: appsErr.message });

  const appIds = (apps || []).map((a) => a.id);

  const docMap = new Map();
  if (appIds.length) {
    const { data: docs, error: docsErr } = await admin
      .from("application_documents")
      .select("application_id, doc_type, file_path, file_name, uploaded_at")
      .in("application_id", appIds)
      .eq("doc_type", "resume")
      .order("uploaded_at", { ascending: false });

    if (docsErr) return res.status(500).json({ error: docsErr.message });

    for (const d of docs || []) {
      if (!docMap.has(d.application_id)) docMap.set(d.application_id, d);
    }
  }

  const base = `${process.env.SUPABASE_URL}/storage/v1/object/public/documents/`;

  const applicants = (apps || []).map((a) => {
    const resumeDoc = docMap.get(a.id);
    return {
      id: a.id,
      status: a.status,
      cover_note: a.cover_note,
      created_at: a.created_at,
      student: {
        id: a.profiles?.id || a.student_user_id,
        full_name: a.profiles?.full_name || "",
        login_id: a.profiles?.login_id || "",
        email: a.profiles?.email || "",
      },
      resume: resumeDoc
        ? {
            file_name: resumeDoc.file_name,
            public_url: base + resumeDoc.file_path,
          }
        : null,
    };
  });

  return res.json({
    listing: { id: own.listing.id, title: own.listing.title },
    applicants,
  });
});

// PATCH /company/applications/:id/status
router.patch("/applications/:id/status", requireAuth, async (req, res) => {
  const ctx = await getCompanyContext(req);
  if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

  const { admin, companyId } = ctx;
  const appId = req.params.id;
  const status = String(req.body?.status || "")
    .trim()
    .toLowerCase();

  if (!VALID_APP_STATUSES.has(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const { data: appRow, error: appErr } = await admin
    .from("applications")
    .select(
      `
      id, status, listing_id,
      internship_listings:listing_id ( company_id )
    `,
    )
    .eq("id", appId)
    .maybeSingle();

  if (appErr) return res.status(500).json({ error: appErr.message });
  if (!appRow) return res.status(404).json({ error: "Application not found" });

  const ownerCompanyId = appRow?.internship_listings?.company_id;
  if (ownerCompanyId !== companyId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data, error } = await admin
    .from("applications")
    .update({ status })
    .eq("id", appId)
    .select("id, status, listing_id")
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ application: data });
});

// PATCH /company/listings/:id/status
router.patch("/listings/:id/status", requireAuth, async (req, res) => {
  const ctx = await getCompanyContext(req);
  if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

  const { admin, companyId } = ctx;
  const listingId = req.params.id;
  const status = String(req.body?.status || "")
    .trim()
    .toLowerCase();

  const allowed = new Set(["open", "closed", "draft"]);
  if (!allowed.has(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const own = await assertListingOwnedByCompany(admin, listingId, companyId);
  if (own.error) return res.status(own.status).json({ error: own.error });

  const { data, error } = await admin
    .from("internship_listings")
    .update({ status })
    .eq("id", listingId)
    .select(
      "id, company_id, title, description, requirements, allowance, location, allow_remote, status, created_at",
    )
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ listing: data });
});

// DELETE /company/listings/:id
router.delete("/listings/:id", requireAuth, async (req, res) => {
  const ctx = await getCompanyContext(req);
  if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

  const { admin, companyId } = ctx;
  const listingId = req.params.id;

  const own = await assertListingOwnedByCompany(admin, listingId, companyId);
  if (own.error) return res.status(own.status).json({ error: own.error });

  const { error } = await admin
    .from("internship_listings")
    .delete()
    .eq("id", listingId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

module.exports = router;
