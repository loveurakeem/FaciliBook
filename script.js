// ================================================================
//  script.js — Page Logic for School Facility Reservation System
//  Integrates with firebase.js (Firestore + Firebase Auth)
// ================================================================

import {
  loginUser,
  registerUser,
  logoutUser,
  requireAuth,
  submitReservation,
  getMyReservations,
  getAllReservations,
  updateReservationStatus,
  deleteReservation,
  getUserProfile,
  updateUserProfile,
  getFacilities,
  getReservationStats,
  showSuccess,
  showError
} from "./firebase.js";

// ================================================================
//  AUTH PAGES (login.html & register.html)
// ================================================================

async function handleLogin(event) {
  event.preventDefault();
  const email    = document.getElementById("uid").value.trim();
  const password = document.getElementById("pwd").value.trim();

  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }

  const btn = event.target.querySelector("button[type=submit]");
  btn.disabled    = true;
  btn.textContent = "Signing in…";

  await loginUser(email, password); // redirects on success

  btn.disabled    = false;
  btn.textContent = "Login";
}

async function handleRegister(event) {
  event.preventDefault();
  const fullName  = document.getElementById("regName").value.trim();
  const studentId = document.getElementById("regStudentId").value.trim();
  const email     = document.getElementById("regEmail").value.trim();
  const password  = document.getElementById("regPwd").value.trim();

  if (!fullName || !studentId || !email || !password) {
    showError("All fields are required.");
    return;
  }

  const btn = event.target.querySelector("button[type=submit]");
  btn.disabled    = true;
  btn.textContent = "Creating Account...";

  try {
    await registerUser(email, password, studentId, fullName);
  } catch (error) {
    showError(error.message);
    btn.disabled    = false;
    btn.textContent = "Register";
  }
}

// ================================================================
//  DASHBOARD PAGE (dashboard.html)
// ================================================================

async function initDashboard() {
  const user = await requireAuth();
  const profile = await getUserProfile(user.uid);

  // 1. Update Welcome Message
  const greet = document.getElementById("welcomeName");
  if (greet) {
    greet.textContent = profile?.fullName || user.email;
  }

  // 2. Show Admin Section and Link if user is admin
  const adminSection = document.getElementById("adminSection");
  const adminLink = document.getElementById("adminLink");
  
  if (profile?.role === "admin") {
    if (adminSection) adminSection.style.display = "block";
    if (adminLink) adminLink.style.display = "block";
  }

  // 3. Load User Reservations
  const reservations = await getMyReservations(user.uid);

  // 4. Populate Stats Cards
  const pendingCount  = document.getElementById("pendingCount");
  const approvedCount = document.getElementById("approvedCount");
  const pending  = reservations.filter(r => r.status === "pending").length;
  const approved = reservations.filter(r => r.status === "approved").length;
  
  if (pendingCount)  pendingCount.textContent  = pending;
  if (approvedCount) approvedCount.textContent = approved;

  // 5. Render Recent Table
  renderRecentTable(reservations.slice(0, 5));
}

function renderRecentTable(reservations) {
  const tbody = document.getElementById("recentTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (reservations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No reservations yet. <a href="reservation-form.html">Make your first one!</a></td></tr>`;
    return;
  }

  reservations.forEach(r => {
    tbody.innerHTML += `
      <tr>
        <td class="ps-4 fw-bold text-muted">#${r.id.slice(0,7).toUpperCase()}</td>
        <td class="fw-bold">${r.facility}</td>
        <td>${r.date}</td>
        <td>${r.timeSlot}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>`;
  });
}

// ================================================================
//  FACILITIES PAGE (facilities.html)
// ================================================================

async function initFacilities() {
  await requireAuth();
  const facilities = await getFacilities();
  renderFacilityCards(facilities);
}

