import { useState, useEffect, useCallback } from 'react';
import api, { errMsg } from '../api/client';

// Fetch all requisitions across users for moderator and admin roles
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

  // Update requisition status
  const setStatus = async (id, status, remarks = '') => {
    const { data } = await api.patch(`/requisitions/${id}/status`, { status, remarks });
    setRequisitions((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, ...data.requisition, requestedBy: r.requestedBy, requester: r.requester }
          : r
      )
    );
    return data;
  };

  // Administrator only: reverts requisition status to the previous state
  const undo = async (id) => {
    const { data } = await api.post(`/requisitions/${id}/undo`);
    await refresh();
    return data;
  };

  return { requisitions, loading, error, refresh, setStatus, undo };
}
