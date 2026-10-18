import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import usePage from "../hooks/usePage";
import menuCss from "../styles/menu.css?raw";
import LogoutModal from "../components/LogoutModal";

import { DEFAULT_AVATAR, getAvatar } from "../utils/avatar";

// Media query for mobile screens (used in JS to match CSS breakpoints)
const MOBILE_QUERY = "(max-width: 768px)";

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

// Navigation configuration for Moderators (Inventory & Processing Staff)
const moderatorNavSections = [
  {
    title: "Main Navigation",
    className: "main-nav",
    items: [
      { label: "Dashboard", icon: "bi-grid", to: "/staff" },
      {
        label: "Requests",
        icon: "bi-file-earmark-text",
        to: "/staff/requests",
      },
      { label: "Inventory", icon: "bi-box-seam", to: "/staff/inventory" },
      {
        label: "Reports & Logs",
        icon: "bi-bar-chart",
        to: "/staff/reports-logs",
      },
      { label: "Notifications", icon: "bi-bell", to: "/staff/notifications" },
    ],
  },
  {
    title: "Account",
    items: [{ label: "Profile", icon: "bi-person-gear", to: "/staff/profile" }],
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
        label: "Requests",
        icon: "bi-file-earmark-text",
        to: "/admin/requests",
      },
      { label: "Inventory", icon: "bi-box-seam", to: "/admin/inventory" },
      { label: "Notifications", icon: "bi-bell", to: "/admin/notifications" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "User Management", icon: "bi-people", to: "/admin/users" },
      { label: "System Settings", icon: "bi-gear", to: "/admin/settings" },
      {
        label: "Reports & Logs",
        icon: "bi-bar-chart",
        to: "/admin/reports-logs",
      },
    ],
  },
  {
    title: "Account",
    items: [{ label: "Profile", icon: "bi-person-gear", to: "/admin/profile" }],
  },
];

// Role -> nav sections + base path
const adminConfig = { sections: adminNavSections, base: "/admin" };

const roleConfig = {
  Administrator: adminConfig,
  Admin: adminConfig,
  Moderator: { sections: moderatorNavSections, base: "/staff" },
};
const defaultConfig = { sections: userNavSections, base: "/user" };

// Friendly labels shown under the name (lowercase keys; lookup ignores case)
const roleLabels = {
  administrator: "Administrator Account",
  admin: "Administrator Account",
  moderator: "Moderator Account",
  student: "Student Account",
};

