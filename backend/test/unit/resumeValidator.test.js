const { isAllowedResumeType } = require("../../src/utils/resumeValidator");

describe("Resume Validator", () => {
  test("should accept PDF resume", () => {
    // Arrange - Stub fixed test data
    const mimetype = "application/pdf";

    // Act
    const result = isAllowedResumeType(mimetype);

    // Assert
    expect(result).toBe(true);
  });

  test("should accept DOCX resume", () => {
    // Arrange - Stub fixed test data
    const mimetype =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    // Act
    const result = isAllowedResumeType(mimetype);

    // Assert
    expect(result).toBe(true);
  });

  test("should reject image file", () => {
    // Arrange - Stub fixed test data
    const mimetype = "image/png";

    // Act
    const result = isAllowedResumeType(mimetype);

    // Assert
    expect(result).toBe(false);
  });

  test("should use a mock function", () => {
    // Arrange - Mock
    const mockValidator = jest.fn().mockReturnValue(true);

    // Act
    const result = mockValidator("application/pdf");

    // Assert
    expect(result).toBe(true);
    expect(mockValidator).toHaveBeenCalledWith("application/pdf");
  });

  test("should spy on array includes method", () => {
    // Arrange - Spy
    const allowedTypes = ["application/pdf", "application/msword"];
    const spy = jest.spyOn(allowedTypes, "includes");

    // Act
    allowedTypes.includes("application/pdf");

    // Assert
    expect(spy).toHaveBeenCalledWith("application/pdf");

    spy.mockRestore();
  });
});
