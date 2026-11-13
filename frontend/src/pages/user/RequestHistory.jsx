import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import useRequisitions from '../../hooks/useRequisitions';
import RequisitionDetailsModal from '../../components/RequisitionDetailsModal';
import FilterDropdown from '../../components/FilterDropdown';
import '../../styles/user/RequestHistory.css';

// History only holds slips that reached a final outcome.
// Active slips (Pending, Processing, Approved) live in the Requisitions Hub.
const HISTORY_STATUSES = ['Accepted', 'Denied', 'Cancelled'];

const STATUS_OPTIONS = [
  { value: 'All', label: 'All statuses' },
  { value: 'Accepted', label: 'Accepted', tone: 'accepted' },
  { value: 'Denied', label: 'Denied', tone: 'denied' },
  { value: 'Cancelled', label: 'Cancelled', tone: 'cancelled' },
];

export default function RequestHistory() {
  useEffect(() => {
    document.title = 'Request History | BukSUPPLY';
  }, []);

  const { user } = useAuth();

  // Real data from the API
  const { requisitions, loading, error } = useRequisitions();
  const historyRecords = requisitions.filter((r) => HISTORY_STATUSES.includes(r.status));

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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

  // If the current page disappears after filtering, step back
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filteredHistory.length, currentPage]);

  // Pagination calculation
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentHistoryItems = filteredHistory.slice(indexOfFirst, indexOfLast);

  const handleRowClick = (record) => {
    // Ensure requestedBy and date are properly resolved so the modal & issuance slip preview show everything
    const resolvedRecord = {
      ...record,
      date: record.date || record.dateFiled,
      requestedBy:
        record.requestedBy ||
        [user?.firstName, user?.lastName].filter((n) => n && n !== '-').join(' ') ||
        user?.email ||
        'Unknown user',
    };
    setSelectedDetailsReq(resolvedRecord);
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
          <h1 className="hub-title">Request History</h1>
          <p className="hub-subtitle">
            A record of your finished requisition slips: requests you received, requests that were
            denied, and requests you cancelled. Ongoing requests are in the Requisitions Hub.
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
            placeholder="Search by ID, title, items, or purpose..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <FilterDropdown
          icon="bi-funnel"
          ariaLabel="Filter by status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setCurrentPage(1);
          }}
        />
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
              {loading
                ? messageRow('bi-hourglass-split', 'Loading...', 'Fetching your requests.')
                : error
                  ? messageRow('bi-exclamation-circle', 'Could not load your requests', error)
                  : currentHistoryItems.length > 0
                    ? currentHistoryItems.map((record) => (
                        <tr
                          key={record.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleRowClick(record)}
                        >
                          <td className="fw-semibold align-middle nowrap-cell">{record.id}</td>
                          <td className="align-middle">
                            <div className="req-title-text rh-clip" title={record.title}>
                              {record.title}
                            </div>
                            <div className="req-purpose-text rh-clip" title={record.purpose}>
                              {record.purpose}
                            </div>
                          </td>
                          <td className="align-middle">
                            <div className="rh-clip" title={record.item}>
                              {record.item}
                            </div>
                          </td>
                          <td className="align-middle nowrap-cell">
                            {record.date || record.dateFiled}
                          </td>
                          <td className="align-middle nowrap-cell">
                            <span className={`badge-status ${record.status.toLowerCase()}`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="align-middle text-body-secondary small">
                            <div className="rh-clip" title={record.remarks}>
                              {record.remarks}
                            </div>
                          </td>
                        </tr>
                      ))
                    : messageRow(
                        'bi-clock-history',
                        'No Finished Requests Yet',
                        'Requests you received, that were denied, or that you cancelled will appear here.'
                      )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        <div className="table-footer-bar">
          <span>
            Showing {currentHistoryItems.length} of {filteredHistory.length} records
          </span>
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
