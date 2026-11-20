import { useState, useEffect, useCallback, useMemo } from 'react';
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

  // Archive item without deleting historical records
  const archive = async (id) => {
    const { data } = await api.patch(`/inventory/${id}/archive`);
    replace(data);
    return data;
  };

  const restore = async (id) => {
    const { data } = await api.patch(`/inventory/${id}/restore`);
    replace(data);
    return data;
  };

  // Separate active and archived inventory items
  const activeItems = useMemo(() => items.filter((i) => !i.archived), [items]);
  const archivedItems = useMemo(() => items.filter((i) => i.archived), [items]);

  return {
    items: activeItems,
    archivedItems,
    allItems: items,
    loading,
    error,
    refresh,
    create,
    update,
    adjust,
    archive,
    restore,
    // Alias remove to archive to maintain backward compatibility
    remove: archive,
  };
}