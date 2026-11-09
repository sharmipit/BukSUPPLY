import { useState, useEffect, useCallback, useMemo } from 'react';
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

  // Archiving keeps the item (and its history) in the database
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

  // `items` only holds ACTIVE items, so the other pages (Requests, dashboards)
  // never count or offer archived stock. The Inventory page uses `allItems`.
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
    // Kept so pages that still call remove() (the dashboards) archive instead of deleting
    remove: archive,
  };
}