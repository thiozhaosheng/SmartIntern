const { supabasePublic } = require("../lib/supabasePublic");

// Middleware to verify JWT from Authorization header
// Attaches authenticated user to req.user
async function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const sb = supabasePublic();
  const { data, error } = await sb.auth.getUser(token);

  if (error || !data?.user)
    return res.status(401).json({ error: "Invalid token" });

  req.user = data.user;
  next();
}

module.exports = { requireAuth };
