import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DeleteModal from '../../components/DeleteModal';
import EditRequisitionModal from '../../components/EditRequisitionModal';
import '../../styles/user/ItemRequest.css';

export default function ItemRequest() {
  const { user } = useAuth();

  // Full list of user requisitions (Hub view showing more entries)
  const [requisitions, setRequisitions] = useState([
    { id: 'REQ-2026-089', department: 'College of Technologies', title: 'Term 2 supplies', purpose: 'Monthly office supplies for the department.', item: 'Standard Bond Paper (2 Reams), Ballpoint Pens (1 Box)', date: '2026-10-05', status: 'Pending', itemsList: [{ id: '1', name: 'A4 bond paper (ream)', qty: 2, reason: '', maxNormal: 10 }] },
    { id: 'REQ-2026-092', department: 'College of Technologies', title: 'Markers replenishment', purpose: 'Classroom discussion boards.', item: 'Whiteboard Marker (Black - 3pcs)', date: '2026-10-08', status: 'Accepted', itemsList: [{ id: '6', name: 'Whiteboard Marker (Black)', qty: 3, reason: '', maxNormal: 5 }] },
    { id: 'REQ-2026-075', department: 'College of Technologies', title: 'Laboratory Refill', purpose: 'Midterm exams requirement.', item: 'Long bond paper (5 Reams)', date: '2026-09-28', status: 'Accepted', itemsList: [{ id: '2', name: 'Long bond paper (ream)', qty: 5, reason: '', maxNormal: 10 }] },
    { id: 'REQ-2026-061', department: 'College of Technologies', title: 'Office Essentials', purpose: 'Daily administrative tasks.', item: 'Pencil (10pcs), Ballpen (blue) (10pcs)', date: '2026-09-15', status: 'Denied', itemsList: [{ id: '5', name: 'Pencil', qty: 10, reason: '', maxNormal: 30 }] },
    { id: 'REQ-2026-050', department: 'College of Technologies', title: 'Faculty Meeting Materials', purpose: 'Department faculty orientation.', item: 'A4 bond paper (3 Reams)', date: '2026-09-02', status: 'Accepted', itemsList: [{ id: '1', name: 'A4 bond paper (ream)', qty: 3, reason: '', maxNormal: 10 }] }
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
  const [selectedEditReq, setSelectedEditReq] = useState(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);

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
    setSelectedEditReq(req);
    setEditModalOpen(true);
  };

  const handleSaveEditedReq = (updatedReq) => {
    setRequisitions(requisitions.map(r => r.id === updatedReq.id ? updatedReq : r));
  };

  const handleDeleteClick = (id) => {
    setSelectedReqId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedReqId) {
      setRequisitions(requisitions.filter(r => r.id !== selectedReqId));
    }
    setDeleteModalOpen(false);
    setSelectedReqId(null);
  };

  const handleCreateNew = (newReqData) => {
    const newEntry = {
      id: `REQ-2026-${Math.floor(100 + Math.random() * 900)}`,
      department: newReqData.department,
      title: newReqData.title,
      purpose: newReqData.purpose,
      item: newReqData.item,
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      itemsList: newReqData.itemsList
    };
    setRequisitions([newEntry, ...requisitions]);
  };

  // Re-file a denied request by opening the create modal pre-filled with denied data
  const handleRequestAgain = (req) => {
    setSelectedEditReq({
      id: `REQ-2026-${Math.floor(100 + Math.random() * 900)}`,
      department: req.department,
      title: `${req.title} (Re-filed)`,
      purpose: req.purpose,
      itemsList: req.itemsList || []
    });
    setCreateModalOpen(true);
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
          className="btn-file-new-slip"
          onClick={() => {
            setSelectedEditReq({
              id: `NEW-${Math.floor(1000 + Math.random() * 9000)}`,
              department: user?.department || 'College of Technologies',
              title: '',
              purpose: '',
              itemsList: [{ id: '1', name: '', qty: 1, reason: '', maxNormal: 10 }]
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
          {['All', 'Pending', 'Accepted', 'Denied'].map((status) => (
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
              {currentItems.length > 0 ? (
                currentItems.map((req) => (
                  <tr key={req.id}>
                    <td className="fw-semibold align-middle nowrap-cell">{req.id}</td>
                    <td className="align-middle">
                      <div className="req-title-text cell-clamp" title={req.title}>{req.title}</div>
                      <div className="req-purpose-text cell-clamp" title={req.purpose}>{req.purpose}</div>
                    </td>
                    <td className="align-middle">
                      <div className="cell-clamp" title={req.item}>{req.item}</div>
                    </td>
                    {/* nowrap-cell keeps the date on one line, just like the status badge */}
                    <td className="align-middle nowrap-cell">{req.date}</td>
                    <td className="align-middle nowrap-cell">
                      <span className={`badge-status ${req.status.toLowerCase()}`}>
                        {req.status}
                      </span>
                    </td>
                    {/* The <td> stays a real table cell; flex layout lives on the inner div */}
                    <td className="text-end align-middle">
                      <div className="action-buttons">
                        {req.status === 'Pending' && (
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
                ))
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
        onSave={(savedData) => {
          if (createModalOpen) {
            handleCreateNew(savedData);
          } else {
            handleSaveEditedReq(savedData);
          }
        }}
      />
    </div>
  );
}