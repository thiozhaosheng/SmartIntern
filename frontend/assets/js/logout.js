// Attach logout behaviour to #btnLogout if it exists
export function wireLogout() {
  const btn = document.getElementById("btnLogout");
  if (!btn) return;

  btn.addEventListener("click", () => {
    // Clear session and return to login page
    localStorage.clear();
    window.location.href = "./index.html";
  });
}
