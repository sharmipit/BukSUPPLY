import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DeleteModal from '../../components/DeleteModal';
import EditRequisitionModal from '../../components/EditRequisitionModal';
import '../../styles/user/UserDashboard.css';

export default function UserDashboard() {
  const { user } = useAuth();

  // Dummy statistics indicators for regular users (Students / Regular Staff)
  const stats = [
    { title: 'Total Requests', count: 5, icon: 'bi-file-earmark-text', colorClass: 'stat-total' },
    { title: 'Accepted', count: 2, icon: 'bi-check-circle', colorClass: 'stat-accepted' },
    { title: 'Pending', count: 2, icon: 'bi-clock-history', colorClass: 'stat-pending' },
    { title: 'Denied', count: 1, icon: 'bi-x-circle', colorClass: 'stat-denied' },
  ];

  // Dummy recent requests (Action Queue / Active items) with state for deletion & editing
  const [recentRequests, setRecentRequests] = useState([
    { id: 'REQ-2026-089', item: 'Standard Bond Paper (2 Reams), Ballpoint Pens (1 Box)', date: '2026-10-05', status: 'Pending', department: 'College of Technologies', title: 'Term 2 supplies', purpose: 'Monthly office supplies for the department.' },
    { id: 'REQ-2026-092', item: 'Whiteboard Marker (Black - 3pcs)', date: '2026-10-08', status: 'Accepted', department: 'College of Technologies', title: 'Markers replenishment', purpose: 'Classroom discussion boards.' },
  ]);

  // Dummy request history with state for clearing & pagination support
  const [requestHistory, setRequestHistory] = useState([
    { id: 'REQ-2026-045', item: 'Calculator (Scientific)', date: '2026-09-12', status: 'Denied', remarks: 'Out of stock inventory category' },
    { id: 'REQ-2026-012', item: 'Index Folders (10pcs)', date: '2026-08-20', status: 'Accepted', remarks: 'Claimed at Window 1' },
  ]);

  // Pagination state for history table
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 5;

  // Delete Modal State Management
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState(null);

  // Edit Modal State Management
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedEditReq, setSelectedEditReq] = useState(null);

  // Calculate sliced data for the current page view
  const indexOfLastItem = historyPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentHistoryItems = requestHistory.slice(indexOfFirstItem, indexOfLastItem);

  const handleEdit = (req) => {
    setSelectedEditReq(req);
    setEditModalOpen(true);
  };

  const handleSaveEditedReq = (updatedReq) => {
    // BACKEND DEV NOTE: Make an API call to update requisition: PUT /api/user/requisitions/:id
    setRecentRequests(recentRequests.map(r => r.id === updatedReq.id ? updatedReq : r));
  };

  const handleDeleteClick = (id) => {
    setSelectedReqId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedReqId) {
      // BACKEND DEV NOTE: Make an API call to cancel or delete the active requisition.
      // Example: axios.delete(`/api/user/requisitions/${selectedReqId}`, { headers: { Authorization: `Bearer ${token}` } })
      setRecentRequests(recentRequests.filter(req => req.id !== selectedReqId));
    }
    setDeleteModalOpen(false);
    setSelectedReqId(null);
  };

  // Static functional clear history handler
  const handleClearHistory = () => {
    // BACKEND DEV NOTE: Make an API call to delete or archive history records for the user.
    // Example: axios.delete('/api/user/requisitions/history', { headers: { Authorization: `Bearer ${token}` } })
    setRequestHistory([]);
    setHistoryPage(1);
  };

  return (
    <div className="user-dashboard-container">
      {/* 1. Welcome Greeting Card */}
      <div className="welcome-card">
        <h1 className="welcome-title">
          Good day! <span className="text-accent">{user?.name || 'James Abobo'}</span>
        </h1>
        <p className="welcome-subtitle">
          Here is your daily operational summary for <strong>BukSU Supply & Property Management</strong>. Review your departmental requisition slips, check window issuance updates, or file new requests below.
        </p>
        <div className="welcome-divider"></div>

        {/* 2. Four Indicator Cards Placed Under the Greeting Card Line Separator */}
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div key={index} className={`stat-card ${stat.colorClass}`}>
              <div className="stat-info">
                <span className="stat-title">{stat.title}</span>
                <h2 className="stat-count">{stat.count}</h2>
              </div>
              <div className="stat-icon-circle">
                <i className={`bi ${stat.icon}`}></i>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Recent Requisition Slip Table (Quick Action Queue) */}
      <div className="dashboard-section-card">
        <div className="section-card-header">
          <div>
            <h3 className="section-card-title">Recent Requisition Slip</h3>
            <p className="section-card-desc">Overview of your latest submitted requisition slips and their current progress.</p>
          </div>
          <Link to="/user/requests" className="btn-file-slip text-decoration-none">
            <i className="bi bi-plus-lg"></i> File Requisition Slip
          </Link>
        </div>

        <div className="table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Requisition Slip</th>
                <th>Item & Quantity</th>
                <th>Required Date</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* 
                BACKEND DEVELOPER INTEGRATION GUIDE (Active Requests):
                1. Fetch active requests from endpoint: GET /api/user/requisitions/active
                2. Connect handleDeleteClick to trigger the confirmation modal, then DELETE /api/user/requisitions/:id endpoint upon confirmation.
              */}
              {recentRequests.length > 0 ? (
                recentRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="fw-semibold">{req.id}</td>
                    <td>{req.item}</td>
                    <td>{req.date}</td>
                    <td>
                      <span className={`badge-status ${req.status.toLowerCase()}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="text-end action-buttons">
                      <button 
                        className="btn-action btn-edit" 
                        onClick={() => handleEdit(req)}
                        title="Edit Requisition"
                      >
                        <i className="bi bi-pencil-square"></i> Edit
                      </button>
                      <button 
                        className="btn-action btn-delete" 
                        onClick={() => handleDeleteClick(req.id)}
                        title="Delete Requisition"
                      >
                        <i className="bi bi-trash3"></i> Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state-cell">
                    <div className="empty-state-content">
                      <div className="empty-icon-circle">
                        <i className="bi bi-check2"></i>
                      </div>
                      <h4>No Requisitions Found</h4>
                      <p>You currently have no active requests to display. Please file a new requisition slip to get started.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer-bar">
          <span>Showing {recentRequests.length} active slips</span>
          <Link to="/user/requests" className="footer-link text-decoration-none">
            Open Full Requisitions Hub <i className="bi bi-arrow-right"></i>
          </Link>
        </div>
      </div>

      {/* 4. Request History Table with Clear History, Pagination, and Full History Link */}
      <div className="dashboard-section-card mt-4">
        <div className="section-card-header">
          <div>
            <h3 className="section-card-title">Transaction & Request History</h3>
            <p className="section-card-desc">Archive of completed, closed, or processed requisitions.</p>
          </div>
          {requestHistory.length > 0 && (
            <button 
              className="btn-file-slip text-decoration-none" 
              onClick={handleClearHistory}
              title="Clear entire transaction history"
            >
              <i className="bi bi-trash"></i> Clear History
            </button>
          )}
        </div>

        <div className="table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Requisition Slip</th>
                <th>Item & Description</th>
                <th>Date Filed</th>
                <th>Final Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {/* 
                BACKEND DEVELOPER INTEGRATION GUIDE (History Table):
                1. Fetch history data from endpoint: GET /api/user/requisitions/history?page=${historyPage}&limit=${itemsPerPage}
                2. Implement pagination controls by updating `historyPage` state on button clicks.
                3. Connect handleClearHistory to DELETE /api/user/requisitions/history endpoint to clear logs server-side.
              */}
              {currentHistoryItems.length > 0 ? (
                currentHistoryItems.map((hist) => (
                  <tr key={hist.id}>
                    <td className="fw-semibold text-muted">{hist.id}</td>
                    <td>{hist.item}</td>
                    <td>{hist.date}</td>
                    <td>
                      <span className={`badge-status ${hist.status.toLowerCase()}`}>
                        {hist.status}
                      </span>
                    </td>
                    <td className="text-body-secondary small">{hist.remarks}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state-cell">
                    <div className="empty-state-content">
                      <div className="empty-icon-circle">
                        <i className="bi bi-clock-history"></i>
                      </div>
                      <h4>No Transaction History</h4>
                      <p>You have no past or archived requisition slips at the moment. Completed requests will show up here.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Bar with Pagination Controls & Full History Page Link */}
        <div className="table-footer-bar history-footer-bar">
          <Link to="/user/history" className="footer-link text-decoration-none">
            Open Full Request History <i className="bi bi-arrow-right"></i>
          </Link>
          
          <div className="pagination-controls-wrapper">
            <button 
              className="btn-action btn-edit" 
              onClick={() => setHistoryPage(prev => Math.max(prev - 1, 1))}
              disabled={historyPage === 1}
            >
              Previous
            </button>
            <span className="pagination-indicator">Page {historyPage}</span>
            <button 
              className="btn-action btn-edit" 
              onClick={() => setHistoryPage(prev => prev + 1)}
              disabled={requestHistory.length <= itemsPerPage || indexOfLastItem >= requestHistory.length}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Reusable Delete Confirmation Modal */}
      <DeleteModal 
        isOpen={deleteModalOpen}
        title="Delete Requisition Slip?"
        message={`Are you sure you want to delete requisition slip ${selectedReqId}? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModalOpen(false)}
      />

      {/* Edit Requisition Modal */}
      <EditRequisitionModal 
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        requisitionData={selectedEditReq}
        onSave={handleSaveEditedReq}
      />
    </div>
  );
}