const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/requireAuth");
const { supabaseAdmin } = require("../lib/supabaseAdmin");

// Middleware to ensure the authenticated user has a student role
async function requireStudent(req, res, next) {
  const admin = supabaseAdmin();

  const { data: profile, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", req.user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  if (!profile || profile.role !== "student") {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

// GET /student/applications
// Returns all applications submitted by the logged-in student
router.get("/applications", requireAuth, requireStudent, async (req, res) => {
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("applications")
    .select(
      `
      id, status, cover_note, created_at,
      internship_listings:listing_id (
        id, title, location, allow_remote, allowance, status, created_at,
        companies:company_id ( id, company_name, logo_url, location, industry, website )
      )
    `,
    )
    .eq("student_user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json({ applications: data });
});

// POST /student/applications
// Creates a new application for the logged-in student
// Expects: { listingId, coverNote }
router.post("/applications", requireAuth, requireStudent, async (req, res) => {
  const admin = supabaseAdmin();

  const { listingId, coverNote } = req.body || {};

  if (!listingId) {
    return res.status(400).json({ error: "listingId is required" });
  }

  const { data, error } = await admin
    .from("applications")
    .insert({
      listing_id: listingId,
      student_user_id: req.user.id,
      cover_note: coverNote || null,
      status: "submitted",
    })
    .select("id, listing_id, student_user_id, status, created_at")
    .maybeSingle();

  if (error) {
    // Handles unique constraint violation (one application per listing per student)
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return res
        .status(409)
        .json({ error: "You already applied to this listing." });
    }

    return res.status(500).json({ error: error.message });
  }

  res.json({ application: data });
});

module.exports = router;
