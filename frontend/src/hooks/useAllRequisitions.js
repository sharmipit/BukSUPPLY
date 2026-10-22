import { useState, useEffect, useCallback } from 'react';
import api, { errMsg } from '../api/client';

// Every slip from every requester (moderator / administrator pages)
export default function useAllRequisitions() {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/requisitions/all');
      setRequisitions(data.requisitions);
      setError('');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Throws on failure so the page can show the server's message
  const setStatus = async (id, status, remarks = '') => {
    const { data } = await api.patch(`/requisitions/${id}/status`, { status, remarks });
    setRequisitions((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, ...data.requisition, requestedBy: r.requestedBy, requester: r.requester }
          : r
      )
    );
    return data; // { requisition, stock }
  };

  return { requisitions, loading, error, refresh, setStatus };
}
