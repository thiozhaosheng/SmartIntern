import { apiFetch } from "./api.js";

const loginIdEl = document.getElementById("loginId");
const passwordEl = document.getElementById("password");
const msgEl = document.getElementById("msg");
const btnLogin = document.getElementById("btnLogin");

function redirectByRole(role) {
  if (role === "admin") window.location.href = "./admin.html";
  else if (role === "student") window.location.href = "./student.html";
  else if (role === "company") window.location.href = "./company.html";
  else msgEl.textContent = `Unknown role: ${role}`;
}

btnLogin.addEventListener("click", async () => {
  msgEl.textContent = "";

  const loginId = loginIdEl.value.trim();
  const password = passwordEl.value;

  // Basic input validation before calling the API
  if (!loginId || !password) {
    msgEl.textContent = "Please enter Login ID and Password.";
    return;
  }

  try {
    // Login does not require an existing token
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: { loginId, password },
      auth: false,
    });

    // Persist session + profile info for subsequent authenticated requests
    localStorage.setItem("access_token", data.session.access_token);
    localStorage.setItem("role", data.profile.role);
    localStorage.setItem("login_id", data.profile.login_id);
    localStorage.setItem("full_name", data.profile.full_name || "");

    // Route user to the correct dashboard
    redirectByRole(data.profile.role);
  } catch (e) {
    msgEl.textContent = e.message || "Login failed";
  }
});
