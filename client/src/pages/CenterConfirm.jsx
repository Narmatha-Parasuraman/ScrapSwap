import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { socket } from '../socket.js';
import { useUser } from '../UserContext.jsx';
import { StatusPill } from '../components/StatusPill.jsx';

export default function CenterConfirm() {
  const { user } = useUser();
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    function load() {
      api.pendingDropoffs(user.centerId).then(setJobs);
    }
    load();

    socket.on('job:update', load);
    return () => socket.off('job:update', load);
  }, [user.centerId]);

  async function confirm(jobId) {
    setMessage('');
    try {
      const job = jobs.find((j) => j.job_id === jobId);
      await api.confirmDelivery(user.centerId, jobId);
      setJobs((prev) => prev.filter((j) => j.job_id !== jobId));
      setIsError(false);
      setMessage(`"${job?.description ?? `Item #${job?.item_id}`}" (Job #${jobId}) confirmed delivered — reward points credited.`);
    } catch (err) {
      setIsError(true);
      setMessage(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Items awaiting drop-off confirmation</h1>
        <p>Confirm delivery once a collector hands an item over — this is what triggers reward points. Confirming works even if they forgot to mark it picked up first.</p>
      </div>
      {message && <p className={isError ? 'error-text' : 'info-text'}>{message}</p>}
      {jobs.length === 0 && <p className="empty-state">No items awaiting a drop-off right now.</p>}
      {jobs.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job #</th>
                <th>Item #</th>
                <th>Item</th>
                <th>Category</th>
                <th>Weight</th>
                <th>Area</th>
                <th>Collector</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.job_id}>
                  <td>{job.job_id}</td>
                  <td>{job.item_id}</td>
                  <td>{job.description}</td>
                  <td>{job.category}</td>
                  <td>{job.weight_kg}kg</td>
                  <td>{job.area_name}</td>
                  <td>{job.collector_name}</td>
                  <td><StatusPill status={job.status} /></td>
                  <td><button className="btn btn-primary btn-sm" onClick={() => confirm(job.job_id)}>Confirm delivered</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
