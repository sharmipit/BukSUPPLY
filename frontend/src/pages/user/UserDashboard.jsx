import React from 'react';
import { Link } from 'react-router-dom';
import '../../assets/css/user-styles/user.css';

export default function UserDashboard() {
  return (
    <div className="dashboard">
      {/* Welcome Card */}
      <section className="welcome-card">
        <h1 className="welcome-title">Welcome back, John!</h1>
        <p className="welcome-text">
          Track your active requisitions, manage borrowed items, or submit new requests below.
        </p>

        <hr className="welcome-divider" />

        <div className="actions-label">Quick Actions</div>
        <div className="actions-grid">
          <Link to="/item-request" className="action-btn">
            Create Item Request
          </Link>
          <Link to="/my-requisitions" className="action-btn">
            View My Requisitions
          </Link>
          <Link to="/borrowed-items" className="action-btn">
            View Borrowed Items
          </Link>
        </div>
      </section>

      {/* Stat Cards */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <div>
              <div className="stat-label">Pending Requests</div>
              <div className="stat-value">0</div>
            </div>
            <div className="stat-icon">
              <i className="bi bi-clock-history"></i>
            </div>
          </div>
          <Link to="/my-requisitions" className="stat-link">
            <span>View details</span>
            <i className="bi bi-arrow-right"></i>
          </Link>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div>
              <div className="stat-label">Approved Requests</div>
              <div className="stat-value">0</div>
            </div>
            <div className="stat-icon">
              <i className="bi bi-check-circle"></i>
            </div>
          </div>
          <Link to="/my-requisitions" className="stat-link">
            <span>View details</span>
            <i className="bi bi-arrow-right"></i>
          </Link>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div>
              <div className="stat-label">Currently Borrowed</div>
              <div className="stat-value">0</div>
            </div>
            <div className="stat-icon">
              <i className="bi bi-box-arrow-up-right"></i>
            </div>
          </div>
          <Link to="/borrowed-items" className="stat-link">
            <span>View details</span>
            <i className="bi bi-arrow-right"></i>
          </Link>
        </div>
      </section>

      {/* Recent Activity Panel */}
      <section className="content-panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Recent Activity</h2>
            <p className="panel-subtitle">Your latest requisition updates and requests</p>
          </div>
        </div>

        <div className="empty-state">
          <i className="bi bi-inbox"></i>
          <div className="empty-title">NO RECENT ACTIVITY</div>
          <div className="empty-text">
            You have no active or recent requisition requests at the moment.
          </div>
        </div>
      </section>
    </div>
  );
}