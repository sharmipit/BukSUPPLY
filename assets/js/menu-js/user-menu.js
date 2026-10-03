const navSections = [
  {
    title: "Main Navigation",
    className: "main-nav",
    items: [
      {
        label: "Dashboard",
        icon: "bi-grid",
        url: "/user-interface/dashboard.html",
      },
      {
        label: "Item Request",
        icon: "bi-file-earmark-text",
        url: "/user-interface/item-request.html",
      },
      {
        label: "Notifications",
        icon: "bi bi-bell",
        url: "/user-interface/notifications.html",
      },
    ],
  },
  {
    title: "Account & Support",
    items: [
      {
        label: "Profile",
        icon: "bi-person-gear",
        url: "/user-interface/profile.html",
      },
      {
        label: "Help & Support",
        icon: "bi-question-circle",
        url: "/user-interface/help-support.html",
      },
      {
        label: "Logout",
        icon: "bi-box-arrow-right",
        url: "../index.html",
        id: "logout-btn",
      },
    ],
  },
];

const currentUser = {
  name: "James Abobo",
  role: "Faculty Account",
  userPicture: "https://lh3.googleusercontent.com/a/default-user",
};

function renderNav() {
  const currentPath = window.location.pathname;

  return navSections
    .map(
      (section) => `
      <h3 class="nav-title ${section.className || ""}">${section.title}</h3>
      <ul class="nav-group">
        ${section.items
          .map((item) => {
            const isActive =
              currentPath.includes(item.url) ||
              (item.label === "Dashboard" && currentPath.endsWith("/"));
            return `
          <li>
            <a href="${item.url}" ${item.id ? `id="${item.id}"` : ""} class="nav-item${isActive ? " active" : ""}" title="${item.label}">
              <i class="bi ${item.icon}"></i>
              <span class="nav-label">${item.label}</span>
            </a>
          </li>`;
          })
          .join("")}
      </ul>`,
    )
    .join("");
}

function showLogoutModal() {
  if (document.getElementById("logout-modal")) return;

  // Same look as the sign-up modal, injected once
  if (!document.getElementById("logout-modal-style")) {
    const style = document.createElement("style");
    style.id = "logout-modal-style";
    style.textContent = `
      .lo-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background-color: rgba(44, 26, 20, 0.6);
        backdrop-filter: blur(4px);
        display: flex; justify-content: center; align-items: center;
        z-index: 99999; padding: 20px;
        opacity: 0; visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
        font-family: 'Poppins', sans-serif;
      }
      .lo-overlay.active { opacity: 1; visibility: visible; }
      .lo-card {
        background-color: #FFFFFF; border-radius: 28px;
        max-width: 460px; width: 100%; padding: 35px 30px;
        text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        transform: translateY(20px); transition: transform 0.3s ease;
      }
      .lo-overlay.active .lo-card { transform: translateY(0); }
      .lo-icon {
        width: 64px; height: 64px; background-color: #F5EFE6;
        color: #8C5839; border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 2rem; margin-bottom: 18px;
      }
      .lo-title {
        font-size: 1.35rem; font-weight: 700; color: #2C1A14;
        margin: 0 0 8px;
      }
      .lo-desc {
        font-size: 0.88rem; color: #594D46;
        margin: 0 0 24px; line-height: 1.6;
      }
      .lo-actions { display: flex; gap: 12px; }
      .lo-btn {
        flex: 1; border-radius: 50px; padding: 13px 20px;
        font-size: 0.95rem; font-weight: 600; cursor: pointer;
        font-family: inherit;
        transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
      }
      .lo-btn:active { transform: scale(0.98); }
      .lo-cancel {
        background-color: #FFFFFF; color: #2C1A14;
        border: 1.5px solid #8C5839;
      }
      .lo-cancel:hover { background-color: #F5EFE6; border-color: #2C1A14; }
      .lo-confirm {
        background-color: #2C1A14; color: #FFFFFF; border: none;
        box-shadow: 0px 4px 10px rgba(44, 26, 20, 0.12);
      }
      .lo-confirm:hover { background-color: #1A0E0A; }
    `;
    document.head.appendChild(style);
  }

  // Build the modal
  const modal = document.createElement("div");
  modal.id = "logout-modal";
  modal.className = "lo-overlay";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="lo-card">
      <div class="lo-icon"><i class="bi bi-box-arrow-right"></i></div>
      <h2 class="lo-title">Log out?</h2>
      <p class="modal-description lo-desc">
        Are you sure you want to log out of <strong>BukSUPPLY</strong>?
        You will need to sign in again to access your dashboard.
      </p>
      <div class="lo-actions">
        <button type="button" class="lo-btn lo-cancel" id="logout-cancel-btn">Cancel</button>
        <button type="button" class="lo-btn lo-confirm" id="logout-confirm-btn">Logout</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Fade in (next frame so the transition runs)
  requestAnimationFrame(() => modal.classList.add("active"));

  // Close the modal (with fade out)
  const closeModal = () => {
    modal.classList.remove("active");
    setTimeout(() => modal.remove(), 300);
    document.removeEventListener("keydown", onKey);
  };

  // Restore the session that your handler already cleared
  const restoreSession = () => {
    const backup = window.__logoutBackup;
    if (!backup) return;
    backup.local.forEach(([k, v]) => localStorage.setItem(k, v));
    backup.session.forEach(([k, v]) => sessionStorage.setItem(k, v));
    window.__logoutBackup = null;
  };

  // Cancel = restore session + close
  const cancelLogout = () => {
    restoreSession();
    closeModal();
  };

  // Esc key = cancel
  const onKey = (e) => {
    if (e.key === "Escape") cancelLogout();
  };
  document.addEventListener("keydown", onKey);

  // Cancel button
  document
    .getElementById("logout-cancel-btn")
    .addEventListener("click", cancelLogout);

  // Backdrop click = cancel
  modal.addEventListener("click", (e) => {
    if (e.target === modal) cancelLogout();
  });

  // Logout button: storage is already cleared by your handler, so just leave
  document
    .getElementById("logout-confirm-btn")
    .addEventListener("click", () => {
      window.__logoutBackup = null;
      window.location.replace("../index.html");
    });
}