function getShortName(user) {
  const first = (user?.firstName || "").trim().split(/\s+/)[0] || "";
  const last = (user?.lastName || "").trim();
  const joined = [first, last].filter(Boolean).join(" ");
  if (joined) return joined;

  // Fallback when only a single `name` string exists
  const parts = (user?.name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0]} ${parts[parts.length - 1]}`;
  return parts[0] || "User";
}

/** Tracks a CSS media query so JS and CSS breakpoints stay in sync. */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * Dropdown shown when clicking a profile trigger.
 */
function ProfileMenu({
  trigger,
  base,
  direction = "down",
  onLogout,
  name,
  roleLabel,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({});
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  const toggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setPos(
        direction === "up"
          ? { bottom: window.innerHeight - r.top + 8, left: r.left }
          : {
              top: r.bottom + 8,
              right: document.documentElement.clientWidth - r.right,
            },
      );
    }
    setOpen((o) => !o);
  };

  // Close on outside click, Escape, resize, or scroll
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onMouseDown = (e) => {
      const inTrigger = wrapRef.current && wrapRef.current.contains(e.target);
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!inTrigger && !inMenu) close();
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

      {open &&
        createPortal(
          <div className="profile-menu" style={pos} role="menu" ref={menuRef}>
            <span className="profile-menu-label">Signed in as</span>
            <span className="profile-menu-name" title={name}>
              {name}
            </span>
            <span className="profile-menu-role">{roleLabel}</span>

            <button
              type="button"
              role="menuitem"
              className="profile-menu-item profile"
              onClick={() => {
                setOpen(false);
                navigate(`${base}/profile`);
              }}
            >
              <i className="bi bi-person"></i>
              <span>My Profile</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className="profile-menu-item signout"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <i className="bi bi-box-arrow-right"></i>
              <span>Sign Out</span>
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function UserLayout() {
  usePage(menuCss);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Profile page only (/user/profile, /staff/profile, /admin/profile):
  // the content is pulled up so the banner sits behind the top bar (no gap).
  // The top bar itself is transparent on every page.
  const isProfilePage = /\/profile\/?$/.test(pathname);

  const isMobile = useMediaQuery(MOBILE_QUERY);

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const menuBtnRef = useRef(null);
  const mobileNavRef = useRef(null);

  // Select navigation set based on role
  const { sections: navSections, base } =
    roleConfig[user?.role] || defaultConfig;

  // Re-computed on every render, so a profile update in AuthContext
  // refreshes the sidebar footer, top bar and dropdown right away.
  const displayName = getShortName(user);
  const displayRole =
    roleLabels[user?.role?.toLowerCase()] || user?.role || "Member";
  const avatarSrc = getAvatar(user);

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

  // Hamburger: dropdown on small screens, collapse/expand sidebar on desktop
  const handleMenuClick = () => {
    if (isMobile) setMobileOpen((o) => !o);
    else toggleSidebar();
  };

  // Close the mobile dropdown when the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close it when the screen grows back to desktop size
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  // Close it on outside click or Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onMouseDown = (e) => {
      const inPanel =
        mobileNavRef.current && mobileNavRef.current.contains(e.target);
      const inButton =
        menuBtnRef.current && menuBtnRef.current.contains(e.target);
      if (!inPanel && !inButton) setMobileOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setMobileOpen(false);

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const menuExpanded = isMobile ? mobileOpen : !collapsed;

  return (
    <div className={`layout ${collapsed ? "collapsed" : ""}`} id="layout">
      {/* SIDEBAR (hidden by CSS on small screens) */}
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-top">
          {/* BRAND: the whole logo (icon + text) toggles the sidebar */}
          <button
            type="button"
            className="brand"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            aria-expanded={!collapsed}
            title="Toggle sidebar"
          >
            <span className="logo">
              <img
                src="/img/buksupply-sidebar-logo.png"
                alt="BukSUPPLY"
                className="logo-img"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </span>
            <img
              src="/img/brand-text-img.png"
              alt="BukSUPPLY Brand"
              className="brand-img"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </button>

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
              referrerPolicy="no-referrer"
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
        <header className="topbar">
          <button
            ref={menuBtnRef}
            className="menu-btn"
            onClick={handleMenuClick}
            aria-label={isMobile ? "Toggle navigation menu" : "Toggle sidebar"}
            aria-expanded={menuExpanded}
          >
            <i
              className={`bi ${isMobile && mobileOpen ? "bi-x-lg" : "bi-list"}`}
            ></i>
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
                    referrerPolicy="no-referrer"
                    onError={handleAvatarError}
                  />
                </button>
              )}
            />
          </div>

          {/* MOBILE DROPDOWN NAV (small screens only) */}
          {isMobile && mobileOpen && (
            <nav
              className="mobile-nav"
              ref={mobileNavRef}
              aria-label="Main navigation"
            >
              {navSections.map((section, idx) => (
                <React.Fragment key={idx}>
                  <h3 className="mobile-nav-title">{section.title}</h3>
                  <ul className="mobile-nav-list">
                    {section.items.map((item, itemIdx) => (
                      <li key={itemIdx}>
                        <NavLink
                          to={item.to}
                          end={item.to === base}
                          className={({ isActive }) =>
                            `mobile-nav-link${isActive ? " active" : ""}`
                          }
                          onClick={() => setMobileOpen(false)}
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </React.Fragment>
              ))}
            </nav>
          )}
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
