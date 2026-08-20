import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { socket } from '../socket.js';
import { useUser } from '../UserContext.jsx';

export default function JobList() {
  const { user } = useUser();
  const [items, setItems] = useState([]);
  const [pickupTimes, setPickupTimes] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadInitial() {
      const areas = user.areas ?? [];
      const results = await Promise.all(areas.map((area) => api.jobsInArea(area)));
      const merged = results.flat();
      const dedup = Array.from(new Map(merged.map((it) => [it.id, it])).values());
      setItems(dedup);
    }
    loadInitial();

    function handleNewItem(item) {
      setItems((prev) => (prev.some((it) => it.id === item.id) ? prev : [item, ...prev]));
    }
    socket.on('item:new', handleNewItem);
    return () => socket.off('item:new', handleNewItem);
  }, [user.areas]);

  function setPickupTime(itemId, value) {
    setPickupTimes((prev) => ({ ...prev, [itemId]: value }));
  }

  async function accept(itemId) {
    const pickupTime = pickupTimes[itemId];
    if (!pickupTime) {
      setError('Set a pickup date and time before accepting this item.');
      return;
    }
    setError('');
    await api.acceptJob(itemId, { pickupTime });
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    setPickupTimes((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  return (
    <div>
      <div className="page-header">
        <h1>Available items</h1>
        <p>Live feed for {user.areas?.length ? user.areas.join(', ') : 'your covered areas'} — new posts appear instantly, no refresh needed. Set a pickup time to accept an item.</p>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

      {items.length === 0 && <p className="empty-state">No pending items right now — new posts will appear here live.</p>}

      {items.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Item #</th><th>Category</th><th>Description</th><th>Weight</th><th>Area</th><th>Pickup time</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.category}</td>
                  <td>{item.description}</td>
                  <td>{item.weight_kg}kg</td>
                  <td>{item.area_name}</td>
                  <td>
                    <input
                      type="datetime-local"
                      required
                      value={pickupTimes[item.id] ?? ''}
                      onChange={(e) => setPickupTime(item.id, e.target.value)}
                      style={{ padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink-900)', fontFamily: 'inherit', fontSize: '0.9rem' }}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => accept(item.id)}
                      disabled={!pickupTimes[item.id]}
                      title={!pickupTimes[item.id] ? 'Set a pickup time first' : undefined}
                    >
                      Accept
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
