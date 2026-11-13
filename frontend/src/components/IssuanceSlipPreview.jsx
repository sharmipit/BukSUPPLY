import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/Requests.css';
import '../styles/IssuanceSlip.css';

const ENTITY_NAME = 'BUKIDNON STATE UNIVERSITY'; // same as issuanceSlip.js on the server

const fmtDate = (v) =>
  v
    ? new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

const fmtWeekday = (v) => (v ? new Date(v).toLocaleDateString('en-PH', { weekday: 'long' }) : '');

const fmtStamp = (d) =>
  new Date(d).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

// Approximate rows per page (the real PDF depends on how long descriptions wrap)
const SINGLE = 21;
const FIRST = 30;
const MIDDLE = 35;
const LAST = 26;
const MIN_LAST = 3;
const MIN_ROWS = 12; // blank ruled rows added to short slips

function paginate(lines) {
  if (lines.length <= SINGLE) return [lines];
  const rest = [...lines];
  const pages = [rest.splice(0, Math.min(FIRST, rest.length - MIN_LAST))];
  while (rest.length > LAST) {
    pages.push(rest.splice(0, Math.min(MIDDLE, rest.length - MIN_LAST)));
  }
  pages.push(rest);
  return pages;
}

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

  const pages = paginate(lines);
  const filed = fmtDate(req.date);
  const weekday = fmtWeekday(req.date);
  const filedFull = weekday ? `${filed} (${weekday})` : filed;

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
            <h3>Requisition and Issue Slip</h3>
            <div className="rq-sub">{req.id}</div>
          </div>
          <div className="rq-modal-header-right">
            <button className="rq-modal-close" onClick={onClose} aria-label="Close">
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div className="rq-modal-body">
          <p className="rq-muted-text">
            {canDownload ? 'This is how the PDF file will look' : 'This is a preview of the slip'}
            {pages.length > 1 && ` (${pages.length} pages, page breaks are approximate)`}.
            {canDownload &&
              onDownloadExcel &&
              ' The Excel version has the same content and can be edited.'}
          </p>

          <div className="isl-paper-wrap">
            {pages.map((rows, p) => {
              const isFirst = p === 0;
              const isLast = p === pages.length - 1;
              const padCount = pages.length === 1 ? Math.max(0, MIN_ROWS - rows.length) : 0;

              return (
                <article className="isl-paper ris" key={p}>
                  <div className="ris-pagehead">
                    <h4>REQUISITION AND ISSUE SLIP</h4>
                    {!isFirst && <span className="ris-cont">RIS No. {req.id} – continued</span>}
                  </div>

                  {isFirst && (
                    <table className="ris-fields">
                      <tbody>
                        <tr>
                          <td className="lbl">Entity Name:</td>
                          <td colSpan="2" className="val">
                            {ENTITY_NAME}
                          </td>
                          <td className="lbl">Fund Cluster:</td>
                          <td></td>
                        </tr>
                        <tr>
                          <td className="lbl">Office / Division:</td>
                          <td colSpan="2" className="val">
                            {req.department || ''}
                          </td>
                          <td className="lbl">Responsibility Center Code:</td>
                          <td></td>
                        </tr>
                        <tr>
                          <td className="lbl">P.R. No.:</td>
                          <td></td>
                          <td className="lbl">Date:</td>
                          <td className="lbl">RIS No.:</td>
                          <td className="val">{req.id}</td>
                        </tr>
                        <tr>
                          <td className="lbl">P.O. No.:</td>
                          <td></td>
                          <td className="lbl">Date:</td>
                          <td className="lbl">Supplier:</td>
                          <td></td>
                        </tr>
                        <tr>
                          <td className="lbl">I.A.R. No.:</td>
                          <td></td>
                          <td className="lbl">Date:</td>
                          <td className="lbl">Date of request:</td>
                          <td className="val">{filedFull}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  <table className="ris-items">
                    <thead>
                      <tr>
                        <th colSpan="4">Requisition</th>
                        <th colSpan="2">Stock Available?</th>
                        <th colSpan="4">Issue</th>
                      </tr>
                      <tr>
                        <th>Stock No.</th>
                        <th>Unit</th>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Yes</th>
                        <th>No</th>
                        <th>Quantity</th>
                        <th>Main</th>
                        <th>Unit Cost</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((l, i) => (
                        <tr key={i}>
                          <td className="c">{l.code || l.id || ''}</td>{' '}
                          <td className="c">{l.unit || ''}</td>
                          <td className="desc">{l.name}</td>
                          <td className="c">{l.qty}</td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}
                      {Array.from({ length: padCount }).map((_, i) => (
                        <tr key={`blank-${i}`}>
                          {Array.from({ length: 10 }).map((__, j) => (
                            <td key={j}></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {isLast && (
                    <>
                      <table className="ris-box">
                        <tbody>
                          <tr>
                            <td className="purpose">
                              <b>Purpose:</b> {req.purpose || ''}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      <table className="ris-sign">
                        <tbody>
                          <tr>
                            <td></td>
                            <td className="head">Requested by:</td>
                            <td className="head">Approved by:</td>
                            <td className="head">Issued by:</td>
                            <td className="head">Received by:</td>
                          </tr>
                          <tr className="tall">
                            <td>Signature:</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                          </tr>
                          <tr>
                            <td>Printed Name:</td>
                            <td className="val c">{req.requestedBy || ''}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                          </tr>
                          <tr>
                            <td>Designation:</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                          </tr>
                          <tr>
                            <td>Date:</td>
                            <td>{filed}</td>
                            <td>
                              <b>DATE:</b>
                            </td>
                            <td>
                              <b>DATE:</b>
                            </td>
                            <td>
                              <b>DATE:</b>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}

                  <div className="ris-end">
                    {!isLast
                      ? `*** Continued on next page (page ${p + 1} of ${pages.length}) ***`
                      : pages.length > 1
                        ? `*** End of slip (page ${p + 1} of ${pages.length}) ***`
                        : '*** End of slip ***'}
                  </div>

                  <footer className="isl-paper-footer">
                    <div>
                      Verification code: <strong>Assigned when downloaded</strong>
                      <br />
                      To verify this report, enter the code under System Reports &gt; Verify a
                      report.
                    </div>
                    <div className="isl-paper-footer-right">
                      Generated {fmtStamp(openedAt)}
                      <br />
                      Page {p + 1} of {pages.length}
                    </div>
                  </footer>
                </article>
              );
            })}
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
