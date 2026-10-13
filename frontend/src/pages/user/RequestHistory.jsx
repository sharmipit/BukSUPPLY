import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import RequisitionDetailsModal from '../../components/RequisitionDetailsModal';
import '../../styles/user/RequestHistory.css';

export default function RequestHistory() {
  useEffect(() => {
    document.title = 'My Requests | BukSUPPLY';
  }, []);

  const { user } = useAuth();

  // Dummy full transaction history dataset for the user (including pending, accepted, and denied records)
  const [historyRecords, setHistoryRecords] = useState([
    { 
      id: 'REQ-2026-089', 
      department: 'College of Technologies',
      title: 'Term 2 supplies', 
      purpose: 'Monthly office supplies for the department.', 
      item: 'Standard Bond Paper (2 Reams)', 
      dateFiled: '2026-10-05', 
      dateProcessed: 'Pending',
      status: 'Pending', 
      remarks: 'Awaiting moderator review.',
      itemsList: [{ id: '1', name: 'A4 bond paper (ream)', qty: 2, reason: '', maxNormal: 10 }],
      purchaseItems: []
    },
    { 
      id: 'REQ-2026-045', 
      department: 'College of Technologies',
      title: 'Midterm Lab Equipment', 
      purpose: 'Scientific calculators for laboratory exercises.', 
      item: 'Calculator (Scientific) (2pcs)', 
      dateFiled: '2026-09-12', 
      dateProcessed: '2026-09-14',
      status: 'Denied', 
      remarks: 'Out of stock inventory category for current semester.',
      itemsList: [],
      purchaseItems: []
    },
    { 
      id: 'REQ-2026-012', 
      department: 'College of Technologies',
      title: 'Department Archives', 
      purpose: 'Organizing student thesis folders and records.', 
      item: 'Index Folders (10pcs), Ballpen (black) (5pcs)', 
      dateFiled: '2026-08-20', 
      dateProcessed: '2026-08-22',
      status: 'Accepted', 
      remarks: 'Claimed at Property Window 1 by requester.',
      itemsList: [],
      purchaseItems: []
    },
    { 
      id: 'REQ-2026-003', 
      department: 'College of Technologies',
      title: 'Orientation Handouts', 
      purpose: 'Freshman orientation program packets.', 
      item: 'Standard Bond Paper (5 Reams)', 
      dateFiled: '2026-08-01', 
      dateProcessed: '2026-08-03',
      status: 'Accepted', 
      remarks: 'Successfully issued and signed.',
      itemsList: [],
      purchaseItems: []
    },
    { 
      id: 'REQ-2025-870', 
      department: 'College of Technologies',
      title: 'Special Project Proposal', 
      purpose: 'Research documentation printing.', 
      item: 'Long bond paper (3 Reams)', 
      dateFiled: '2025-11-04', 
      dateProcessed: '2025-11-06',
      status: 'Denied', 
      remarks: 'Exceeded departmental quarterly quota limits.',
      itemsList: [],
      purchaseItems: []
    }
  ]);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Details Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDetailsReq, setSelectedDetailsReq] = useState(null);

  // Filter logic for history records
  const filteredHistory = historyRecords.filter(record => {
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch = query === '' || 
                          record.id.toLowerCase().includes(query) || 
                          record.title.toLowerCase().includes(query) ||
                          record.item.toLowerCase().includes(query) ||
                          record.purpose.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'All' || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination calculation
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentHistoryItems = filteredHistory.slice(indexOfFirst, indexOfLast);

  const handleRowClick = (record) => {
    setSelectedDetailsReq(record);
    setDetailsModalOpen(true);
  };

  return (
    <div className="request-history-container">
      {/* Top Banner Header */}
      <div className="hub-header-card">
        <div>
          <h1 className="hub-title">Request History & Archives</h1>
          <p className="hub-subtitle">
            Complete audit trail of all pending, processed, approved, and archived requisitions submitted under your account.
          </p>
        </div>
      </div>

      {/* Filters and Search Bar Section */}
      <div className="hub-filter-bar">
        <div className="search-box-wrapper">
          <i className="bi bi-search"></i>
          <input 
            type="text" 
            className="form-control custom-input"
            placeholder="Search history by ID, title, items, or purpose..."
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

      {/* History Table Card */}
      <div className="dashboard-section-card">
        <div className="table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th className="col-slip">Requisition Slip</th>
                <th className="col-title">Title & Purpose</th>
                <th className="col-items">Item & Description</th>
                <th className="col-date">Date Filed</th>
                <th className="col-status">Status</th>
                <th className="col-remarks">Remarks / Window Notes</th>
              </tr>
            </thead>
            <tbody>
              {currentHistoryItems.length > 0 ? (
                currentHistoryItems.map((record) => (
                  <tr key={record.id} style={{ cursor: 'pointer' }} onClick={() => handleRowClick(record)}>
                    <td className="fw-semibold align-middle nowrap-cell">{record.id}</td>
                    <td className="align-middle">
                      <div className="req-title-text cell-clamp" title={record.title}>{record.title}</div>
                      <div className="req-purpose-text cell-clamp" title={record.purpose}>{record.purpose}</div>
                    </td>
                    <td className="align-middle">
                      <div className="cell-clamp" title={record.item}>{record.item}</div>
                    </td>
                    <td className="align-middle nowrap-cell">{record.dateFiled}</td>
                    <td className="align-middle nowrap-cell">
                      <span className={`badge-status ${record.status.toLowerCase()}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="align-middle text-body-secondary small">
                      <div className="cell-clamp" title={record.remarks}>{record.remarks}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state-cell">
                    <div className="empty-state-content">
                      <div className="empty-icon-circle">
                        <i className="bi bi-clock-history"></i>
                      </div>
                      <h4>No History Records Found</h4>
                      <p>You have no past or archived requisition slips matching your search criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        <div className="table-footer-bar">
          <span>Showing {currentHistoryItems.length} of {filteredHistory.length} history records</span>
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
              disabled={indexOfLast >= filteredHistory.length}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Requisition Details Modal */}
      <RequisitionDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        requisition={selectedDetailsReq}
      />
    </div>
  );
}