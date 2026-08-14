const { test, expect } = require("@playwright/test");

test("student can apply for an open internship", async ({ page }) => {
  // Arrange
  const baseUrl = process.env.E2E_BASE_URL;
  const loginId = process.env.E2E_LOGIN_ID;
  const password = process.env.E2E_PASSWORD;

  if (!baseUrl || !loginId || !password) {
    throw new Error("Missing E2E_BASE_URL, E2E_LOGIN_ID or E2E_PASSWORD");
  }

  // Open SmartIntern
  await page.goto(baseUrl);

  // Login
  await page.locator('input[placeholder*="A0001"]').fill(loginId);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Login" }).click();

  // Wait for redirect
  await page.waitForTimeout(2000);

  // Verify student page loaded
  await expect(page).toHaveURL(/student\.html/, {
    timeout: 10000,
  });

  await expect(page.getByText("Find internships")).toBeVisible();

  // Wait for listings
  await expect(page.locator("#listingsGrid")).toBeVisible();

  // Find first available Apply button
  const applyButton = page
    .locator("#listingsGrid button[data-listing-id]:not([disabled])")
    .first();

  await expect(applyButton).toBeVisible();

  // Save listing title
  const listingLabel = await applyButton.getAttribute("data-label");
  const listingTitle = listingLabel.split(" • ")[0];

  // Open apply modal
  await applyButton.click();

  await expect(page.locator("#applyModal")).toBeVisible();

  await expect(
    page.getByText("Apply for internship", { exact: true }),
  ).toBeVisible();

  // Upload resume
  await page.locator("#applyResumeFile").setInputFiles({
    name: "test-resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 SmartIntern E2E Test Resume"),
  });

  // Cover note
  await page.locator("#applyCoverNote").fill("Automated E2E test application.");

  // Submit application
  await expect(page.locator("#applySubmit")).toBeEnabled();
  await page.locator("#applySubmit").click();

  // Wait for modal to close
  await expect(page.locator("#applyModal")).toHaveClass(/hidden/, {
    timeout: 15000,
  });

  // Open My Applications
  await page.locator("#tabApps").click();

  // Verify My Applications page is displayed
  await expect(
    page.getByRole("heading", { name: "My applications" }),
  ).toBeVisible();

  // Find the specific application card that contains the listing title
  const applicationCard = page
    .locator("#appsList > div")
    .filter({ hasText: listingTitle })
    .first();

  // Verify the application appears
  await expect(applicationCard).toBeVisible();

  // Verify correct listing title
  await expect(
    applicationCard.getByText(listingTitle, { exact: true }),
  ).toBeVisible();

  // Verify status is Submitted
  await expect(
    applicationCard.getByText("Submitted", { exact: true }),
  ).toBeVisible();
});
