import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import usePage from "../hooks/usePage";
import menuCss from "../styles/menu.css?raw";

const DEFAULT_AVATAR = "https://lh3.googleusercontent.com/a/default-user";

// Navigation configuration for Regular Users (Student / Regular Staff)
const userNavSections = [
  {
    title: "Main Navigation",
    className: "main-nav",
    items: [
      { label: "Dashboard", icon: "bi-grid", to: "/user" },
      { label: "Item Request", icon: "bi-file-earmark-plus", to: "/user/requests" },
      { label: "My Requests", icon: "bi-clock-history", to: "/user/history" },
      { label: "Notifications", icon: "bi-bell", to: "/user/notifications" },
    ],
  },
  {
    title: "Account & Support",
    items: [
      { label: "Profile", icon: "bi-person-gear", to: "/user/profile" },
      { label: "Help & Support", icon: "bi-question-circle", to: "/user/help" },
    ],
  },
];

// Navigation configuration for Moderators (Staff)
const moderatorNavSections = [
  {
    title: "Main Navigation",
    className: "main-nav",
    items: [
      { label: "Dashboard", icon: "bi-grid", to: "/staff" },
      { label: "Requisition Management", icon: "bi-file-earmark-text", to: "/staff/requisitions" },
      { label: "Supply & Equipment Depot", icon: "bi-box-seam", to: "/staff/supply-depot" },
      { label: "Issuance & Returns Desk", icon: "bi-arrow-left-right", to: "/staff/issuance-returns" },
      { label: "Notifications", icon: "bi-bell", to: "/staff/notifications" },
    ],
  },
  {
    title: "Logistics & Administration",
    items: [
      { label: "Transaction History", icon: "bi-clock-history", to: "/staff/history" },
      { label: "Stock Reports", icon: "bi-bar-chart", to: "/staff/reports" },
      { label: "User Management", icon: "bi-people", to: "/staff/users" },
      { label: "Activity & Audit Logs", icon: "bi-journal-text", to: "/staff/logs" },
    ],
  },
];

// Navigation configuration for Administrators
const adminNavSections = [
  {
    title: "Main Navigation",
    className: "main-nav",
    items: [
      { label: "Dashboard", icon: "bi-grid", to: "/admin" },
      { label: "Requisition Management", icon: "bi-file-earmark-text", to: "/admin/requisitions" },
      { label: "Supply & Equipment Depot", icon: "bi-box-seam", to: "/admin/supply-depot" },
      { label: "Issuance & Returns Desk", icon: "bi-arrow-left-right", to: "/admin/issuance-returns" },
      { label: "Notifications", icon: "bi-bell", to: "/admin/notifications" },
    ],
  },
  {
    title: "Logistics & Administration",
    items: [
      { label: "Transaction History", icon: "bi-clock-history", to: "/admin/history" },
      { label: "Stock Reports", icon: "bi-bar-chart", to: "/admin/reports" },
      { label: "User Management", icon: "bi-people", to: "/admin/users" },
      { label: "Activity & Audit Logs", icon: "bi-journal-text", to: "/admin/logs" },
    ],
  },
];

// Role -> nav sections + base path
const roleConfig = {
  Administrator: { sections: adminNavSections, base: "/admin" },
  Moderator: { sections: moderatorNavSections, base: "/staff" },
};
const defaultConfig = { sections: userNavSections, base: "/user" };

// Friendly labels for the sidebar footer
const roleLabels = {
  Administrator: "Administrator Account",
};

export default function UserLayout() {
  usePage(menuCss);

  const { user } = useAuth();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  // Select navigation set based on role
  const { sections: navSections, base } = roleConfig[user?.role] || defaultConfig;

  // Backend sends firstName / lastName (no `name` field)
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.name ||
    "User";
  const displayRole = roleLabels[user?.role] || user?.role || "Member";
  const avatarSrc = user?.avatar || DEFAULT_AVATAR;

  const handleAvatarError = (e) => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = DEFAULT_AVATAR;
  };

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <div className={`layout ${collapsed ? "collapsed" : ""}`} id="layout">
      {/* SIDEBAR */}
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-top">
          {/* BRAND */}
          <div className="brand">
            <NavLink to={base} className="logo">
              <img
                src="/img/buksupply-sidebar-logo.png"
                alt="BukSUPPLY"
                className="logo-img"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </NavLink>
            <img
              src="/img/brand-text-img.png"
              alt="BukSUPPLY Brand"
              className="brand-img"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </div>

          {/* NAVIGATION */}
          <nav className="nav">
            {navSections.map((section, idx) => (
              <React.Fragment key={idx}>
                <h3 className={`nav-title ${section.className || ""}`}>
                  {section.title}
                </h3>
                <ul className="nav-group">
                  {section.items.map((item, itemIdx) => (
                    <li key={itemIdx}>
                      <NavLink
                        to={item.to}
                        end={item.to === base}
                        className={({ isActive }) =>
                          `nav-item${isActive ? " active" : ""}`
                        }
                        title={item.label}
                      >
                        <i className={`bi ${item.icon}`}></i>
                        <span className="nav-label">{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="sidebar-footer">
          <hr className="sidebar-divider" />
          <div className="user-profile">
            <img
              src={avatarSrc}
              alt={displayName}
              className="user-avatar"
              onError={handleAvatarError}
            />
            <div className="user-info">
              <span className="user-name">{displayName}</span>
              <span className="user-role">{displayRole}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="main">
        <header className="topbar">
          <button
            className="menu-btn"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            aria-expanded={!collapsed}
          >
            <i className="bi bi-list"></i>
          </button>

          <div className="topbar-right">
            <button
              className="icon-btn bell"
              aria-label="Notifications"
              onClick={() => navigate(`${base}/notifications`)}
            >
              <i className="bi bi-bell"></i>
            </button>

            <button
              className="avatar"
              aria-label="User profile"
              onClick={() => navigate(`${base}/profile`)}
            >
              <img src={avatarSrc} alt={displayName} onError={handleAvatarError} />
            </button>
          </div>
        </header>

        <main className="content" id="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}