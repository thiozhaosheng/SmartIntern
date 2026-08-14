const {
  validateListingForApplication,
} = require("../../src/services/listingService");

describe("validateListingForApplication", () => {
  test("should allow application when listing is open", async () => {
    // Arrange - Stub fixed listing data
    const stubListing = {
      id: "listing-123",
      status: "open",
    };

    const maybeSingle = jest.fn().mockResolvedValue({
      data: stubListing,
      error: null,
    });

    const eq = jest.fn().mockReturnValue({
      maybeSingle,
    });

    const select = jest.fn().mockReturnValue({
      eq,
    });

    // Mock the real Supabase client
    const mockAdmin = {
      from: jest.fn().mockReturnValue({
        select,
      }),
    };

    // Spy on the real dependency method
    const fromSpy = jest.spyOn(mockAdmin, "from");

    // Act
    const result = await validateListingForApplication(
      mockAdmin,
      "listing-123",
    );

    // Assert
    expect(result).toEqual(stubListing);
    expect(fromSpy).toHaveBeenCalledWith("internship_listings");
    expect(eq).toHaveBeenCalledWith("id", "listing-123");
  });

  test("should reject application when listing is closed", async () => {
    // Arrange - Stub fixed listing data
    const stubListing = {
      id: "listing-123",
      status: "closed",
    };

    const maybeSingle = jest.fn().mockResolvedValue({
      data: stubListing,
      error: null,
    });

    const eq = jest.fn().mockReturnValue({
      maybeSingle,
    });

    const select = jest.fn().mockReturnValue({
      eq,
    });

    const mockAdmin = {
      from: jest.fn().mockReturnValue({
        select,
      }),
    };

    // Act
    const action = validateListingForApplication(mockAdmin, "listing-123");

    // Assert
    await expect(action).rejects.toMatchObject({
      message: "This listing is no longer open for applications.",
      statusCode: 400,
    });
  });

  test("should reject application when listing does not exist", async () => {
    // Arrange
    const maybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const eq = jest.fn().mockReturnValue({
      maybeSingle,
    });

    const select = jest.fn().mockReturnValue({
      eq,
    });

    const mockAdmin = {
      from: jest.fn().mockReturnValue({
        select,
      }),
    };

    // Act
    const action = validateListingForApplication(mockAdmin, "invalid-id");

    // Assert
    await expect(action).rejects.toMatchObject({
      message: "Listing not found",
      statusCode: 404,
    });
  });
});
