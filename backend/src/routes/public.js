const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../lib/supabaseAdmin");

// Fetch all companies for public listing page
router.get("/companies", async (req, res) => {
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("companies")
    .select(
      "id, company_name, industry, description, website, location, logo_url, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json({ companies: data });
});

// Fetch internship listings for student/public view
// We show:
// - open   → visible
// - closed → visible (but student cannot apply)
// - draft  → hidden
router.get("/listings", async (req, res) => {
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("internship_listings")
    .select(
      `
      id, title, description, requirements, allowance, location, allow_remote, status, created_at,
      companies:company_id ( id, company_name, industry, location, website, logo_url )
    `,
    )
    // show open + closed, hide draft
    .in("status", ["open", "closed"])
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json({ listings: data });
});

// Fetch a single listing by id (public view)
// Still allows fetching closed listings
router.get("/listings/:id", async (req, res) => {
  const admin = supabaseAdmin();
  const listingId = req.params.id;

  const { data, error } = await admin
    .from("internship_listings")
    .select(
      `
      id, title, description, requirements, allowance, location, allow_remote, status, created_at,
      companies:company_id ( id, company_name, industry, description, website, location, logo_url )
    `,
    )
    .eq("id", listingId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Listing not found" });

  // prevent draft listings from being exposed publicly
  if (data.status === "draft") {
    return res.status(404).json({ error: "Listing not found" });
  }

  res.json({ listing: data });
});

module.exports = router;
