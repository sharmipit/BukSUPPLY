import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useRequisitions from '../../hooks/useRequisitions';
import DeleteModal from '../../components/DeleteModal';
import EditRequisitionModal from '../../components/EditRequisitionModal';
import RequisitionDetailsModal from '../../components/RequisitionDetailsModal';
import { errMsg } from '../../api/client';
import '../../styles/user/UserDashboard.css';

export default function UserDashboard() {
  useEffect(() => {
    document.title = 'Dashboard | BukSUPPLY';
  }, []);

  const { user } = useAuth();
  const { requisitions, loading, error, create, update, remove } = useRequisitions();

  // Google accounts without a surname are stored with "-", so skip that
  const displayName = user?.firstName || '';

  const count = (...s) => requisitions.filter((r) => s.includes(r.status)).length;

  const stats = [
    {
      title: 'Total Requests',
      count: requisitions.length,
      icon: 'bi-file-earmark-text',
      colorClass: 'stat-total',
    },
    {
      title: 'Accepted',
      count: count('Accepted'),
      icon: 'bi-check-circle',
      colorClass: 'stat-accepted',
    },
    {
      title: 'Pending',
      count: count('Pending'),
      icon: 'bi-clock-history',
      colorClass: 'stat-pending',
    },
    {
      title: 'Processing / Purchasing',
      count: count('Processing', 'Purchasing'),
      icon: 'bi-arrow-repeat',
      colorClass: 'stat-processing',
    },
  ];

  // Action queue: slips still in progress, newest first (server already sorts)
  const recentRequests = requisitions
    .filter((r) => ['Pending', 'Processing', 'Purchasing'].includes(r.status))
    .slice(0, 5);

  // History table pagination
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 5;
  const indexOfLastItem = historyPage * itemsPerPage;
  const currentHistoryItems = requisitions.slice(indexOfLastItem - itemsPerPage, indexOfLastItem);

  // Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedEditReq, setSelectedEditReq] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDetailsReq, setSelectedDetailsReq] = useState(null);

  const handleEdit = (req) => {
    setIsCreateMode(false);
    setSelectedEditReq(req);
    setEditModalOpen(true);
  };

  const handleCreateNewClick = () => {
    setIsCreateMode(true);
    setSelectedEditReq({

      department: user?.department || '',
      title: '',
      purpose: '',
      itemsList: [{ id: '1', name: '', qty: 1, reason: '', maxNormal: 10 }],
      purchaseItems: [],
    });
    setCreateModalOpen(true);
  };

  const handleDeleteClick = (id) => {
    setSelectedReqId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await remove(selectedReqId);
    } catch (err) {
      alert(errMsg(err));
    }
    setDeleteModalOpen(false);
    setSelectedReqId(null);
  };

  const handleRowClick = (req) => {
    setSelectedDetailsReq(req);
    setDetailsModalOpen(true);
  };

  const emptyRow = (cols, icon, title, text) => (
    <tr>
      <td colSpan={cols} className="empty-state-cell">
        <div className="empty-state-content">
          <div className="empty-icon-circle">
            <i className={`bi ${icon}`}></i>
          </div>
          <h4>{title}</h4>
          <p>{text}</p>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="user-dashboard-container">
      {/* 1. Welcome card */}
      <div className="welcome-card">
        <h1 className="welcome-title">
          Good day, <span className="accent">{displayName || 'there'}!</span>
        </h1>
        <p className="welcome-subtitle">
          Here is your daily operational summary for{' '}
          <strong>BukSU Supply & Property Management</strong>. Review your departmental requisition
          slips, check window issuance updates, or file new requests below.
        </p>
        <div className="welcome-divider"></div>

        <div className="stats-grid">
          {stats.map((stat) => (
            <div key={stat.title} className={`stat-card ${stat.colorClass}`}>
              <div className="stat-info">
                <span className="stat-title">{stat.title}</span>
                <h2 className="stat-count">{loading ? '–' : stat.count}</h2>
              </div>
              <div className="stat-icon-circle">
                <i className={`bi ${stat.icon}`}></i>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Recent requisition slips */}
      <div className="dashboard-section-card">
        <div className="section-card-header">
          <div>
            <h3 className="section-card-title">Recent Requisition Slip</h3>
            <p className="section-card-desc">
              Overview of your latest submitted requisition slips and their current progress.
            </p>
          </div>
          <button
            onClick={handleCreateNewClick}
            className="btn-file-slip text-decoration-none border-0"
          >
            <i className="bi bi-plus-lg"></i> File Requisition Slip
          </button>
        </div>

        <div className="table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Requisition Slip</th>
                <th>Item & Quantity</th>
                <th>Date Filed</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? emptyRow(
                    5,
                    'bi-hourglass-split',
                    'Loading...',
                    'Fetching your requisition slips.'
                  )
                : error
                  ? emptyRow(5, 'bi-exclamation-circle', 'Could not load requisitions', error)
                  : recentRequests.length > 0
                    ? recentRequests.map((req) => {
                        const isPending = req.status === 'Pending';
                        return (
                          <tr
                            key={req.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleRowClick(req)}
                          >
                            <td className="fw-semibold">{req.id}</td>
                            <td>{req.item}</td>
                            <td>{req.date}</td>
                            <td>
                              <span className={`badge-status ${req.status.toLowerCase()}`}>
                                {req.status}
                              </span>
                            </td>
                            <td
                              className="text-end align-middle"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="action-buttons">
                                {isPending ? (
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
                                ) : (
                                  <span className="locked-badge-pill text-muted small">
                                    <i className="bi bi-lock-fill"></i> Locked ({req.status})
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    : emptyRow(
                        5,
                        'bi-check2',
                        'No Active Requisitions',
                        'You currently have no active requests. File a new requisition slip to get started.'
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

      {/* 3. Request history */}
      <div className="dashboard-section-card mt-4">
        <div className="section-card-header">
          <div>
            <h3 className="section-card-title">Transaction & Request History</h3>
            <p className="section-card-desc">
              Audit archive of pending, completed, or processed requisitions.
            </p>
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
              {currentHistoryItems.length > 0
                ? currentHistoryItems.map((hist) => (
                    <tr
                      key={hist.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(hist)}
                    >
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
                : emptyRow(
                    5,
                    'bi-clock-history',
                    'No Transaction History',
                    'You have no past or archived requisition slips at the moment.'
                  )}
            </tbody>
          </table>
        </div>

        <div className="table-footer-bar history-footer-bar">
          <Link to="/user/history" className="footer-link text-decoration-none">
            Open Full Request History <i className="bi bi-arrow-right"></i>
          </Link>
          <div className="pagination-controls-wrapper">
            <button
              className="btn-action btn-edit"
              onClick={() => setHistoryPage((p) => Math.max(p - 1, 1))}
              disabled={historyPage === 1}
            >
              Previous
            </button>
            <span className="pagination-indicator">Page {historyPage}</span>
            <button
              className="btn-action btn-edit"
              onClick={() => setHistoryPage((p) => p + 1)}
              disabled={indexOfLastItem >= requisitions.length}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <DeleteModal
        isOpen={deleteModalOpen}
        title="Delete Requisition Slip?"
        message={`Are you sure you want to delete requisition slip ${selectedReqId}? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModalOpen(false)}
      />

      <EditRequisitionModal
        isOpen={editModalOpen || createModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setCreateModalOpen(false);
        }}
        requisitionData={selectedEditReq}
        onSave={isCreateMode ? create : update}
        isCreateMode={isCreateMode}
      />

      <RequisitionDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        requisition={selectedDetailsReq}
      />
    </div>
  );
}