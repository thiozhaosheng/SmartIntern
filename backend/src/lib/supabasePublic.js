const { createClient } = require("@supabase/supabase-js");

// Creates a Supabase client using the public anon key.
// Used for requests that should respect RLS policies.
function supabasePublic() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

module.exports = { supabasePublic };
