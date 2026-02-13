import { apiFetch } from "./api.js";

// Clear session and return to login page
function goLogin() {
  localStorage.clear();
  window.location.href = "./index.html";
}

// Redirect user based on their role
function redirectByRole(role) {
  if (role === "admin") window.location.href = "./admin.html";
  else if (role === "student") window.location.href = "./student.html";
  else if (role === "company") window.location.href = "./company.html";
  else goLogin();
}

// Ensures the current user has one of the allowed roles
// allowedRoles example: ["admin"]
export async function requireRole(allowedRoles = []) {
  const token = localStorage.getItem("access_token");
  if (!token) {
    goLogin();
    return;
  }

  try {
    // Fetch current user profile
    const { profile } = await apiFetch("/me");

    // If role not allowed, redirect appropriately
    if (!allowedRoles.includes(profile.role)) {
      redirectByRole(profile.role);
      return;
    }

    // Return profile for use in page scripts
    return profile;
  } catch (e) {
    goLogin();
  }
}
