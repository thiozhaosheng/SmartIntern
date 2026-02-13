// routes/admin.js

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth");
const { supabaseAdmin } = require("../lib/supabaseAdmin");

// Basic validators and normalizers
function isUuid(v) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  );
}

function toLowerTrim(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

// keep status values consistent everywhere
function normalizeListingStatus(v) {
  const s = toLowerTrim(v);

  // allow some common "typo" values if frontend accidentally sends them
  if (s === "close") return "closed";

  // only these 3 allowed
  if (["open", "closed", "draft"].includes(s)) return s;

  return null;
}

// Admin-only gate for all /admin routes
async function requireAdmin(req, res, next) {
  try {
    const admin = supabaseAdmin();

    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", req.user.id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    if (profile.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });

    next();
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Request failed" });
  }
}

// Create a user account (student or company)
// login_id is kept in sync with email
router.post("/users", requireAuth, requireAdmin, async (req, res) => {
  const admin = supabaseAdmin();

  const role = toLowerTrim(req.body?.role);
  const email = toLowerTrim(req.body?.email);
  const password = String(req.body?.password || "").trim();
  const fullName = String(req.body?.fullName || "").trim();

  if (!["student", "company"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  if (!email || !password || !fullName) {
    return res
      .status(400)
      .json({ error: "role, email, password, fullName are required" });
  }

  const loginId = email;

  let userId = null;

  try {
    // Create auth user
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createErr) return res.status(500).json({ error: createErr.message });

    userId = created?.user?.id;
    if (!userId) return res.status(500).json({ error: "User creation failed" });

    // Create profile first
    const { data: profileRow1, error: profErr1 } = await admin
      .from("profiles")
      .insert({
        id: userId,
        role,
        email,
        full_name: fullName,
        login_id: loginId,
        company_id: null,
      })
      .select("id, role, email, full_name, login_id, company_id")
      .maybeSingle();

    if (profErr1) {
      await admin.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: profErr1.message });
    }

    // Company setup
    if (role === "company") {
      const companyName = String(req.body?.companyName || "").trim();
      const industry = String(req.body?.industry || "").trim() || null;
      const location = String(req.body?.location || "").trim() || null;

      if (!companyName) {
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
        return res.status(400).json({ error: "companyName is required" });
      }

      const { data: companyRow, error: compErr } = await admin
        .from("companies")
        .insert({
          company_name: companyName,
          industry,
          location,
          owner_user_id: userId,
        })
        .select("id, company_name, industry, location, owner_user_id")
        .maybeSingle();

      if (compErr) {
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
        return res.status(500).json({ error: compErr.message });
      }

      const companyId = companyRow?.id || null;

      const { data: profileRow2, error: profErr2 } = await admin
        .from("profiles")
        .update({ company_id: companyId })
        .eq("id", userId)
        .select("id, role, email, full_name, login_id, company_id")
        .maybeSingle();

      if (profErr2) {
        await admin.from("companies").delete().eq("id", companyId);
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
        return res.status(500).json({ error: profErr2.message });
      }

      return res.json({ ok: true, profile: profileRow2, company: companyRow });
    }

    return res.json({ ok: true, profile: profileRow1 });
  } catch (err) {
    try {
      if (userId) {
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
      }
    } catch {}
    return res.status(500).json({ error: err?.message || "Request failed" });
  }
});

// List users with auth disabled state derived from banned_until
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  const admin = supabaseAdmin();

  const role = toLowerTrim(req.query?.role || "all");
  const q = String(req.query?.q || "")
    .trim()
    .toLowerCase();

  let query = admin
    .from("profiles")
    .select("id, role, full_name, login_id, email, company_id, created_at")
    .order("created_at", { ascending: false });

  if (role && role !== "all") query = query.eq("role", role);

  const { data: profiles, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const list = profiles || [];

  // Build auth lookup map keyed by user id
  const authMap = new Map();
  try {
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data: authData, error: authErr } =
        await admin.auth.admin.listUsers({ page, perPage });

      if (authErr) break;

      const users = authData?.users || [];
      for (const u of users) {
        authMap.set(u.id, { banned_until: u.banned_until || null });
      }

      if (users.length < perPage) break;
      page += 1;
    }
  } catch {}

  const enriched = list
    .map((p) => {
      const a = authMap.get(p.id);
      const banned_until = a?.banned_until || null;
      const disabled = !!banned_until && new Date(banned_until) > new Date();
      return { ...p, disabled, banned_until };
    })
    .filter((p) => {
      if (!q) return true;
      const hay =
        `${p.full_name || ""} ${p.email || ""} ${p.login_id || ""}`.toLowerCase();
      return hay.includes(q);
    });

  return res.json({ users: enriched });
});

