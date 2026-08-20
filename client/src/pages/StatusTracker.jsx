import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { socket } from '../socket.js';
import { useUser } from '../UserContext.jsx';
import { StatusPill } from '../components/StatusPill.jsx';

export default function StatusTracker() {
  const { user } = useUser();
  const [items, setItems] = useState([]);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    async function load() {
      if (user.role === 'poster') {
        setItems(await api.myItems());
      } else {
        setJobs(await api.myJobs());
      }
    }
    load();

    function handleJobUpdate() {
      load();
    }
    socket.on('job:update', handleJobUpdate);
    return () => socket.off('job:update', handleJobUpdate);
  }, [user.role, user.userId]);

  async function markPickedUp(jobId) {
    await api.markPickedUp(jobId);
    setJobs(await api.myJobs());
  }

  if (user.role === 'poster') {
    return (
      <div>
        <div className="page-header">
          <h1>Your posted items</h1>
          <p>Tracks live as a collector accepts, picks up, and a recycle center confirms delivery.</p>
        </div>
        {items.length === 0 && <p className="empty-state">You haven't posted any items yet.</p>}
        {items.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Item #</th><th>Description</th><th>Category</th><th>Weight</th><th>Area</th><th>Status</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.description}</td>
                    <td>{item.category}</td>
                    <td>{item.weight_kg}kg</td>
                    <td>{item.area_name}</td>
                    <td><StatusPill status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Your jobs</h1>
        <p>Mark an item picked up once you've collected it — the recycle center confirms delivery from there.</p>
      </div>
      {jobs.length === 0 && <p className="empty-state">You haven't accepted any jobs yet.</p>}
      {jobs.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Job #</th><th>Item</th><th>Weight</th><th>Pickup time</th><th>Deliver to</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.id}</td>
                  <td>{job.description}</td>
                  <td>{job.weight_kg}kg</td>
                  <td>{job.pickup_time ? new Date(job.pickup_time).toLocaleString() : '—'}</td>
                  <td>{job.deliver_to ?? <span className="warning-text" style={{ padding: '2px 8px' }}>No center registered yet</span>}</td>
                  <td><StatusPill status={job.status} /></td>
                  <td>
                    {job.status === 'accepted' && (
                      <button className="btn btn-sm" onClick={() => markPickedUp(job.id)}>Mark picked up</button>
                    )}
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
