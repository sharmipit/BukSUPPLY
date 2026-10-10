import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ClearHistoryModal from '../../components/ClearHistoryModal';
import '../../styles/user/RequestHistory.css';

export default function RequestHistory() {
  const { user } = useAuth();

  // Dummy full transaction history dataset for the user
  const [historyRecords, setHistoryRecords] = useState([
    { 
      id: 'REQ-2026-045', 
      department: 'College of Technologies',
      title: 'Midterm Lab Equipment', 
      purpose: 'Scientific calculators for laboratory exercises.', 
      item: 'Calculator (Scientific) (2pcs)', 
      dateFiled: '2026-09-12', 
      dateProcessed: '2026-09-14',
      status: 'Denied', 
      remarks: 'Out of stock inventory category for current semester.' 
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
      remarks: 'Claimed at Property Window 1 by requester.' 
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
      remarks: 'Successfully issued and signed.' 
    },
    { 
      id: 'REQ-2025-998', 
      department: 'College of Technologies',
      title: 'End of Term Cleanup', 
      purpose: 'General cleaning and office management supplies.', 
      item: 'Whiteboard Marker (Black) (2pcs)', 
      dateFiled: '2025-12-10', 
      dateProcessed: '2025-12-12',
      status: 'Accepted', 
      remarks: 'Claimed at Window 2.' 
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
      remarks: 'Exceeded departmental quarterly quota limits.' 
    }
  ]);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Clear History Modal State Management
  const [clearModalOpen, setClearModalOpen] = useState(false);

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

  const handleConfirmClearHistory = () => {
    // BACKEND DEV NOTE: Make DELETE API call: DELETE /api/user/requisitions/history
    setHistoryRecords([]);
    setCurrentPage(1);
    setClearModalOpen(false);
  };

  return (
    <div className="request-history-container">
      {/* Top Banner Header */}
      <div className="hub-header-card">
        <div>
          <h1 className="hub-title">Request History & Archives</h1>
          <p className="hub-subtitle">
            Complete audit trail of all processed, approved, and archived requisitions submitted under your account.
          </p>
        </div>
        {historyRecords.length > 0 && (
          <button 
            className="btn-clear-history"
            onClick={() => setClearModalOpen(true)}
            title="Clear history archive"
          >
            <i className="bi bi-trash3"></i> Clear History
          </button>
        )}
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
          {['All', 'Accepted', 'Denied'].map((status) => (
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
                <th className="col-status">Final Status</th>
                <th className="col-remarks">Remarks / Window Notes</th>
              </tr>
            </thead>
            <tbody>
              {/* 
                BACKEND DEVELOPER INTEGRATION GUIDE (Request History):
                1. Fetch paginated records from endpoint: GET /api/user/requisitions/history?page=${currentPage}&limit=${itemsPerPage}&status=${statusFilter}&search=${searchTerm}
                2. Ensure database model returns processed timestamps and moderator remarks.
              */}
              {currentHistoryItems.length > 0 ? (
                currentHistoryItems.map((record) => (
                  <tr key={record.id}>
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

      {/* Clear History Confirmation Modal */}
      <ClearHistoryModal 
        isOpen={clearModalOpen}
        title="Clear History Archive?"
        message="Are you sure you want to clear your complete transaction history? This action cannot be undone and all logs will be removed."
        onConfirm={handleConfirmClearHistory}
        onClose={() => setClearModalOpen(false)}
      />
    </div>
  );
}