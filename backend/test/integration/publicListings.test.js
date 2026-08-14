const request = require("supertest");
const app = require("../../src/server");

describe("GET /public/listings/:id", () => {
  test("should return 200 and listing data for a valid listing ID", async () => {
    // Arrange
    const listingId = "ff3c0945-9dca-4262-981b-001c8f21b021";

    // Act
    const response = await request(app).get(`/public/listings/${listingId}`);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("listing");
    expect(response.body.listing).toHaveProperty("id", listingId);
    expect(response.body.listing).toHaveProperty("title");
    expect(response.body.listing).toHaveProperty("status");
    expect(response.body.listing).toHaveProperty("companies");
  });

  test("should return 404 for a listing that does not exist", async () => {
    // Arrange
    const invalidId = "00000000-0000-0000-0000-000000000000";

    // Act
    const response = await request(app).get(`/public/listings/${invalidId}`);

    // Assert
    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      error: "Listing not found",
    });
  });
});
