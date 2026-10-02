const navSections = [
  {
    title: "Main Navigation",
    className: "main-nav",
    items: [
      { label: "Dashboard", icon: "bi-grid" },
      { label: "Requisition Management", icon: "bi-file-earmark-text" },
      { label: "Supply & Equipment Depot", icon: "bi-box-seam" },
      { label: "Issuance & Returns Desk", icon: "bi-arrow-left-right" },
    ],
  },
  {
    title: "Logistics & Administration",
    items: [
      { label: "Transaction History", icon: "bi-clock-history" },
      { label: "Stock Reports", icon: "bi-bar-chart" },
      { label: "User Management", icon: "bi-people" },
      { label: "Activity & Audit Logs", icon: "bi-journal-text" },
    ],
  },
];

const currentUser = {
  name: "James Abobo", 
  role: "Moderator Account",
  userPicture: "https://lh3.googleusercontent.com/a/default-user" 

function renderNav() {
  return navSections
    .map(
      (section) => `
      <h3 class="nav-title ${section.className || ""}">${section.title}</h3>
      <ul class="nav-group">
        ${section.items
          .map(
            (item, i) => `
          <li>
            <button class="nav-item${item.label === "Dashboard" ? " active" : ""}"
                    title="${item.label}" data-label="${item.label}">
              <i class="bi ${item.icon}"></i>
              <span class="nav-label">${item.label}</span>
            </button>
          </li>`
          )
          .join("")}
      </ul>`
    )
    .join("");
}

function renderApp() {
  document.getElementById("app").innerHTML = `
    <div class="layout" id="layout">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-top">
          <div class="brand">
            <a href="dashboard.html" class="logo">
              <img src="../assets/img/buksupply-sidebar-logo.png" alt="BukSUPPLY" class="logo-img" />
            </a>  
            <img src="../assets/img/brand-text-img.png" alt="BukSUPPLY Brand" class="brand-img" />
            <!-- <span class="brand-text">Buk<strong>SUPPLY</strong></span> -->
          </div>
          <nav class="nav">${renderNav()}</nav>
        </div>

        <!-- Sidebar Bottom User Profile Card -->
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
          <button class="menu-btn" id="menuBtn" aria-label="Toggle sidebar" aria-expanded="true">
            <i class="bi bi-list"></i>
          </button>

          <div class="topbar-right">
          <!--
            <label class="search">
              <i class="bi bi-search"></i>
              <input type="search" placeholder="Search anything" />
            </label>
          -->
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

  menuBtn.addEventListener("click", () => {
    const collapsed = layout.classList.toggle("collapsed");
    menuBtn.setAttribute("aria-expanded", String(!collapsed));
  });

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  if (window.matchMedia("(max-width: 768px)").matches) {
    layout.classList.add("collapsed");
    menuBtn.setAttribute("aria-expanded", "false");
  }
}

renderApp();
setupEvents();