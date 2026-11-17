import React, { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';

export default function FeedbackSummary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/feedback/summary')
      .then((res) => setData(res.data))
      .catch((err) => setError(errMsg(err)));
  }, []);

  if (data && !data.enabled) return null;

  return (
    <div className="dashboard-section-card" style={{ padding: 24 }}>
      <h3 className="section-card-title">User Feedback</h3>
      {error && <p>{error}</p>}
      {!data && !error && <p>Loading...</p>}
      {data && (
        <>
          <p>
            <strong style={{ fontSize: '2rem' }}>{data.average ?? '–'}</strong> / 5 average from{' '}
            {data.count} response{data.count === 1 ? '' : 's'}
          </p>
          <p>
            {data.distribution.map((n, i) => `${i + 1}★ ${n}`).join('  ·  ')}
          </p>
          {data.recent.length > 0 && (
            <ul style={{ paddingLeft: 18 }}>
              {data.recent.map((r, i) => (
                <li key={i}>
                  <strong>{r.slip || 'Unknown slip'}</strong>
                  {r.rating ? ` (${r.rating}★)` : ''}: {r.comment}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}