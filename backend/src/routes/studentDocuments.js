const express = require("express");
const router = express.Router();
const multer = require("multer");

const { requireAuth } = require("../middleware/requireAuth");
const { supabaseAdmin } = require("../lib/supabaseAdmin");

// Multer config: store uploads in memory, cap file size at 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Middleware to ensure the authenticated user is a student
async function requireStudent(req, res, next) {
  const admin = supabaseAdmin();

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", req.user.id)
    .maybeSingle();

  if (profErr) return res.status(500).json({ error: profErr.message });

  if (!profile || profile.role !== "student") {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

// GET /student/applications/:applicationId/documents
// Returns documents for an application owned by the logged-in student
router.get(
  "/applications/:applicationId/documents",
  requireAuth,
  requireStudent,
  async (req, res) => {
    const admin = supabaseAdmin();
    const { applicationId } = req.params;

    // Verify the application belongs to this student
    const { data: appRow, error: appErr } = await admin
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("student_user_id", req.user.id)
      .maybeSingle();

    if (appErr) return res.status(500).json({ error: appErr.message });

    if (!appRow) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Fetch document metadata for this application
    const { data, error } = await admin
      .from("application_documents")
      .select("id, doc_type, file_name, content_type, file_path, uploaded_at")
      .eq("application_id", applicationId)
      .order("uploaded_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const base = `${process.env.SUPABASE_URL}/storage/v1/object/public/documents/`;

    res.json({
      documents: (data || []).map((d) => ({
        ...d,
        public_url: base + d.file_path,
      })),
    });
  },
);

// POST /student/applications/:applicationId/documents
// Accepts multipart/form-data
// Fields:
// - docType: resume | cover_letter | other
// - file: upload (PDF/DOC/DOCX)
router.post(
  "/applications/:applicationId/documents",
  requireAuth,
  requireStudent,
  upload.single("file"),
  async (req, res) => {
    const admin = supabaseAdmin();
    const { applicationId } = req.params;

    const docType = String(req.body?.docType || "resume");
    if (!["resume", "cover_letter", "other"].includes(docType)) {
      return res.status(400).json({ error: "Invalid docType" });
    }

    if (!req.file) return res.status(400).json({ error: "file is required" });

    // Restrict uploads to PDF/DOC/DOCX
    const allowed = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);

    if (req.file.mimetype && !allowed.has(req.file.mimetype)) {
      return res.status(400).json({ error: "Only PDF/DOC/DOCX allowed" });
    }

    // Verify the application belongs to this student
    const { data: appRow, error: appErr } = await admin
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("student_user_id", req.user.id)
      .maybeSingle();

    if (appErr) return res.status(500).json({ error: appErr.message });

    if (!appRow) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Build a stable storage key under: <student>/<application>/<doctype>_<timestamp>_<filename>
    const safeName = req.file.originalname.replace(/[^\w.\-() ]+/g, "_");
    const key = `${req.user.id}/${applicationId}/${docType}_${Date.now()}_${safeName}`;

    // Upload into the "documents" bucket
    const { error: upErr } = await admin.storage
      .from("documents")
      .upload(key, req.file.buffer, {
        contentType: req.file.mimetype || "application/octet-stream",
        upsert: true,
      });

    if (upErr) return res.status(500).json({ error: upErr.message });

    // Store metadata in application_documents
    const { data: docRow, error: docErr } = await admin
      .from("application_documents")
      .insert({
        application_id: applicationId,
        doc_type: docType,
        file_path: key,
        file_name: req.file.originalname,
        content_type: req.file.mimetype,
      })
      .select("id, doc_type, file_name, content_type, file_path, uploaded_at")
      .maybeSingle();

    if (docErr) return res.status(500).json({ error: docErr.message });

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/documents/${key}`;

    res.json({ document: { ...docRow, public_url: publicUrl } });
  },
);

module.exports = router;
