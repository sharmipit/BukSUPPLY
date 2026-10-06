const navSections = [
  {
    title: "Main Navigation",
    className: "main-nav",
    items: [
      {
        label: "Dashboard",
        icon: "bi-grid",
        url: "/staff-interface/dashboard.html",
      },
      {
        label: "Requisition Management",
        icon: "bi-file-earmark-text",
        url: "/staff-interface/requisition-management.html",
      },
      {
        label: "Supply & Equipment Depot",
        icon: "bi-box-seam",
        url: "/staff-interface/supply-depot.html",
      },
      {
        label: "Issuance & Returns Desk",
        icon: "bi-arrow-left-right",
        url: "/staff-interface/issuance-returns.html",
      },
      {
        label: "Notifications",
        icon: "bi bi-bell",
        url: "/staff-interface/notifications.html",
      },
    ],
  },
  {
    title: "Logistics & Administration",
    items: [
      {
        label: "Transaction History",
        icon: "bi-clock-history",
        url: "/staff-interface/transaction-history.html",
      },
      {
        label: "Stock Reports",
        icon: "bi-bar-chart",
        url: "/staff-interface/stock-reports.html",
      },
      {
        label: "User Management",
        icon: "bi-people",
        url: "/staff-interface/user-management.html",
      },
      {
        label: "Activity & Audit Logs",
        icon: "bi-journal-text",
        url: "/staff-interface/activity-audit-logs.html",
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

// ========================================
// CURRENT USER
// ========================================

const currentUser = {
  name: "James Abobo",
  role: "Moderator Account",
  userPicture: "https://lh3.googleusercontent.com/a/default-user",
};

// ========================================
// RENDER NAVIGATION
// ========================================

function renderNav() {
  const currentPath = window.location.pathname;

  return navSections
    .map(
      (section) => `
        <h3 class="nav-title ${section.className || ""}">
          ${section.title}
        </h3>

        <ul class="nav-group">
          ${section.items
            .map((item) => {
              const isActive =
                currentPath.includes(item.url) ||
                (item.label === "Dashboard" && currentPath.endsWith("/"));

              return `
                <li>
                  <a
                    href="${item.url}"
                    ${item.id ? `id="${item.id}"` : ""}
                    class="nav-item${isActive ? " active" : ""}"
                    title="${item.label}"
                  >
                    <i class="bi ${item.icon}"></i>
                    <span class="nav-label">
                      ${item.label}
                    </span>
                  </a>
                </li>
              `;
            })
            .join("")}
        </ul>
      `,
    )
    .join("");
}

// ========================================
// LOGOUT MODAL
// ========================================

function showLogoutModal() {
  // Prevent duplicate modal
  if (document.getElementById("logout-modal")) {
    return;
  }

  // ========================================
  // MODAL CSS
  // ========================================

  if (!document.getElementById("logout-modal-style")) {
    const style = document.createElement("style");

    style.id = "logout-modal-style";

    style.textContent = `
      .lo-overlay {
        position: fixed;
        top: 0;
        left: 0;

        width: 100vw;
        height: 100vh;

        background-color: rgba(44, 26, 20, 0.6);
        backdrop-filter: blur(4px);

        display: flex;
        justify-content: center;
        align-items: center;

        z-index: 99999;

        padding: 20px;

        opacity: 0;
        visibility: hidden;

        transition:
          opacity 0.3s ease,
          visibility 0.3s ease;

        font-family: "Poppins", sans-serif;
      }


      .lo-overlay.active {
        opacity: 1;
        visibility: visible;
      }


      .lo-card {
        background-color: #ffffff;

        border-radius: 28px;

        max-width: 460px;
        width: 100%;

        padding: 35px 30px;

        text-align: center;

        box-shadow:
          0 20px 40px rgba(0, 0, 0, 0.2);

        transform: translateY(20px);

        transition:
          transform 0.3s ease;
      }


      .lo-overlay.active .lo-card {
        transform: translateY(0);
      }


      .lo-icon {
        width: 64px;
        height: 64px;

        background-color: #f5efe6;
        color: #8c5839;

        border-radius: 50%;

        display: inline-flex;

        align-items: center;
        justify-content: center;

        font-size: 2rem;

        margin-bottom: 18px;
      }


      .lo-title {
        font-size: 1.35rem;

        font-weight: 700;

        color: #2c1a14;

        margin: 0 0 8px;
      }


      .lo-desc {
        font-size: 0.88rem;

        color: #594d46;

        margin: 0 0 24px;

        line-height: 1.6;
      }


      .lo-actions {
        display: flex;

        gap: 12px;
      }


      .lo-btn {
        flex: 1;

        border-radius: 50px;

        padding: 13px 20px;

        font-size: 0.95rem;

        font-weight: 600;

        cursor: pointer;

        font-family: inherit;

        transition:
          background-color 0.2s ease,
          border-color 0.2s ease,
          transform 0.1s ease;
      }


      .lo-btn:active {
        transform: scale(0.98);
      }


      .lo-cancel {
        background-color: #ffffff;

        color: #2c1a14;

        border: 1.5px solid #8c5839;
      }


      .lo-cancel:hover {
        background-color: #f5efe6;

        border-color: #2c1a14;
      }


      .lo-confirm {
        background-color: #2c1a14;

        color: #ffffff;

        border: none;

        box-shadow:
          0 4px 10px rgba(44, 26, 20, 0.12);
      }


      .lo-confirm:hover {
        background-color: #1a0e0a;
      }


      @media (max-width: 480px) {

        .lo-card {
          padding: 30px 22px;
        }

        .lo-actions {
          flex-direction: column;
        }

        .lo-btn {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ========================================
  // CREATE MODAL
  // ========================================

  const modal = document.createElement("div");

  modal.id = "logout-modal";

  modal.className = "lo-overlay";

  modal.setAttribute("role", "dialog");

  modal.setAttribute("aria-modal", "true");

  modal.setAttribute("aria-labelledby", "logout-modal-title");

  modal.innerHTML = `
    <div class="lo-card">

      <div class="lo-icon">
        <i class="bi bi-box-arrow-right"></i>
      </div>

      <h2
        class="lo-title"
        id="logout-modal-title"
      >
        Log out?
      </h2>

      <p class="modal-description lo-desc">
        Are you sure you want to log out of
        <strong>BukSUPPLY</strong>?
        You will need to sign in again to access
        your dashboard.
      </p>

      <div class="lo-actions">

        <button
          type="button"
          class="lo-btn lo-cancel"
          id="logout-cancel-btn"
        >
          Cancel
        </button>

        <button
          type="button"
          class="lo-btn lo-confirm"
          id="logout-confirm-btn"
        >
          Logout
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(modal);

  // ========================================
  // SHOW MODAL
  // ========================================

  requestAnimationFrame(() => {
    modal.classList.add("active");
  });

  // ========================================
  // CLOSE MODAL
  // ========================================

  const closeModal = () => {
    modal.classList.remove("active");

    setTimeout(() => {
      modal.remove();
    }, 300);

    document.removeEventListener("keydown", handleKeydown);
  };

  // ========================================
  // CANCEL LOGOUT
  // ========================================

  const cancelLogout = () => {
    closeModal();
  };

  // ========================================
  // ESC KEY
  // ========================================

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      cancelLogout();
    }
  };

  document.addEventListener("keydown", handleKeydown);

  // ========================================
  // CANCEL BUTTON
  // ========================================

  document
    .getElementById("logout-cancel-btn")
    .addEventListener("click", cancelLogout);

  // ========================================
  // CLICK OUTSIDE MODAL
  // ========================================

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      cancelLogout();
    }
  });

  // ========================================
  // CONFIRM LOGOUT
  // ========================================

  document
    .getElementById("logout-confirm-btn")
    .addEventListener("click", () => {
      // Remove authentication data
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("token");

      // Redirect to landing page
      window.location.replace("../index.html");
    });
}