function renderFacilityCards(facilities) {
  const grid = document.getElementById("facilityGrid");
  if (!grid) return;

  if (facilities.length === 0) {
    grid.innerHTML = `<div class="col-12 text-center text-muted py-5">No facilities found.</div>`;
    return;
  }

  grid.innerHTML = "";
  facilities.forEach(f => {
    const abbr = f.name.split(" ").map(w => w[0]).join("").slice(0, 4).toUpperCase();
    grid.innerHTML += `
      <div class="col-md-4">
        <div class="card border-0 shadow-sm rounded-4 overflow-hidden h-100">
          <div class="bg-primary text-white text-center py-4 d-flex align-items-center justify-content-center" style="height:100px;">
            <h4 class="fw-bold mb-0">${abbr}</h4>
          </div>
          <div class="card-body p-4">
            <h5 class="fw-bold">${f.name}</h5>
            <p class="text-muted small">${f.description}</p>
            <div class="d-flex justify-content-between align-items-center mb-3">
              <span class="badge bg-light text-dark border rounded-pill">Capacity: ${f.capacity}</span>
              ${f.available
                ? `<span class="text-success small fw-bold">● Available</span>`
                : `<span class="text-danger small fw-bold">● Occupied</span>`}
            </div>
            <button onclick="goToReserve('${f.name}')"
                    class="btn btn-primary w-100 btn-round"
                    ${f.available ? "" : "disabled"}>
              ${f.available ? "Reserve Now" : "Unavailable"}
            </button>
          </div>
        </div>
      </div>`;
  });
}

// ================================================================
//  RESERVATION FORM PAGE (reservation-form.html)
// ================================================================

async function initReservationForm() {
  const user    = await requireAuth();
  const profile = await getUserProfile(user.uid);

  const nameInput = document.getElementById("resName");
  if (nameInput && profile?.fullName) nameInput.value = profile.fullName;

  const facilities = await getFacilities();
  const sel = document.getElementById("facilitySelect");
  if (sel && facilities.length > 0) {
    sel.innerHTML = `<option value="">— Choose a facility —</option>`;
    facilities.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.name;
      opt.textContent = f.name + (f.available ? "" : " (Unavailable)");
      if (!f.available) opt.disabled = true;
      sel.appendChild(opt);
    });
  }

  const params = new URLSearchParams(window.location.search);
  const facilityParam = params.get("facility");
  if (facilityParam && sel) {
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === facilityParam) {
        sel.selectedIndex = i;
        break;
      }
    }
  }

  const dateInput = document.getElementById("resDate");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.min = today;
    dateInput.value = today;
  }

  window._currentUser = user;
  window._currentProfile = profile;
}

async function handleReservationSubmit(event) {
  event.preventDefault();
  const user = window._currentUser || await requireAuth();
  const profile = window._currentProfile || await getUserProfile(user.uid);

  const formData = {
    uid:       user.uid,
    studentId: profile?.studentId || "N/A",
    fullName:  document.getElementById("resName")?.value || profile?.fullName || user.email,
    facility:  document.getElementById("facilitySelect")?.value,
    date:      document.getElementById("resDate")?.value,
    timeSlot:  document.getElementById("resTime")?.value,
    purpose:   document.getElementById("resPurpose")?.value,
    attendees: document.getElementById("resAttendees")?.value || "",
    notes:     document.getElementById("resNotes")?.value || ""
  };

  const btn = event.target.querySelector("button[type=submit]");
  if (btn) { btn.disabled = true; btn.textContent = "Submitting…"; }

  try {
    await submitReservation(formData);
  } catch (error) {
    showError("Could not submit: " + error.message);
    if (btn) { btn.disabled = false; btn.textContent = "Submit Request"; }
  }
}

// ================================================================
//  MY RESERVATIONS PAGE (my-reservations.html)
// ================================================================

async function initMyReservations() {
  const user = await requireAuth();
  const reservations = await getMyReservations(user.uid);
  renderMyReservationsTable(reservations);
}

function renderMyReservationsTable(reservations) {
  const tbody = document.getElementById("myResTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (reservations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No reservations yet.</td></tr>`;
    return;
  }

  reservations.forEach(r => {
    tbody.innerHTML += `
      <tr>
        <td class="ps-4 fw-bold text-muted">#${r.id.slice(0,7).toUpperCase()}</td>
        <td class="fw-bold">${r.facility}</td>
        <td>${r.date}</td>
        <td>${r.timeSlot}</td>
        <td>${r.purpose}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>`;
  });
}

// ================================================================
//  ADMIN DASHBOARD PAGE (admin.html)
// ================================================================

async function initAdmin() {
  const user = await requireAuth();
  const profile = await getUserProfile(user.uid);

  if (profile?.role !== "admin") {
    alert("Access denied. Admin accounts only.");
    window.location.href = "dashboard.html";
    return;
  }

  const stats = await getReservationStats();
  if (document.getElementById("statTotal"))    document.getElementById("statTotal").textContent    = stats.total;
  if (document.getElementById("statApproved")) document.getElementById("statApproved").textContent = stats.approved;
  if (document.getElementById("statPending"))  document.getElementById("statPending").textContent  = stats.pending;
  if (document.getElementById("statRejected")) document.getElementById("statRejected").textContent = stats.rejected;

  const reservations = await getAllReservations();
  renderAdminTable(reservations);
}