// Update user name and/or email
// Email updates keep profiles.email and profiles.login_id in sync
router.patch("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const admin = supabaseAdmin();
  const userId = req.params.id;

  if (!isUuid(userId))
    return res.status(400).json({ error: "Invalid user id" });

  const { data: targetProfile, error: pErr } = await admin
    .from("profiles")
    .select("id, role, email, login_id, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (pErr) return res.status(500).json({ error: pErr.message });
  if (!targetProfile) return res.status(404).json({ error: "User not found" });

  const fullName =
    req.body?.fullName === undefined
      ? undefined
      : String(req.body.fullName || "").trim();

  const email =
    req.body?.email === undefined ? undefined : toLowerTrim(req.body.email);

  if (fullName !== undefined && !fullName) {
    return res.status(400).json({ error: "fullName cannot be empty" });
  }
  if (email !== undefined && !email) {
    return res.status(400).json({ error: "email cannot be empty" });
  }
  if (email !== undefined) {
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!okEmail) return res.status(400).json({ error: "Invalid email" });
  }

  const patch = {};
  if (fullName !== undefined) patch.full_name = fullName;

  const emailChanged =
    email !== undefined && email !== toLowerTrim(targetProfile.email);

  if (emailChanged) {
    patch.email = email;
    patch.login_id = email;
  }

  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    // Update profile fields first
    const { data: updatedProfile, error: upErr } = await admin
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("id, role, full_name, email, login_id, company_id, created_at")
      .maybeSingle();

    if (upErr) return res.status(500).json({ error: upErr.message });

    // Keep auth email aligned
    if (emailChanged) {
      const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
      });

      if (authErr) {
        // Roll back profile email/login_id if auth update fails
        await admin
          .from("profiles")
          .update({
            email: targetProfile.email,
            login_id: targetProfile.login_id,
          })
          .eq("id", userId);

        return res.status(500).json({
          error: `Auth email update failed: ${authErr.message}`,
        });
      }
    }

    return res.json({ ok: true, user: updatedProfile });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Update failed" });
  }
});

// List companies
router.get("/companies", requireAuth, requireAdmin, async (req, res) => {
  const admin = supabaseAdmin();
  const q = String(req.query?.q || "")
    .trim()
    .toLowerCase();

  const { data, error } = await admin
    .from("companies")
    .select(
      "id, company_name, industry, location, logo_url, owner_user_id, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const companies = (data || []).filter((c) => {
    if (!q) return true;
    const hay =
      `${c.company_name || ""} ${c.industry || ""} ${c.location || ""}`.toLowerCase();
    return hay.includes(q);
  });

  return res.json({ companies });
});

// Update basic company fields including logo_url
router.patch("/companies/:id", requireAuth, requireAdmin, async (req, res) => {
  const admin = supabaseAdmin();
  const companyId = req.params.id;

  if (!isUuid(companyId))
    return res.status(400).json({ error: "Invalid company id" });

  const companyName = String(req.body?.companyName || "").trim();
  const industry =
    req.body?.industry === undefined
      ? undefined
      : String(req.body?.industry || "").trim();
  const location =
    req.body?.location === undefined
      ? undefined
      : String(req.body?.location || "").trim();
  const logoUrl =
    req.body?.logoUrl === undefined
      ? undefined
      : String(req.body?.logoUrl || "").trim();

  const patch = {};
  if (companyName) patch.company_name = companyName;
  if (industry !== undefined) patch.industry = industry || null;
  if (location !== undefined) patch.location = location || null;
  if (logoUrl !== undefined) patch.logo_url = logoUrl || null;

  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const { data, error } = await admin
    .from("companies")
    .update(patch)
    .eq("id", companyId)
    .select(
      "id, company_name, industry, location, logo_url, owner_user_id, created_at",
    )
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, company: data });
});

