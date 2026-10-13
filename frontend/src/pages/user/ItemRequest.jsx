import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DeleteModal from '../../components/DeleteModal';
import EditRequisitionModal from '../../components/EditRequisitionModal';
import RequisitionDetailsModal from '../../components/RequisitionDetailsModal';
import '../../styles/user/ItemRequest.css';

export default function ItemRequest() {
  const { user } = useAuth();

  // Full list of user requisitions (Hub view showing more entries)
  const [requisitions, setRequisitions] = useState([
    { id: 'REQ-2026-089', department: 'College of Technologies', title: 'Term 2 supplies', purpose: 'Monthly office supplies for the department.', item: 'Standard Bond Paper (2 Reams)', date: '2026-10-05', status: 'Pending', itemsList: [{ id: '1', name: 'A4 bond paper (ream)', qty: 2, reason: '', maxNormal: 10 }], purchaseItems: [] },
    { id: 'REQ-2026-090', department: 'College of Technologies', title: 'Markers replenishment', purpose: 'Classroom discussion boards.', item: 'Whiteboard Marker (Black - 3pcs)', date: '2026-10-08', status: 'Processing', itemsList: [{ id: '6', name: 'Whiteboard Marker (Black)', qty: 3, reason: '', maxNormal: 5 }], purchaseItems: [] },
    { id: 'REQ-2026-091', department: 'College of Technologies', title: 'Specialty Filament', purpose: '3D printing lab.', item: '3D Filament (5 rolls)', date: '2026-10-09', status: 'Purchasing', itemsList: [], purchaseItems: [{ name: '3D Filament', qty: 5, reason: 'Special lab requirement' }] },
    { id: 'REQ-2026-075', department: 'College of Technologies', title: 'Laboratory Refill', purpose: 'Midterm exams requirement.', item: 'Long bond paper (5 Reams)', date: '2026-09-28', status: 'Accepted', itemsList: [{ id: '2', name: 'Long bond paper (ream)', qty: 5, reason: '', maxNormal: 10 }], purchaseItems: [] },
    { id: 'REQ-2026-061', department: 'College of Technologies', title: 'Office Essentials', purpose: 'Daily administrative tasks.', item: 'Pencil (10pcs)', date: '2026-09-15', status: 'Denied', itemsList: [{ id: '5', name: 'Pencil', qty: 10, reason: '', maxNormal: 30 }], purchaseItems: [] }
  ]);

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
  const filteredRequests = requisitions.filter(req => {
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch = query === '' ||
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

  const handleSaveEditedReq = (updatedReq) => {
    // BACKEND DEV NOTE: Make API PUT call: PUT /api/user/requisitions/:id
    setRequisitions(requisitions.map(r => r.id === updatedReq.id ? updatedReq : r));
  };

  const handleDeleteClick = (id) => {
    setSelectedReqId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedReqId) {
      // BACKEND DEV NOTE: Make API DELETE call: DELETE /api/user/requisitions/:id
      setRequisitions(requisitions.filter(r => r.id !== selectedReqId));
    }
    setDeleteModalOpen(false);
    setSelectedReqId(null);
  };

  const handleCreateNew = (newReqData) => {
    // BACKEND DEV NOTE: Make API POST call: POST /api/user/requisitions
    const newEntry = {
      ...newReqData,
      id: `REQ-2026-${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toISOString().split('T')[0],
      status: 'Pending'
    };
    setRequisitions([newEntry, ...requisitions]);
  };

  // Re-file a denied request by opening the create modal pre-filled with denied data
  const handleRequestAgain = (req) => {
    setIsCreateMode(true);
    setSelectedEditReq({
      id: `REQ-2026-${Math.floor(100 + Math.random() * 900)}`,
      department: req.department,
      title: `${req.title} (Re-filed)`,
      purpose: req.purpose,
      itemsList: req.itemsList || [],
      purchaseItems: req.purchaseItems || []
    });
    setCreateModalOpen(true);
  };

  const handleRowClick = (req) => {
    setSelectedDetailsReq(req);
    setDetailsModalOpen(true);
  };

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
        <button
          className="btn-file-new-slip border-0"
          onClick={() => {
            setIsCreateMode(true);
            setSelectedEditReq({
              id: `REQ-2026-${Math.floor(100 + Math.random() * 900)}`,
              department: user?.department || 'College of Technologies',
              title: '',
              purpose: '',
              itemsList: [{ id: '1', name: '', qty: 1, reason: '', maxNormal: 10 }],
              purchaseItems: []
            });
            setCreateModalOpen(true);
          }}
        >
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
              {/* 
                BACKEND DEVELOPER INTEGRATION GUIDE (Requisitions Hub):
                1. Fetch paginated records from endpoint: GET /api/user/requisitions?page=${currentPage}&limit=${itemsPerPage}&status=${statusFilter}&search=${searchTerm}
              */}
              {currentItems.length > 0 ? (
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
                <tr>
                  <td colSpan="6" className="empty-state-cell">
                    <div className="empty-state-content">
                      <div className="empty-icon-circle">
                        <i className="bi bi-folder2-open"></i>
                      </div>
                      <h4>No Requisitions Found</h4>
                      <p>No requisition slips match your current search or status filter criteria.</p>
                    </div>
                  </td>
                </tr>
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
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="pagination-indicator">Page {currentPage}</span>
            <button
              className="btn-action btn-edit"
              onClick={() => setCurrentPage(prev => prev + 1)}
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
        onSave={isCreateMode ? handleCreateNew : handleSaveEditedReq}
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