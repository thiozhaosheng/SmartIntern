const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../lib/supabaseAdmin");
const { supabasePublic } = require("../lib/supabasePublic");

// Auth login endpoint
// Accepts loginId + password, then looks up the user's email from profiles
router.post("/login", async (req, res) => {
  const { loginId, password } = req.body || {};
  if (!loginId || !password)
    return res.status(400).json({ error: "loginId and password are required" });

  // Resolve login_id -> email using service role
  const admin = supabaseAdmin();
  const { data: profile, error: lookupErr } = await admin
    .from("profiles")
    .select("email, role, full_name, login_id")
    .eq("login_id", loginId)
    .maybeSingle();

  if (lookupErr)
    return res.status(500).json({ error: "Profile lookup failed" });
  if (!profile) return res.status(401).json({ error: "Invalid credentials" });

  // Sign in with Supabase Auth using the resolved email
  const pub = supabasePublic();
  const { data, error: signInErr } = await pub.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (signInErr || !data?.session)
    return res.status(401).json({ error: "Invalid credentials" });

  return res.json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
    profile: {
      role: profile.role,
      full_name: profile.full_name,
      login_id: profile.login_id,
    },
  });
});

module.exports = router;
