async function validateListingForApplication(admin, listingId) {
  const { data: listing, error } = await admin
    .from("internship_listings")
    .select("id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!listing) {
    const err = new Error("Listing not found");
    err.statusCode = 404;
    throw err;
  }

  if (listing.status !== "open") {
    const err = new Error("This listing is no longer open for applications.");
    err.statusCode = 400;
    throw err;
  }

  return listing;
}

module.exports = { validateListingForApplication };
