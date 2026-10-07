import React, { useState, useContext } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import logoImg from '../assets/img/buksupply-sidebar-logo.png';
import brandTextImg from '../assets/img/brand-text-img.png';
import '../assets/css/menu.css';

export default function Layout({ userRole: propRole }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const authContext = useContext(AuthContext);

  // Derive role from AuthContext or fallback to prop / default 'Student'
  const currentUser = authContext?.user || {};
  const rawRole = currentUser.role || propRole || 'Student';
  const userRole = rawRole.toLowerCase();

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Helper check for role types
  const isStudentOrUser = userRole === 'student' || userRole === 'user';
  const isStaff = userRole === 'regular staff' || userRole === 'staff' || userRole === 'moderator';
  const isAdmin = userRole === 'administrator' || userRole === 'admin';

  return (
    <div className={`layout ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-top">
          {/* Brand Logo - Clicking toggles sidebar */}
          <div 
            className="brand" 
            onClick={toggleSidebar} 
            style={{ cursor: 'pointer' }}
            title="Toggle Sidebar"
          >
            <div className="logo">
              <img src={logoImg} alt="BukSUPPLY Logo" />
            </div>
            <img
              src={brandTextImg}
              alt="BukSUPPLY"
              className="brand-img"
            />
          </div>

          <nav className="nav">
            <div className="nav-title main-nav">MAIN NAVIGATION</div>

            {/* Student / User Navigation */}
            {isStudentOrUser && (
              <ul className="nav-group">
                <li>
                  <NavLink 
                    to="/user-dashboard" 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i className="bi bi-speedometer2"></i>
                    <span className="nav-label">Dashboard</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/item-request" 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i className="bi bi-file-earmark-plus"></i>
                    <span className="nav-label">Item Request</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/my-requisitions" 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i className="bi bi-folder2-open"></i>
                    <span className="nav-label">My Requisitions</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/borrowed-items" 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i className="bi bi-box-arrow-up-right"></i>
                    <span className="nav-label">Borrowed Items</span>
                  </NavLink>
                </li>
              </ul>
            )}

            {/* Staff Navigation */}
            {isStaff && (
              <ul className="nav-group">
                <li>
                  <NavLink 
                    to="/staff/dashboard" 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i className="bi bi-speedometer2"></i>
                    <span className="nav-label">Dashboard</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/staff/requisitions" 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i className="bi bi-file-earmark-text"></i>
                    <span className="nav-label">Requisitions</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/staff/issuance" 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i className="bi bi-box-seam"></i>
                    <span className="nav-label">Issuance</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/staff/inventory" 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i className="bi bi-boxes"></i>
                    <span className="nav-label">Inventory</span>
                  </NavLink>
                </li>
              </ul>
            )}

            {/* Admin Navigation */}
            {isAdmin && (
              <ul className="nav-group">
                <li>
                  <NavLink 
                    to="/admin/dashboard" 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i className="bi bi-speedometer2"></i>
                    <span className="nav-label">Dashboard</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/admin/users" 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i className="bi bi-people"></i>
                    <span className="nav-label">User Management</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/admin/inventory" 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i className="bi bi-building"></i>
                    <span className="nav-label">Inventory Control</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/admin/reports" 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <i className="bi bi-graph-up"></i>
                    <span className="nav-label">Reports & Audit</span>
                  </NavLink>
                </li>
              </ul>
            )}

            <div className="nav-title">GENERAL</div>
            <ul className="nav-group">
              <li>
                <NavLink 
                  to="/help-support" 
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <i className="bi bi-question-circle"></i>
                  <span className="nav-label">Help & Support</span>
                </NavLink>
              </li>
              <li>
                <NavLink 
                  to="/profile" 
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <i className="bi bi-gear"></i>
                  <span className="nav-label">Profile Settings</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>

        {/* Sidebar Footer User Profile Card */}
        <div className="sidebar-footer">
          <hr className="sidebar-divider" />
          <div className="user-profile">
            <i className="bi bi-person-circle" style={{ fontSize: '1.8rem', color: '#fff' }}></i>
            <div className="user-info">
              <span className="user-name">
                {currentUser.firstName && currentUser.lastName 
                  ? `${currentUser.firstName} ${currentUser.lastName}` 
                  : 'John Doe'}
              </span>
              <span className="user-role">{rawRole.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main">
        {/* Topbar */}
        <header className="topbar">
          <button className="menu-btn" onClick={toggleSidebar} aria-label="Toggle Sidebar">
            <i className="bi bi-list"></i>
          </button>

          <div className="topbar-right">
            <Link to="/notifications" className="icon-btn bell" aria-label="Notifications">
              <i className="bi bi-bell"></i>
            </Link>
            <Link 
              to="/profile" 
              className="avatar" 
              aria-label="User Profile" 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
            >
              <i className="bi bi-person-circle" style={{ fontSize: '1.6rem', color: '#5A3D28' }}></i>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}