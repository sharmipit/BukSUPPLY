import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DeleteModal from '../../components/DeleteModal';
import EditRequisitionModal from '../../components/EditRequisitionModal';
import RequisitionDetailsModal from '../../components/RequisitionDetailsModal';
import '../../styles/user/UserDashboard.css';

export default function UserDashboard() {
  const { user } = useAuth();

  // Dummy statistics indicators for regular users (Students / Regular Staff)
  const stats = [
    { title: 'Total Requests', count: 6, icon: 'bi-file-earmark-text', colorClass: 'stat-total' },
    { title: 'Accepted', count: 2, icon: 'bi-check-circle', colorClass: 'stat-accepted' },
    { title: 'Pending', count: 1, icon: 'bi-clock-history', colorClass: 'stat-pending' },
    { title: 'Processing / Purchasing', count: 2, icon: 'bi-arrow-repeat', colorClass: 'stat-processing' },
  ];

  // Dummy recent requests (Action Queue / Active items) with state for deletion & editing
  const [recentRequests, setRecentRequests] = useState([
    { id: 'REQ-2026-089', item: 'Standard Bond Paper (2 Reams)', date: '2026-10-05', status: 'Pending', department: 'College of Technologies', title: 'Term 2 supplies', purpose: 'Monthly office supplies for the department.' },
    { id: 'REQ-2026-090', item: 'Laboratory Projectors (2pcs)', date: '2026-10-06', status: 'Processing', department: 'College of Technologies', title: 'Midterm Projection', purpose: 'Classroom presentations.' },
    { id: 'REQ-2026-091', item: 'Specialty 3D Filament (5 rolls)', date: '2026-10-07', status: 'Purchasing', department: 'College of Technologies', title: 'Maker Lab Restock', purpose: 'Out of stock in bodega; undergoing university procurement.' },
  ]);

  // Dummy request history with state for pagination support (includes pending, approved, denied)
  const [requestHistory, setRequestHistory] = useState([
    { id: 'REQ-2026-089', item: 'Standard Bond Paper (2 Reams)', date: '2026-10-05', status: 'Pending', remarks: 'Awaiting admin review.' },
    { id: 'REQ-2026-045', item: 'Calculator (Scientific)', date: '2026-09-12', status: 'Denied', remarks: 'Out of stock inventory category' },
    { id: 'REQ-2026-012', item: 'Index Folders (10pcs)', date: '2026-08-20', status: 'Accepted', remarks: 'Claimed at Window 1' },
  ]);

  // Pagination state for history table
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 5;

  // Delete Modal State Management
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState(null);

  // Edit / Create Modal State Management
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedEditReq, setSelectedEditReq] = useState(null);

  // Requisition Details Modal State Management
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDetailsReq, setSelectedDetailsReq] = useState(null);

  // Calculate sliced data for the current page view
  const indexOfLastItem = historyPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentHistoryItems = requestHistory.slice(indexOfFirstItem, indexOfLastItem);

  const handleEdit = (req) => {
    setIsCreateMode(false);
    setSelectedEditReq(req);
    setEditModalOpen(true);
  };

  const handleCreateNewClick = () => {
    setIsCreateMode(true);
    setSelectedEditReq({
      id: `REQ-2026-${Math.floor(100 + Math.random() * 900)}`,
      department: user?.department || 'College of Technologies',
      title: '',
      purpose: '',
      itemsList: [{ id: '1', name: '', qty: 1, reason: '', maxNormal: 10 }],
      purchaseItems: [],
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      remarks: 'Awaiting admin review.'
    });
    setCreateModalOpen(true);
  };

  const handleSaveEditedReq = (updatedReq) => {
    // BACKEND DEV NOTE: Make an API call to update requisition: PUT /api/user/requisitions/:id
    setRecentRequests(recentRequests.map(r => r.id === updatedReq.id ? updatedReq : r));
  };

  const handleCreateNewReq = (newReq) => {
    // BACKEND DEV NOTE: Make an API call to create requisition: POST /api/user/requisitions
    const formattedReq = {
      ...newReq,
      date: newReq.date || new Date().toISOString().split('T')[0],
      status: newReq.status || 'Pending',
      remarks: newReq.remarks || 'Awaiting admin review.'
    };
    setRecentRequests([formattedReq, ...recentRequests]);
    setRequestHistory([formattedReq, ...requestHistory]);
  };

  const handleDeleteClick = (id) => {
    setSelectedReqId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedReqId) {
      // BACKEND DEV NOTE: Make an API call to cancel or delete the active requisition.
      setRecentRequests(recentRequests.filter(req => req.id !== selectedReqId));
      setRequestHistory(requestHistory.filter(req => req.id !== selectedReqId));
    }
    setDeleteModalOpen(false);
    setSelectedReqId(null);
  };

  const handleRowClick = (req) => {
    setSelectedDetailsReq(req);
    setDetailsModalOpen(true);
  };

  return (
    <div className="user-dashboard-container">
      {/* 1. Welcome Greeting Card */}
      <div className="welcome-card">
        <h1 className="welcome-title">
          Good day! <span style={{ color: '#8C5839' }}>{user?.name || 'James Abobo'}</span>
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
          <button onClick={handleCreateNewClick} className="btn-file-slip text-decoration-none border-0">
            <i className="bi bi-plus-lg"></i> File Requisition Slip
          </button>
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
              {recentRequests.length > 0 ? (
                recentRequests.map((req) => {
                  const statusStr = req.status || 'Pending';
                  const isPending = statusStr === 'Pending';
                  const isProcessingOrPurchasing = statusStr === 'Processing' || statusStr === 'Purchasing';

                  return (
                    <tr key={req.id} style={{ cursor: 'pointer' }} onClick={() => handleRowClick(req)}>
                      <td className="fw-semibold">{req.id}</td>
                      <td>{req.item}</td>
                      <td>{req.date}</td>
                      <td>
                        <span className={`badge-status ${statusStr.toLowerCase()}`}>
                          {statusStr}
                        </span>
                      </td>
                      <td className="text-end align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="action-buttons">
                          {isPending && (
                            <>
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
                            </>
                          )}
                          {isProcessingOrPurchasing && (
                            <span className="locked-badge-pill text-muted small">
                              <i className="bi bi-lock-fill"></i> Locked ({statusStr})
                            </span>
                          )}
                          {statusStr === 'Accepted' && (
                            <span className="locked-badge-pill">
                              <i className="bi bi-check-circle-fill text-success"></i> Locked (Approved)
                            </span>
                          )}
                          {statusStr === 'Denied' && (
                            <span className="text-muted small">Denied</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* 4. Request History Table with Pagination and Full History Link */}
      <div className="dashboard-section-card mt-4">
        <div className="section-card-header">
          <div>
            <h3 className="section-card-title">Transaction & Request History</h3>
            <p className="section-card-desc">Audit archive of pending, completed, or processed requisitions.</p>
          </div>
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
              {currentHistoryItems.length > 0 ? (
                currentHistoryItems.map((hist) => {
                  const histStatus = hist.status || 'Pending';
                  return (
                    <tr key={hist.id} style={{ cursor: 'pointer' }} onClick={() => handleRowClick(hist)}>
                      <td className="fw-semibold text-muted">{hist.id}</td>
                      <td>{hist.item}</td>
                      <td>{hist.date}</td>
                      <td>
                        <span className={`badge-status ${histStatus.toLowerCase()}`}>
                          {histStatus}
                        </span>
                      </td>
                      <td className="text-body-secondary small">{hist.remarks}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state-cell">
                    <div className="empty-state-content">
                      <div className="empty-icon-circle">
                        <i className="bi bi-clock-history"></i>
                      </div>
                      <h4>No Transaction History</h4>
                      <p>You have no past or archived requisition slips at the moment.</p>
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

      {/* Edit / Create Requisition Modal */}
      <EditRequisitionModal 
        isOpen={editModalOpen || createModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setCreateModalOpen(false);
        }}
        requisitionData={selectedEditReq}
        onSave={isCreateMode ? handleCreateNewReq : handleSaveEditedReq}
        isCreateMode={isCreateMode}
      />

      {/* Requisition Details Modal */}
      <RequisitionDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        requisition={selectedDetailsReq}
      />
    </div>
  );
}