// ========================================
// RENDER APP
// ========================================

function renderApp() {
  const isCollapsedSaved = localStorage.getItem("sidebar-collapsed") === "true";

  const isMobile = window.matchMedia("(max-width: 768px)").matches;

  const initialCollapsed = isCollapsedSaved || isMobile;

  document.getElementById("app").innerHTML = `

    <div
      class="layout ${initialCollapsed ? "collapsed" : ""}"
      id="layout"
    >

      <!-- SIDEBAR -->
      <aside
        class="sidebar"
        id="sidebar"
      >

        <div class="sidebar-top">

          <!-- BRAND -->
          <div class="brand">

            <a
              href="/staff-interface/dashboard.html"
              class="logo"
            >

              <img
                src="../assets/img/buksupply-sidebar-logo.png"
                alt="BukSUPPLY"
                class="logo-img"
                onerror="this.style.display='none'"
              />

            </a>

            <img
              src="../assets/img/brand-text-img.png"
              alt="BukSUPPLY Brand"
              class="brand-img"
              onerror="this.style.display='none'"
            />

          </div>


          <!-- NAVIGATION -->
          <nav class="nav">
            ${renderNav()}
          </nav>

        </div>


        <!-- SIDEBAR FOOTER -->
        <div class="sidebar-footer">

          <hr class="sidebar-divider" />

          <div class="user-profile">

            <img
              src="${currentUser.userPicture}"
              alt="${currentUser.name}"
              class="user-avatar"

              onerror="
                this.onerror=null;
                this.src='https://lh3.googleusercontent.com/a/default-user';
              "
            />

            <div class="user-info">

              <span class="user-name">
                ${currentUser.name}
              </span>

              <span class="user-role">
                ${currentUser.role}
              </span>

            </div>

          </div>

        </div>

      </aside>


      <!-- MAIN -->
      <div class="main">

        <!-- TOPBAR -->
        <header class="topbar">

          <button
            class="menu-btn"
            id="menuBtn"
            aria-label="Toggle sidebar"
            aria-expanded="${!initialCollapsed}"
          >

            <i class="bi bi-list"></i>

          </button>


          <div class="topbar-right">

            <button
              class="icon-btn bell"
              aria-label="Notifications"
            >

              <i class="bi bi-bell"></i>

            </button>


            <button
              class="avatar"
              aria-label="${currentUser.name}"
            >

              <img
                src="${currentUser.userPicture}"
                alt="${currentUser.name}"

                onerror="
                  this.onerror=null;
                  this.src='https://lh3.googleusercontent.com/a/default-user';
                "
              />

            </button>

          </div>

        </header>


        <!-- CONTENT -->
        <main
          class="content"
          id="content"
        ></main>

      </div>

    </div>
  `;
}

// ========================================
// SETUP EVENTS
// ========================================

function setupEvents() {
  const layout = document.getElementById("layout");

  const menuBtn = document.getElementById("menuBtn");

  const logoutBtn = document.getElementById("logout-btn");

  // ========================================
  // SIDEBAR TOGGLE
  // ========================================

  menuBtn.addEventListener("click", () => {
    const collapsed = layout.classList.toggle("collapsed");

    menuBtn.setAttribute("aria-expanded", String(!collapsed));

    localStorage.setItem("sidebar-collapsed", String(collapsed));
  });

  // ========================================
  // LOGOUT
  // ========================================

  if (logoutBtn) {
    logoutBtn.addEventListener("click", (event) => {
      // Prevent the <a> from
      // immediately redirecting.
      event.preventDefault();

      // Show confirmation modal.
      showLogoutModal();
    });
  }

  // ========================================
  // MOBILE SIDEBAR
  // ========================================

  if (window.matchMedia("(max-width: 768px)").matches) {
    layout.classList.add("collapsed");

    menuBtn.setAttribute("aria-expanded", "false");
  }
}

// ========================================
// INITIALIZE
// ========================================

renderApp();
setupEvents();
