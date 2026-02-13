const { createClient } = require("@supabase/supabase-js");

// Creates a Supabase client using the service role key.
// Used for backend admin operations.
function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

module.exports = { supabaseAdmin };
