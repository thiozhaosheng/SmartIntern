require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

// Route modules
const authRoutes = require("./routes/auth");
const meRoutes = require("./routes/me");
const publicRoutes = require("./routes/public");
const studentRoutes = require("./routes/student");
const companyRoutes = require("./routes/company");
const studentDocumentsRoutes = require("./routes/studentDocuments");
const studentApplyRoutes = require("./routes/studentApply");
const adminRoutes = require("./routes/admin");

const app = express();

// Parse JSON request bodies
app.use(express.json());

// CORS configuration
// ALLOWED_ORIGIN should match your frontend domain
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,
    credentials: false,
  }),
);

// Simple Supabase connection check using service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Basic health endpoint for uptime checks
app.get("/health", (req, res) => res.json({ ok: true }));

// Endpoint to verify backend can connect to Supabase
app.get("/supabase-check", async (req, res) => {
  const { data, error } = await supabase.from("profiles").select("id").limit(1);

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }

  return res.json({
    ok: true,
    message: "Backend successfully connected to Supabase",
    sample: data,
  });
});

// Route mounting
app.use("/auth", authRoutes);
app.use("/me", meRoutes);

app.use("/public", publicRoutes);
app.use("/student", studentRoutes);
app.use("/company", companyRoutes);
app.use("/student", studentDocumentsRoutes);
app.use("/student", studentApplyRoutes);
app.use("/admin", adminRoutes);

// Start server
const port = process.env.PORT || 8080;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`API running on :${port}`);
  });
}

module.exports = app;
