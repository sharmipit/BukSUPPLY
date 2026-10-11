import React, { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import usePage from "../hooks/usePage";
import menuCss from "../styles/menu.css?raw";
import LogoutModal from "../components/LogoutModal"; // adjust path if needed

const DEFAULT_AVATAR = "https://lh3.googleusercontent.com/a/default-user";

// Navigation configuration for Regular Users (Student / Regular Staff)
const userNavSections = [
  {
    title: "Main Navigation",
    className: "main-nav",
    items: [
      { label: "Dashboard", icon: "bi-grid", to: "/user" },
      {
        label: "Item Request",
        icon: "bi-file-earmark-plus",
        to: "/user/requests",
      },
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
      {
        label: "Requisition Management",
        icon: "bi-file-earmark-text",
        to: "/staff/requisitions",
      },
      {
        label: "Supply & Equipment Depot",
        icon: "bi-box-seam",
        to: "/staff/supply-depot",
      },
      {
        label: "Issuance & Returns Desk",
        icon: "bi-arrow-left-right",
        to: "/staff/issuance-returns",
      },
      { label: "Notifications", icon: "bi-bell", to: "/staff/notifications" },
    ],
  },
  {
    title: "Logistics & Administration",
    items: [
      {
        label: "Transaction History",
        icon: "bi-clock-history",
        to: "/staff/history",
      },
      { label: "Stock Reports", icon: "bi-bar-chart", to: "/staff/reports" },
      { label: "User Management", icon: "bi-people", to: "/staff/users" },
      {
        label: "Activity & Audit Logs",
        icon: "bi-journal-text",
        to: "/staff/logs",
      },
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
      {
        label: "Requisition Management",
        icon: "bi-file-earmark-text",
        to: "/admin/requisitions",
      },
      {
        label: "Supply & Equipment Depot",
        icon: "bi-box-seam",
        to: "/admin/supply-depot",
      },
      {
        label: "Issuance & Returns Desk",
        icon: "bi-arrow-left-right",
        to: "/admin/issuance-returns",
      },
      { label: "Notifications", icon: "bi-bell", to: "/admin/notifications" },
    ],
  },
  {
    title: "Logistics & Administration",
    items: [
      {
        label: "Transaction History",
        icon: "bi-clock-history",
        to: "/admin/history",
      },
      { label: "Stock Reports", icon: "bi-bar-chart", to: "/admin/reports" },
      { label: "User Management", icon: "bi-people", to: "/admin/users" },
      {
        label: "Activity & Audit Logs",
        icon: "bi-journal-text",
        to: "/admin/logs",
      },
    ],
  },
];

// Role -> nav sections + base path
const roleConfig = {
  Administrator: { sections: adminNavSections, base: "/admin" },
  Moderator: { sections: moderatorNavSections, base: "/staff" },
};
const defaultConfig = { sections: userNavSections, base: "/user" };

// Friendly labels shown under the name (lowercase keys; lookup ignores case)
const roleLabels = {
  administrator: "Administrator Account",
  moderator: "Moderator Account",
  student: "Student Account",
};

/**
 * Dropdown shown when clicking a profile trigger.
 * Uses position: fixed so it is never clipped by the sidebar's overflow.
 * direction: "up" (opens above the trigger) | "down" (opens below it)
 */
function ProfileMenu({
  trigger,
  base,
  direction = "down",
  onLogout,
  name,
  roleLabel,
  avatar,
  onAvatarError,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({});
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  const toggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setPos(
        direction === "up"
          ? { bottom: window.innerHeight - r.top + 8, left: r.left }
          : { top: r.bottom + 8, right: window.innerWidth - r.right },
      );
    }
    setOpen((o) => !o);
  };

  // Close on outside click, Escape, resize, or scroll
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close();
    };
    const onKey = (e) => e.key === "Escape" && close();

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <div className="profile-menu-wrap" ref={wrapRef}>
      {trigger({ open, toggle })}

      {open && (
        <div className="profile-menu" style={pos} role="menu">
          {/* Account header (same as the institutional account) */}
          <div className="profile-menu-header">
            <img
              src={avatar}
              alt={name}
              className="profile-menu-avatar"
              onError={onAvatarError}
            />
            <div className="profile-menu-info">
              <span className="profile-menu-name">{name}</span>
              <span className="profile-menu-role">{roleLabel}</span>
            </div>
          </div>

          <hr className="profile-menu-divider" />

          <button
            type="button"
            role="menuitem"
            className="profile-menu-btn edit"
            onClick={() => {
              setOpen(false);
              navigate(`${base}/profile`);
            }}
          >
            Edit Profile
          </button>

          <button
            type="button"
            role="menuitem"
            className="profile-menu-btn logout"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default function UserLayout() {
  usePage(menuCss);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Top bar is transparent only on the Profile page (/user/profile, /staff/profile, /admin/profile)
  const isProfilePage = /\/profile\/?$/.test(pathname);

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });
  const [logoutOpen, setLogoutOpen] = useState(false);

  // Select navigation set based on role
  const { sections: navSections, base } =
    roleConfig[user?.role] || defaultConfig;

  // Backend sends firstName / lastName (no `name` field)
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.name ||
    "User";
  const displayRole =
    roleLabels[user?.role?.toLowerCase()] || user?.role || "Member";
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
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </NavLink>
            <img
              src="/img/brand-text-img.png"
              alt="BukSUPPLY Brand"
              className="brand-img"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
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
      <div className={`main${isProfilePage ? " profile-route" : ""}`}>
        <header className={`topbar${isProfilePage ? " transparent" : ""}`}>
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

            <ProfileMenu
              base={base}
              direction="down"
              name={displayName}
              roleLabel={displayRole}
              avatar={avatarSrc}
              onAvatarError={handleAvatarError}
              onLogout={() => setLogoutOpen(true)}
              trigger={({ open, toggle }) => (
                <button
                  type="button"
                  className="avatar"
                  aria-label="User profile"
                  aria-haspopup="menu"
                  aria-expanded={open}
                  onClick={toggle}
                >
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    onError={handleAvatarError}
                  />
                </button>
              )}
            />
          </div>
        </header>

        <main className="content" id="content">
          <Outlet />
        </main>
      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      <LogoutModal isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}