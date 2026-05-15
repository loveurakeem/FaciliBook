// ================================================================
//  firebase.js — Firebase + Firestore Configuration
//  School Facility Reservation System
// ================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ── Firebase Project Config ──────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyA25zkOCNlpz4t2ub_BNb9CuVaXTakcnvY",
  authDomain: "facilibook-ad2df.firebaseapp.com",
  projectId: "facilibook-ad2df",
  storageBucket: "facilibook-ad2df.firebasestorage.app",
  messagingSenderId: "346321663344",
  appId: "1:346321663344:web:1caa0515e556a229000bb5",
  measurementId: "G-HYQRS9W940"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ================================================================
//  AUTHENTICATION
// ================================================================

async function loginUser(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
  } catch (error) {
    showError("Login failed: " + friendlyError(error.code));
  }
}

async function registerUser(email, password, studentId, fullName) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // --- PLUG THIS IN: Save profile to Firestore ---
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      fullName: fullName,
      studentId: studentId,
      email: email,
      role: "student", // Default role
      createdAt: serverTimestamp()
    });
    // -----------------------------------------------

    showSuccess("Account created successfully!");
    window.location.href = "dashboard.html";
  } catch (error) {
    showError("Registration failed: " + friendlyError(error.code));
    throw error;
  }
}

async function logoutUser() {
  await signOut(auth);
  window.location.href = "login.html";
}

function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "login.html";
      } else {
        resolve(user);
      }
    });
  });
}

// ================================================================
//  RESERVATIONS COLLECTION
// ================================================================

async function submitReservation(formData) {
  try {
    await addDoc(collection(db, "reservations"), {
      uid:       formData.uid,
      studentId: formData.studentId,
      fullName:  formData.fullName,
      facility:  formData.facility,
      date:      formData.date,
      timeSlot:  formData.timeSlot,
      attendees: formData.attendees || "",
      purpose:   formData.purpose,
      notes:     formData.notes    || "",
      status:    "pending",
      createdAt: serverTimestamp()
    });
    showSuccess("Reservation submitted! Awaiting admin approval.");
    setTimeout(() => window.location.href = "my-reservations.html", 1500);
  } catch (error) {
    showError("Could not submit reservation: " + error.message);
    throw error;
  }
}

async function getMyReservations(uid) {
  try {
    const q = query(
      collection(db, "reservations"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("getMyReservations error:", error);
    return [];
  }
}

async function getAllReservations() {
  try {
    const q = query(
      collection(db, "reservations"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("getAllReservations error:", error);
    return [];
  }
}

async function updateReservationStatus(reservationId, status) {
  try {
    await updateDoc(doc(db, "reservations", reservationId), { status });
    showSuccess(`Reservation ${status}!`);
  } catch (error) {
    showError("Update failed: " + error.message);
  }
}

async function deleteReservation(reservationId) {
  try {
    await deleteDoc(doc(db, "reservations", reservationId));
    showSuccess("Reservation deleted.");
  } catch (error) {
    showError("Delete failed: " + error.message);
  }
}

// ================================================================
//  USERS COLLECTION
// ================================================================

async function getUserProfile(uid) {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (!userDoc.exists()) return null;
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    console.error("getUserProfile error:", error);
    return null;
  }
}

async function updateUserProfile(uid, fields) {
  try {
    await updateDoc(doc(db, "users", uid), fields);
    showSuccess("Profile updated!");
  } catch (error) {
    showError("Update failed: " + error.message);
    throw error;
  }
}

// ================================================================
//  ADMIN UTILITIES
//  ► To make yourself admin, open the browser console on any page
//    while logged in and run:  makeAdmin()
//  ► To make another user admin by UID:  makeAdmin("their-uid-here")
// ================================================================

async function makeAdmin(targetUid) {
  try {
    const uid = targetUid || auth.currentUser?.uid;
    if (!uid) { showError("No user logged in."); return; }
    await updateDoc(doc(db, "users", uid), { role: "admin" });
    showSuccess("✅ Admin role granted! Reload the page.");
    console.log("✅ User", uid, "is now an admin. Reload to see changes.");
  } catch (error) {
    showError("makeAdmin failed: " + error.message);
    console.error(error);
  }
}

// Expose globally so it can be called from the browser console
window.makeAdmin = makeAdmin;

// ================================================================
//  FACILITIES COLLECTION
// ================================================================

async function getFacilities() {
  try {
    const snap = await getDocs(collection(db, "facilities"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("getFacilities error:", error);
    return [];
  }
}

async function seedFacilities() {
  const defaults = [
    { name: "Computer Laboratory",    capacity: 40,  description: "40 high-end workstations, high-speed internet.", available: true  },
    { name: "AVR Room",               capacity: 80,  description: "Projector, surround sound, and air conditioning.", available: true  },
    { name: "Gymnasium",              capacity: 500, description: "Multi-purpose gym for sports and large events.",  available: false },
    { name: "Library Discussion Room",capacity: 20,  description: "Quiet study room with whiteboards.",              available: true  },
    { name: "Classroom Room 201",     capacity: 45,  description: "Standard classroom for small group use.",          available: true  },
    { name: "School Auditorium",      capacity: 300, description: "Stage, lighting, and full sound system.",          available: true  }
  ];
  for (const f of defaults) {
    await addDoc(collection(db, "facilities"), f);
  }
  console.log("✅ Facilities seeded!");
  showSuccess("✅ Facilities seeded successfully!");
}

// Expose so it can be called from browser console: seedFacilities()
window.seedFacilities = seedFacilities;

async function getReservationStats() {
  const all      = await getAllReservations();
  const approved = all.filter(r => r.status === "approved").length;
  const pending  = all.filter(r => r.status === "pending").length;
  const rejected = all.filter(r => r.status === "rejected").length;
  return { total: all.length, approved, pending, rejected };
}

// ================================================================
//  UI HELPERS
// ================================================================

function showSuccess(msg) { _toast(msg, "success"); }
function showError(msg)   { _toast(msg, "danger");  }

function _toast(msg, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) { alert(msg); return; }
  const el = document.createElement("div");
  el.className = `toast align-items-center text-white bg-${type} border-0 show mb-2`;
  el.setAttribute("role", "alert");
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body fw-semibold">${msg}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto"
              onclick="this.closest('.toast').remove()"></button>
    </div>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function friendlyError(code) {
  const map = {
    "auth/invalid-email":        "Invalid email address.",
    "auth/user-not-found":       "No account found with that email.",
    "auth/wrong-password":       "Incorrect password.",
    "auth/invalid-credential":   "Incorrect email or password.",
    "auth/email-already-in-use": "That email is already registered.",
    "auth/weak-password":        "Password must be at least 6 characters."
  };
  return map[code] || code;
}

// ================================================================
//  EXPORTS
// ================================================================
export {
  auth, db,
  loginUser, registerUser, logoutUser, requireAuth,
  submitReservation, getMyReservations, getAllReservations,
  updateReservationStatus, deleteReservation,
  getUserProfile, updateUserProfile,
  getFacilities, seedFacilities,
  getReservationStats, makeAdmin,
  showSuccess, showError
};