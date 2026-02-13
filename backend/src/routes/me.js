const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/requireAuth");
const { supabaseAdmin } = require("../lib/supabaseAdmin");

// GET /me
// Returns the currently authenticated user's profile
router.get("/", requireAuth, async (req, res) => {
  const admin = supabaseAdmin();

  // Load profile based on auth user id
  const { data: profile, error } = await admin
    .from("profiles")
    .select("role, full_name, login_id, email")
    .eq("id", req.user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: "Failed to load profile" });
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  // Return minimal profile info needed by frontend
  res.json({ profile });
});

module.exports = router;
