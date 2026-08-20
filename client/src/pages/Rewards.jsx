import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { socket } from '../socket.js';
import { useUser } from '../UserContext.jsx';

export default function Rewards() {
  const { user } = useUser();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.rewards(user.userId).then(setData);

    function handleCredited() {
      api.rewards(user.userId).then(setData);
    }
    socket.on('reward:credited', handleCredited);
    return () => socket.off('reward:credited', handleCredited);
  }, [user.userId]);

  if (!data) return <p className="empty-state">Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Rewards</h1>
        <p>Points are credited automatically once a recycle center confirms delivery.</p>
      </div>

      <div className="stat-grid" style={{ maxWidth: 220 }}>
        <div className="stat-card accent">
          <div className="stat-value">{data.balance}</div>
          <div className="stat-label">Total points</div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Transaction history</h2>
        {data.transactions.length === 0 && <p className="empty-state">No reward transactions yet.</p>}
        {data.transactions.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Points</th><th>Reason</th><th>Item #</th><th>Item</th><th>Date</th></tr>
              </thead>
              <tbody>
                {data.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>+{tx.points}</td>
                    <td>{tx.reason.replace('_', ' ')}</td>
                    <td>{tx.item_id}</td>
                    <td>{tx.item_description}</td>
                    <td>{tx.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
