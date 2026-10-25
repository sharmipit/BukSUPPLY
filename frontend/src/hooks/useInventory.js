import { useState, useEffect, useCallback } from 'react';
// Same client your useRequisitions hook uses. If `api` is exported differently, change this line.
import api, { errMsg } from '../api/client';

export default function useInventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory');
      setItems(data);
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

  const replace = (saved) => setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));

  // These throw on failure so the pages can show the message and keep the modal open
  const create = async (payload) => {
    const { data } = await api.post('/inventory', payload);
    setItems((prev) => [data, ...prev]);
    return data;
  };

  const update = async (id, payload) => {
    const { data } = await api.put(`/inventory/${id}`, payload);
    replace(data);
    return data;
  };

  const adjust = async (id, payload) => {
    const { data } = await api.post(`/inventory/${id}/adjust`, payload);
    replace(data);
    return data;
  };

  const remove = async (id) => {
    await api.delete(`/inventory/${id}`);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return { items, loading, error, refresh, create, update, adjust, remove };
}