function renderApp() {
  const isCollapsedSaved = localStorage.getItem("sidebar-collapsed") === "true";
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const initialCollapsed = isCollapsedSaved || isMobile;

  document.getElementById("app").innerHTML = `
    <div class="layout ${initialCollapsed ? "collapsed" : ""}" id="layout">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-top">
          <div class="brand">
            <a href="/user-interface/dashboard.html" class="logo">
              <img src="../assets/img/buksupply-sidebar-logo.png" alt="BukSUPPLY" class="logo-img" onerror="this.style.display='none'" />
            </a>  
            <img src="../assets/img/brand-text-img.png" alt="BukSUPPLY Brand" class="brand-img" onerror="this.style.display='none'" />
          </div>
          <nav class="nav">${renderNav()}</nav>
        </div>

        <div class="sidebar-footer">
          <hr class="sidebar-divider" />
          <div class="user-profile">
            <img src="${currentUser.userPicture}" alt="${currentUser.name}" class="user-avatar" onerror="this.onerror=null; this.src='https://lh3.googleusercontent.com/a/default-user';" />
            <div class="user-info">
              <span class="user-name">${currentUser.name}</span>
              <span class="user-role">${currentUser.role}</span>
            </div>
          </div>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button class="menu-btn" id="menuBtn" aria-label="Toggle sidebar" aria-expanded="${!initialCollapsed}">
            <i class="bi bi-list"></i>
          </button>

          <div class="topbar-right">
            <button class="icon-btn bell" aria-label="Notifications">
              <i class="bi bi-bell"></i>
            </button>
            <button class="avatar" aria-label="${currentUser.name}">
              <img src="${currentUser.userPicture}" alt="${currentUser.name}" onerror="this.onerror=null; this.src='https://lh3.googleusercontent.com/a/default-user';" />
            </button>
          </div>
        </header>

        <main class="content" id="content"></main>
      </div>
    </div>
  `;
}

function setupEvents() {
  const layout = document.getElementById("layout");
  const menuBtn = document.getElementById("menuBtn");
  const logoutBtn = document.getElementById("logout-btn");

  menuBtn.addEventListener("click", () => {
    const collapsed = layout.classList.toggle("collapsed");
    menuBtn.setAttribute("aria-expanded", String(!collapsed));
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  });

  if (logoutBtn) {
    // Backup only, runs before your handler clears the storage
    logoutBtn.addEventListener("click", () => {
      window.__logoutBackup = {
        local: Object.entries(localStorage),
        session: Object.entries(sessionStorage),
      };
    });
  }

  // ↓ your existing handler, untouched
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.clear();
      sessionStorage.clear();
      showLogoutModal();
    });
  }
}

renderApp();
setupEvents();