// Simple counts for dashboard stats
router.get("/stats", requireAuth, requireAdmin, async (req, res) => {
  const admin = supabaseAdmin();

  try {
    const [usersRes, companiesRes, listingsRes, applicationsRes] =
      await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin.from("companies").select("id", { count: "exact", head: true }),
        admin
          .from("internship_listings")
          .select("id", { count: "exact", head: true }),
        admin.from("applications").select("id", { count: "exact", head: true }),
      ]);

    const anyErr =
      usersRes.error ||
      companiesRes.error ||
      listingsRes.error ||
      applicationsRes.error;

    if (anyErr) {
      return res.status(500).json({
        error:
          usersRes.error?.message ||
          companiesRes.error?.message ||
          listingsRes.error?.message ||
          applicationsRes.error?.message ||
          "Stats query failed",
      });
    }

    return res.json({
      stats: {
        users: usersRes.count || 0,
        companies: companiesRes.count || 0,
        listings: listingsRes.count || 0,
        applications: applicationsRes.count || 0,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Stats failed" });
  }
});

// List internship listings with optional filters
router.get("/listings", requireAuth, requireAdmin, async (req, res) => {
  const admin = supabaseAdmin();

  const q = String(req.query?.q || "")
    .trim()
    .toLowerCase();
  const status = toLowerTrim(req.query?.status || "all");
  const companyId = String(req.query?.company_id || "").trim();

  let query = admin
    .from("internship_listings")
    .select(
      `
      id, company_id, title, description, requirements, allowance, location, allow_remote, status, created_at,
      companies:company_id ( id, company_name, industry, location, logo_url )
    `,
    )
    .order("created_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);
  if (companyId) {
    if (!isUuid(companyId))
      return res.status(400).json({ error: "Invalid company_id" });
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const listings = (data || []).filter((l) => {
    if (!q) return true;
    const c = l.companies || {};
    const hay =
      `${l.title || ""} ${l.description || ""} ${l.location || ""} ${c.company_name || ""}`.toLowerCase();
    return hay.includes(q);
  });

  return res.json({ listings });
});

/**
 * ✅ THIS WAS MISSING
 * Update a listing's status from admin side.
 * Allowed: open | closed | draft
 */
router.patch(
  "/listings/:id/status",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const admin = supabaseAdmin();
    const listingId = String(req.params.id || "").trim();

    if (!isUuid(listingId)) {
      return res.status(400).json({ error: "Invalid listing id" });
    }

    const status = normalizeListingStatus(req.body?.status);
    if (!status) {
      return res.status(400).json({
        error: "Invalid status. Use: open, closed, or draft.",
      });
    }

    // make sure listing exists first (better error)
    const { data: existing, error: exErr } = await admin
      .from("internship_listings")
      .select("id, status")
      .eq("id", listingId)
      .maybeSingle();

    if (exErr) return res.status(500).json({ error: exErr.message });
    if (!existing) return res.status(404).json({ error: "Listing not found" });

    const { data: updated, error } = await admin
      .from("internship_listings")
      .update({ status })
      .eq("id", listingId)
      .select(
        "id, company_id, title, status, description, requirements, allowance, location, allow_remote, created_at",
      )
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ ok: true, listing: updated });
  },
);

// List applications with optional filters
router.get("/applications", requireAuth, requireAdmin, async (req, res) => {
  const admin = supabaseAdmin();

  const q = String(req.query?.q || "")
    .trim()
    .toLowerCase();
  const status = toLowerTrim(req.query?.status || "all");
  const listingId = String(req.query?.listing_id || "").trim();
  const companyId = String(req.query?.company_id || "").trim();

  let query = admin
    .from("applications")
    .select(
      `
      id, listing_id, student_user_id, cover_note, status, created_at,
      internship_listings:listing_id (
        id, title, company_id,
        companies:company_id ( id, company_name, logo_url )
      ),
      profiles:student_user_id ( id, full_name, email, login_id )
    `,
    )
    .order("created_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);
  if (listingId) {
    if (!isUuid(listingId))
      return res.status(400).json({ error: "Invalid listing_id" });
    query = query.eq("listing_id", listingId);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  let apps = data || [];

  if (companyId) {
    if (!isUuid(companyId))
      return res.status(400).json({ error: "Invalid company_id" });
    apps = apps.filter((a) => a?.internship_listings?.company_id === companyId);
  }

  apps = apps.filter((a) => {
    if (!q) return true;
    const s = a.profiles || {};
    const l = a.internship_listings || {};
    const c = l.companies || {};
    const hay =
      `${s.full_name || ""} ${s.email || ""} ${s.login_id || ""} ${l.title || ""} ${c.company_name || ""}`.toLowerCase();
    return hay.includes(q);
  });

  return res.json({ applications: apps });
});

module.exports = router;
