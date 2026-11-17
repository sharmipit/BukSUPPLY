import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useRequisitions from '../../hooks/useRequisitions';
import DeleteModal from '../../components/DeleteModal';
import EditRequisitionModal from '../../components/EditRequisitionModal';
import RequisitionDetailsModal from '../../components/RequisitionDetailsModal';
import { errMsg } from '../../api/client';
import '../../styles/user/UserDashboard.css';

const ACTIVE_STATUSES = ['Pending', 'Processing', 'Approved', 'Denied'];
const HISTORY_STATUSES = ['Accepted', 'Denied', 'Cancelled'];

export default function UserDashboard() {
  useEffect(() => {
    document.title = 'Dashboard | BukSUPPLY';
  }, []);

  const { user } = useAuth();
  // The hook exposes cancel() (it used to be called remove() here, which does not exist)
  const { requisitions, loading, error, create, update, cancel } = useRequisitions();

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
      title: 'Processing / Approved',
      count: count('Processing', 'Approved'),
      icon: 'bi-arrow-repeat',
      colorClass: 'stat-processing',
    },
  ];

  const recentRequests = requisitions.filter((r) => ACTIVE_STATUSES.includes(r.status)).slice(0, 5);

  // History table: finished slips only
  const historyRecords = requisitions.filter((r) => HISTORY_STATUSES.includes(r.status));
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 5;
  const indexOfLastItem = historyPage * itemsPerPage;
  const currentHistoryItems = historyRecords.slice(indexOfLastItem - itemsPerPage, indexOfLastItem);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(historyRecords.length / itemsPerPage));
    if (historyPage > totalPages) setHistoryPage(totalPages);
  }, [historyRecords.length, historyPage]);

  // Modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
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
      itemsList: [],
    });
    setCreateModalOpen(true);
  };

  const handleRequestAgain = (req) => {
    setIsCreateMode(true);
    setSelectedEditReq({
      department: req.department || user?.department || '',
      title: `${req.title} (Re-filed)`,
      purpose: req.purpose || '',
      itemsList: (req.itemsList || []).map((l) => ({ ...l })),
    });
    setCreateModalOpen(true);
  };

  const handleCancelClick = (id) => {
    setSelectedReqId(id);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    try {
      await cancel(selectedReqId);
    } catch (err) {
      alert(errMsg(err));
    }
    setCancelModalOpen(false);
    setSelectedReqId(null);
  };

  const handleRowClick = (req) => {
    // Ensure requestedBy is fully resolved so modals and previews display it properly
    const resolvedReq = {
      ...req,
      requestedBy:
        req.requestedBy ||
        [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
        user?.email ||
        'Unknown user',
    };
    setSelectedDetailsReq(resolvedReq);
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
          <table className="custom-table ud-table">
            <thead>
              <tr>
                <th className="ud-col-slip">Requisition Slip</th>
                <th className="ud-col-items">Item & Quantity</th>
                <th className="ud-col-date">Date Filed</th>
                <th className="ud-col-status">Status</th>
                <th className="ud-col-actions text-end">Actions</th>
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
                        const isApproved = req.status === 'Approved';
                        const isDenied = req.status === 'Denied';
                        return (
                          <tr
                            key={req.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleRowClick(req)}
                          >
                            <td className="fw-semibold ud-cell-nowrap">{req.id}</td>
                            <td>
                              <div className="ud-cell-clip" title={req.item}>
                                {req.item}
                              </div>
                            </td>
                            <td className="ud-cell-nowrap">{req.date}</td>
                            <td className="ud-cell-nowrap">
                              <span className={`badge-status ${req.status.toLowerCase()}`}>
                                {req.status}
                              </span>
                            </td>
                            <td
                              className="text-end align-middle ud-cell-nowrap"
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
                                      onClick={() => handleCancelClick(req.id)}
                                      title="Cancel Requisition"
                                    >
                                      <i className="bi bi-x-circle"></i> Cancel
                                    </button>
                                  </>
                                ) : isDenied ? (
                                  <button
                                    className="btn-action btn-edit"
                                    onClick={() => handleRequestAgain(req)}
                                    title="File a new slip using this one's details"
                                  >
                                    <i className="bi bi-arrow-repeat"></i> Request Again
                                  </button>
                                ) : isApproved ? (
                                  <span className="locked-badge-pill ready-pill small">
                                    <i className="bi bi-box-seam"></i> Ready for release
                                  </span>
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
          <span>Showing {recentRequests.length} recent slips</span>
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
              Your finished requisitions: received, denied, or cancelled.
            </p>
          </div>
        </div>

        <div className="table-responsive-wrapper">
          <table className="custom-table ud-table">
            <thead>
              <tr>
                <th className="ud-col-slip">Requisition Slip</th>
                <th className="ud-col-items">Item & Description</th>
                <th className="ud-col-date">Date Filed</th>
                <th className="ud-col-status">Final Status</th>
                <th className="ud-col-remarks">Remarks</th>
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
                      <td className="fw-semibold text-muted ud-cell-nowrap">{hist.id}</td>
                      <td>
                        <div className="ud-cell-clip" title={hist.item}>
                          {hist.item}
                        </div>
                      </td>
                      <td className="ud-cell-nowrap">{hist.date}</td>
                      <td className="ud-cell-nowrap">
                        <span className={`badge-status ${hist.status.toLowerCase()}`}>
                          {hist.status}
                        </span>
                      </td>
                      <td className="text-body-secondary small">
                        <div className="ud-cell-clip" title={hist.remarks}>
                          {hist.remarks}
                        </div>
                      </td>
                    </tr>
                  ))
                : emptyRow(
                    5,
                    'bi-clock-history',
                    'No Transaction History',
                    'You have no finished requisition slips at the moment.'
                  )}
            </tbody>
          </table>
        </div>

        <div className="table-footer-bar history-footer-bar">
          <Link to="/user/history" className="footer-link text-decoration-none">
            Open Request History <i className="bi bi-arrow-right"></i>
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
              disabled={indexOfLastItem >= historyRecords.length}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <DeleteModal
        isOpen={cancelModalOpen}
        title="Cancel Requisition Slip?"
        message={`Are you sure you want to cancel requisition slip ${selectedReqId}? It will be marked as Cancelled and can no longer be edited.`}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelModalOpen(false)}
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
        allowFeedback
      />
    </div>
  );
}
