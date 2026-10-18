import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';

export default function useRequisitions() {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/requisitions');
      setRequisitions(res.data.requisitions);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // These throw on failure so the modal can show the error
  const create = async (data) => {
    const res = await api.post('/requisitions', data);
    setRequisitions((prev) => [res.data.requisition, ...prev]);
  };

  const update = async (data) => {
    const res = await api.put(`/requisitions/${data.id}`, data);
    setRequisitions((prev) => prev.map((r) => (r.id === data.id ? res.data.requisition : r)));
  };

  const remove = async (id) => {
    await api.delete(`/requisitions/${id}`);
    setRequisitions((prev) => prev.filter((r) => r.id !== id));
  };

  return { requisitions, loading, error, reload: load, create, update, remove };
}