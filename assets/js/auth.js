// ========================================
// BukSUPPLY Authentication Guard
// Session-based authentication
// ========================================

// ========================================
// CHECK LOGIN STATUS
// ========================================

function isLoggedIn() {
  const user = sessionStorage.getItem("user");
  const token = sessionStorage.getItem("token");

  return !!(user && token);
}

// ========================================
// PROTECTED PAGES
// Dashboard, Profile, Requests, etc.
// ========================================

const ROLE_HOME = {
  Student: "user-interface/dashboard.html",
  "Regular Staff": "staff-interface/dashboard.html",
  Moderator: "staff-interface/dashboard.html",
  Administrator: "admin-interface/dashboard.html",
};

function requireAuth(allowedRoles) {
  const check = () => {
    if (!isLoggedIn()) {
      window.location.replace("../index.html");
      return;
    }
    if (!allowedRoles) return;

    let role;
    try {
      role = JSON.parse(sessionStorage.getItem("user")).role;
    } catch {
      window.location.replace("../index.html");
      return;
    }

    if (!allowedRoles.includes(role)) {
      const home = ROLE_HOME[role];
      window.location.replace(home ? `../${home}` : "../index.html");
    }
  };

  check();
  window.addEventListener("pageshow", check); // covers Back/Forward and bfcache
  window.addEventListener("popstate", check);
}

// ========================================
// PUBLIC PAGES
// index.html, signin.html, signup.html
// ========================================

function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    redirectToDashboard();
    return;
  }

  // Important:
  // If browser restores this page from Back/Forward cache,
  // check authentication again.
  window.addEventListener("pageshow", function () {
    if (isLoggedIn()) {
      redirectToDashboard();
    }
  });
}

// ========================================
// REDIRECT TO DASHBOARD
// ========================================

function redirectToDashboard() {
  const user = sessionStorage.getItem("user");

  if (!user) {
    return;
  }

  let parsedUser;

  try {
    parsedUser = JSON.parse(user);
  } catch {
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");
    return;
  }

  const role = parsedUser.role;

  const ROLE_REDIRECTS = {
    Student: "user-interface/dashboard.html",
    "Regular Staff": "staff-interface/dashboard.html",
    Moderator: "staff-interface/dashboard.html",
    Administrator: "admin-interface/dashboard.html",
  };

  const destination = ROLE_REDIRECTS[role];

  if (!destination) {
    return;
  }

  // auth/*.html is one folder deeper than index.html
  const redirectPath = window.location.pathname.includes("/auth/")
    ? `../${destination}`
    : destination;

  window.location.replace(redirectPath);
}

// ========================================
// LOGOUT
// ========================================

function logout() {
  // Remove login session
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("token");

  // Go to public landing page
  window.location.replace("../index.html");
}
