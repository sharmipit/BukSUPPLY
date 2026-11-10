import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/Requests.css';
import '../styles/IssuanceSlip.css';

// Keep these the same as ORG_NAME / SYSTEM_NAME / SYSTEM_SUBTITLE in services/reportFiles.js
const ORG_NAME = 'Bukidnon State University';
const SYSTEM_NAME = 'BukSUPPLY';
const SYSTEM_SUBTITLE = 'Supply Inventory and Requisition System';

const fmtDate = (v) =>
  v
    ? new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

const fmtStamp = (d) =>
  new Date(d).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function IssuanceSlipPreview({
  req,
  lines,
  generatedBy,
  busy,
  excelBusy,
  onClose,
  onDownload,
  onDownloadExcel,
}) {
  const [openedAt] = useState(() => new Date());
  const anyBusy = Boolean(busy || excelBusy);

  const { user } = useAuth();
  // ASSUMPTION: adjust `user?.role` if your auth context stores the role elsewhere
  const role = String(user?.role || '').toLowerCase();
  const canDownload = ['admin', 'administrator', 'moderator'].includes(role);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const infoRows = [
    ['Issuance no.', `ISS-${req.id}`],
    ['Requisition no.', req.id],
    ['Requested by', req.requestedBy || '—'],
    ['Department', req.department || '—'],
    ['Date filed', fmtDate(req.date)],
    ['Date approved', req.reviewedAt ? fmtDate(req.reviewedAt) : '—'],
    ['Purpose', req.purpose || '—'],
  ];

  return (
    <div className="rq-modal-backdrop rq-modal-backdrop-top" onClick={onClose}>
      <div
        className="rq-modal rq-modal-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Issuance slip preview"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rq-modal-header">
          <div>
            <h3>Issuance slip</h3>
            <div className="rq-sub">ISS-{req.id}</div>
          </div>
          <div className="rq-modal-header-right">
            <button className="rq-modal-close" onClick={onClose} aria-label="Close">
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div className="rq-modal-body">
          <p className="rq-muted-text">
            {canDownload
              ? 'This is how the PDF file will look.'
              : 'This is a preview of the issuance slip.'}
            {canDownload &&
              onDownloadExcel &&
              ' The Excel version has the same content and can be edited.'}
          </p>

          <div className="isl-paper-wrap">
            <article className="isl-paper">
              <header className="isl-paper-header">
                <div>
                  <div className="isl-paper-org">{ORG_NAME}</div>
                  <div>
                    {SYSTEM_NAME} – {SYSTEM_SUBTITLE}
                  </div>
                </div>
                <div className="isl-paper-title">Issuance Slip</div>
              </header>

              <div className="isl-paper-body">
                <table className="isl-paper-info">
                  <tbody>
                    {infoRows.map(([k, v]) => (
                      <tr key={k}>
                        <td>{k}:</td>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <table className="isl-paper-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length > 0 ? (
                      lines.map((l, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{l.name}</td>
                          <td>{l.qty}</td>
                          <td>{l.unit || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4">No items.</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {req.remarks && (
                  <p className="isl-paper-remarks">
                    <strong>Remarks:</strong> {req.remarks}
                  </p>
                )}

                <div className="isl-paper-sign">
                  <div>Approved by: {req.reviewedBy || ''}</div>
                  <div>Issued by</div>
                  <div>Received by (signature / date)</div>
                </div>

                <p className="isl-paper-end">*** End of slip ***</p>
              </div>

              <footer className="isl-paper-footer">
                <div>
                  Verification code: <strong>Assigned when downloaded</strong>
                  <br />
                  To verify this report, enter the code under System Reports &gt; Verify a report.
                </div>
                <div className="isl-paper-footer-right">
                  Generated {fmtStamp(openedAt)} by {generatedBy}
                  <br />
                  Page 1 of 1
                </div>
              </footer>
            </article>
          </div>
        </div>

        <div className="rq-modal-footer">
          <button className="rq-btn-secondary" onClick={onClose}>
            Close
          </button>

          {canDownload && (
            <>
              <button className="rq-btn-secondary" onClick={onDownloadExcel} disabled={anyBusy}>
                <i
                  className={`bi ${excelBusy ? 'bi-hourglass-split' : 'bi-file-earmark-excel'}`}
                ></i>
                {excelBusy ? 'Generating Excel...' : 'Download Excel'}
              </button>

              <button className="rq-btn-primary" onClick={onDownload} disabled={anyBusy}>
                <i className={`bi ${busy ? 'bi-hourglass-split' : 'bi-file-earmark-pdf'}`}></i>
                {busy ? 'Downloading...' : 'Download PDF'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}