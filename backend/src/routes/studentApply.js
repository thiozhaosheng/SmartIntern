const express = require("express");
const router = express.Router();
const multer = require("multer");

const { requireAuth } = require("../middleware/requireAuth");
const { supabaseAdmin } = require("../lib/supabaseAdmin");

// Configure multer to store files in memory (max 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Ensure authenticated user is a student
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

// POST /student/apply
router.post(
  "/apply",
  requireAuth,
  requireStudent,
  upload.single("resume"),
  async (req, res) => {
    const admin = supabaseAdmin();

    const listingId = String(req.body?.listingId || "").trim();
    const coverNote = String(req.body?.coverNote || "").trim();

    if (!listingId) {
      return res.status(400).json({ error: "listingId is required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "resume is required" });
    }

    // 🔥 NEW: Check listing status before allowing application
    const { data: listing, error: listingErr } = await admin
      .from("internship_listings")
      .select("id, status")
      .eq("id", listingId)
      .maybeSingle();

    if (listingErr) return res.status(500).json({ error: listingErr.message });

    if (!listing) return res.status(404).json({ error: "Listing not found" });

    if (listing.status !== "open") {
      return res.status(400).json({
        error: "This listing is no longer open for applications.",
      });
    }

    // Validate resume file type
    const allowed = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);

    if (req.file.mimetype && !allowed.has(req.file.mimetype)) {
      return res.status(400).json({ error: "Resume must be PDF/DOC/DOCX" });
    }

    // 1) Create application record
    const { data: appRow, error: appErr } = await admin
      .from("applications")
      .insert({
        listing_id: listingId,
        student_user_id: req.user.id,
        cover_note: coverNote || null,
        status: "submitted",
      })
      .select("id, listing_id, student_user_id, status, created_at")
      .maybeSingle();

    if (appErr) {
      const msg = String(appErr.message || "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique")) {
        return res
          .status(409)
          .json({ error: "You already applied to this listing." });
      }
      return res.status(500).json({ error: appErr.message });
    }

    // 2) Upload resume to Supabase Storage
    const safeName = req.file.originalname.replace(/[^\w.\-() ]+/g, "_");
    const key = `${req.user.id}/${appRow.id}/resume_${Date.now()}_${safeName}`;

    const { error: upErr } = await admin.storage
      .from("documents")
      .upload(key, req.file.buffer, {
        contentType: req.file.mimetype || "application/octet-stream",
        upsert: true,
      });

    if (upErr) {
      await admin.from("applications").delete().eq("id", appRow.id);
      return res.status(500).json({ error: upErr.message });
    }

    // 3) Store metadata
    const { data: docRow, error: docErr } = await admin
      .from("application_documents")
      .insert({
        application_id: appRow.id,
        doc_type: "resume",
        file_path: key,
        file_name: req.file.originalname,
        content_type: req.file.mimetype,
      })
      .select("id, doc_type, file_name, content_type, file_path, uploaded_at")
      .maybeSingle();

    if (docErr) {
      await admin.storage.from("documents").remove([key]);
      await admin.from("applications").delete().eq("id", appRow.id);
      return res.status(500).json({ error: docErr.message });
    }

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/documents/${key}`;

    res.json({
      application: appRow,
      resume: { ...docRow, public_url: publicUrl },
    });
  },
);

module.exports = router;