function renderAdminTable(reservations) {
  const tbody = document.getElementById("adminTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  reservations.forEach(r => {
    tbody.innerHTML += `
      <tr id="row-${r.id}">
        <td class="ps-4 fw-bold text-muted">#${r.id.slice(0,7).toUpperCase()}</td>
        <td>${r.fullName || "—"}</td>
        <td>${r.facility}</td>
        <td>${r.date}</td>
        <td>${r.timeSlot}</td>
        <td>${r.purpose}</td>
        <td id="status-${r.id}">${statusBadge(r.status)}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-success btn-round px-3 me-1" onclick="adminApprove('${r.id}')">Approve</button>
          <button class="btn btn-sm btn-outline-danger btn-round px-3" onclick="adminReject('${r.id}')">Reject</button>
        </td>
      </tr>`;
  });
}

async function adminApprove(reservationId) {
  await updateReservationStatus(reservationId, "approved");
  const cell = document.getElementById(`status-${reservationId}`);
  if (cell) cell.innerHTML = statusBadge("approved");
}

async function adminReject(reservationId) {
  await updateReservationStatus(reservationId, "rejected");
  const cell = document.getElementById(`status-${reservationId}`);
  if (cell) cell.innerHTML = statusBadge("rejected");
}

// ================================================================
//  PROFILE PAGE (profile.html)
// ================================================================

async function initProfile() {
  const user = await requireAuth();
  const profile = await getUserProfile(user.uid);

  if (profile) {
    const el = id => document.getElementById(id);
    if (el("profileDisplayName")) el("profileDisplayName").textContent = profile.fullName;
    if (el("profileEmail"))       el("profileEmail").value = user.email;
    if (el("profileStudentId"))   el("profileStudentId").value = profile.studentId;
    if (el("profileCourse"))      el("profileCourse").value = profile.course || "";
    
    const parts = (profile.fullName || "").split(" ");
    if (el("profileFirstName")) el("profileFirstName").value = parts.slice(0, -1).join(" ");
    if (el("profileLastName"))  el("profileLastName").value = parts[parts.length - 1] || "";
  }
}

async function handleProfileUpdate(event) {
  event.preventDefault();
  const user = await requireAuth();
  const fName = document.getElementById("profileFirstName")?.value.trim();
  const lName = document.getElementById("profileLastName")?.value.trim();
  
  await updateUserProfile(user.uid, {
    fullName: `${fName} ${lName}`.trim(),
    course: document.getElementById("profileCourse")?.value.trim()
  });
  showSuccess("Profile updated!");
}

// ================================================================
//  SHARED UTILITIES
// ================================================================

function statusBadge(status) {
  const map = {
    pending:  "bg-warning bg-opacity-10 text-warning",
    approved: "bg-success bg-opacity-10 text-success",
    rejected: "bg-danger bg-opacity-10 text-danger"
  };
  const cls = map[status] || "bg-secondary bg-opacity-10 text-secondary";
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
  return `<span class="badge ${cls} rounded-pill px-3 py-2">● ${label}</span>`;
}

function goToReserve(facilityName) {
  window.location.href = `reservation-form.html?facility=${encodeURIComponent(facilityName)}`;
}

async function logout() {
  await logoutUser();
}

// ================================================================
//  AUTO-INIT
// ================================================================

const page = window.location.pathname.split("/").pop() || "index.html";

const pageInitMap = {
  "login.html":            () => document.getElementById("loginForm")?.addEventListener("submit", handleLogin),
  "register.html":         () => document.getElementById("registerForm")?.addEventListener("submit", handleRegister),
  "dashboard.html":        initDashboard,
  "facilities.html":       initFacilities,
  "reservation-form.html": () => {
    initReservationForm();
    document.getElementById("reservationForm")?.addEventListener("submit", handleReservationSubmit);
  },
  "my-reservations.html":  initMyReservations,
  "admin.html":            initAdmin,
  "profile.html":          () => {
    initProfile();
    document.getElementById("profileForm")?.addEventListener("submit", handleProfileUpdate);
  }
};

if (pageInitMap[page]) {
  document.addEventListener("DOMContentLoaded", pageInitMap[page]);
}

window.goToReserve  = goToReserve;
window.logout       = logout;
window.adminApprove = adminApprove;
window.adminReject  = adminReject;