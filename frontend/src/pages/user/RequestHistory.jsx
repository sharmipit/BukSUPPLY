import React, { useState, useEffect } from 'react';
import useRequisitions from '../../hooks/useRequisitions';
import RequisitionDetailsModal from '../../components/RequisitionDetailsModal';
import '../../styles/user/RequestHistory.css';

export default function RequestHistory() {
  useEffect(() => {
    document.title = 'My Requests | BukSUPPLY';
  }, []);

  // Real data from the API (replaces the old hardcoded array)
  const { requisitions: historyRecords, loading, error } = useRequisitions();

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Details Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDetailsReq, setSelectedDetailsReq] = useState(null);

  // Filter logic for history records
  const filteredHistory = historyRecords.filter((record) => {
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      query === '' ||
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
              {loading ? (
                messageRow('bi-hourglass-split', 'Loading...', 'Fetching your request history.')
              ) : error ? (
                messageRow('bi-exclamation-circle', 'Could not load history', error)
              ) : currentHistoryItems.length > 0 ? (
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
                messageRow(
                  'bi-clock-history',
                  'No History Records Found',
                  'You have no past or archived requisition slips matching your search criteria.'
                )
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
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="pagination-indicator">Page {currentPage}</span>
            <button
              className="btn-action btn-edit"
              onClick={() => setCurrentPage((prev) => prev + 1)}
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