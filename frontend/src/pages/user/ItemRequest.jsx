import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useRequisitions from '../../hooks/useRequisitions';
import { errMsg } from '../../api/client';
import DeleteModal from '../../components/DeleteModal';
import EditRequisitionModal from '../../components/EditRequisitionModal';
import RequisitionDetailsModal from '../../components/RequisitionDetailsModal';
import '../../styles/user/ItemRequest.css';

export default function ItemRequest() {
  useEffect(() => {
    document.title = 'Item Request | BukSUPPLY';
  }, []);

  const { user } = useAuth();

  // Real data from the API (replaces the old hardcoded array)
  const { requisitions, loading, error, create, update, remove } = useRequisitions();

  // Filtering and pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Modals state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedEditReq, setSelectedEditReq] = useState(null);

  // Details Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDetailsReq, setSelectedDetailsReq] = useState(null);

  // Filter logic
  const filteredRequests = requisitions.filter((req) => {
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      query === '' ||
      req.id.toLowerCase().includes(query) ||
      req.title.toLowerCase().includes(query) ||
      req.item.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'All' || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination calculation
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredRequests.slice(indexOfFirst, indexOfLast);

  const handleEdit = (req) => {
    setIsCreateMode(false);
    setSelectedEditReq(req);
    setEditModalOpen(true);
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

  // Opens the modal pre-filled from a denied slip. Saving it calls create().
  const handleRequestAgain = (req) => {
    setIsCreateMode(true);
    setSelectedEditReq({
      department: req.department,
      title: `${req.title} (Re-filed)`,
      purpose: req.purpose,
      itemsList: req.itemsList || [],
      purchaseItems: req.purchaseItems || [],
    });
    setCreateModalOpen(true);
  };

  const handleFileNew = () => {
    setIsCreateMode(true);
    setSelectedEditReq({
      department: '',
      title: '',
      purpose: '',
      itemsList: [{ id: '1', name: '', qty: 1, reason: '', maxNormal: 10 }],
      purchaseItems: [],
    });
    setCreateModalOpen(true);
  };

  const handleRowClick = (req) => {
    setSelectedDetailsReq(req);
    setDetailsModalOpen(true);
  };

  // One helper for the loading / error / empty rows
  const messageRow = (icon, title, text) => (
    <tr>
      <td colSpan="6" className="empty-state-cell">
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
    <div className="item-request-container">
      {/* Top Banner Header */}
      <div className="hub-header-card">
        <div>
          <h1 className="hub-title">Requisitions Hub</h1>
          <p className="hub-subtitle">
            Manage, search, file, and track all your departmental property and supply requisitions in one place.
          </p>
        </div>
        <button className="btn-file-new-slip border-0" onClick={handleFileNew}>
          <i className="bi bi-plus-lg"></i> File New Requisition
        </button>
      </div>

      {/* Filters and Search Bar Section */}
      <div className="hub-filter-bar">
        <div className="search-box-wrapper">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="form-control custom-input"
            placeholder="Search by slip ID, title, or items..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="status-filter-tabs">
          {['All', 'Pending', 'Processing', 'Purchasing', 'Accepted', 'Denied'].map((status) => (
            <button
              key={status}
              className={`filter-tab-btn ${statusFilter === status ? 'active' : ''}`}
              onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Main Requisitions Table Card */}
      <div className="dashboard-section-card">
        <div className="table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th className="col-slip">Requisition Slip</th>
                <th className="col-title">Title & Purpose</th>
                <th className="col-items">Item & Quantity</th>
                <th className="col-date">Date Filed</th>
                <th className="col-status">Status</th>
                <th className="col-actions text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                messageRow('bi-hourglass-split', 'Loading...', 'Fetching your requisition slips.')
              ) : error ? (
                messageRow('bi-exclamation-circle', 'Could not load requisitions', error)
              ) : currentItems.length > 0 ? (
                currentItems.map((req) => {
                  const isPending = req.status === 'Pending';
                  const isProcessingOrPurchasing = req.status === 'Processing' || req.status === 'Purchasing';

                  return (
                    <tr key={req.id} style={{ cursor: 'pointer' }} onClick={() => handleRowClick(req)}>
                      <td className="fw-semibold align-middle nowrap-cell">{req.id}</td>
                      <td className="align-middle">
                        <div className="req-title-text cell-clamp" title={req.title}>{req.title}</div>
                        <div className="req-purpose-text cell-clamp" title={req.purpose}>{req.purpose}</div>
                      </td>
                      <td className="align-middle">
                        <div className="cell-clamp" title={req.item}>{req.item}</div>
                      </td>
                      <td className="align-middle nowrap-cell">{req.date}</td>
                      <td className="align-middle nowrap-cell">
                        <span className={`badge-status ${req.status.toLowerCase()}`}>
                          {req.status}
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
                              <i className="bi bi-lock-fill"></i> Locked ({req.status})
                            </span>
                          )}
                          {req.status === 'Accepted' && (
                            <span className="locked-badge-pill">
                              <i className="bi bi-check-circle-fill text-success"></i> Locked (Approved)
                            </span>
                          )}
                          {req.status === 'Denied' && (
                            <button
                              className="btn-action btn-request-again"
                              onClick={() => handleRequestAgain(req)}
                              title="File a new request based on this denied slip"
                            >
                              <i className="bi bi-arrow-repeat"></i> Request Again
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                messageRow(
                  'bi-folder2-open',
                  'No Requisitions Found',
                  'No requisition slips match your current search or status filter criteria.'
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        <div className="table-footer-bar">
          <span>Showing {currentItems.length} of {filteredRequests.length} requisitions</span>
          <div className="pagination-controls-wrapper">
            <button
              className="btn-action btn-edit"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="pagination-indicator">Page {currentPage}</span>
            <button
              className="btn-action btn-edit"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={indexOfLast >= filteredRequests.length}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={deleteModalOpen}
        title="Delete Requisition Slip?"
        message={`Are you sure you want to delete requisition slip ${selectedReqId}? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModalOpen(false)}
      />

      {/* Reusable Edit / Create Requisition Modal */}
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

      {/* Requisition Details Modal */}
      <RequisitionDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        requisition={selectedDetailsReq}
      />
    </div>
  );
}