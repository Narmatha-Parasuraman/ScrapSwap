import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { socket } from '../socket.js';
import { useUser } from '../UserContext.jsx';
import { StatusPill } from '../components/StatusPill.jsx';

export default function Dashboard() {
  const { user } = useUser();
  const [data, setData] = useState(null);

  useEffect(() => {
    function load() {
      api.dashboard(user.userId).then(setData);
    }
    load();
    socket.on('item:new', load);
    socket.on('job:update', load);
    socket.on('reward:credited', load);
    return () => {
      socket.off('item:new', load);
      socket.off('job:update', load);
      socket.off('reward:credited', load);
    };
  }, [user.userId]);

  if (!data) return <p className="empty-state">Loading dashboard...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Welcome back, {data.user.name}</h1>
        <p>Here's what's happening with your ScrapSwap activity.</p>
      </div>

      {data.user.role === 'poster' && <PosterDashboard data={data} />}
      {data.user.role === 'collector' && <CollectorDashboard data={data} />}
      {data.user.role === 'center' && <CenterDashboard data={data} />}
    </div>
  );
}

function PosterDashboard({ data }) {
  return (
    <>
      <div className="stat-grid">
        <StatCard label="Items posted" value={data.stats.totalPosted} />
        <StatCard label="Awaiting a collector" value={data.stats.pending} />
        <StatCard label="In progress" value={data.stats.inProgress} />
        <StatCard label="Delivered" value={data.stats.delivered} accent />
        <StatCard label="Reward points" value={data.user.points} accent />
      </div>
      <div className="card">
        <h2 className="section-title">Recent items</h2>
        {data.recentItems.length === 0 && <p className="empty-state">Nothing posted yet.</p>}
        {data.recentItems.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Item #</th><th>Description</th><th>Category</th><th>Weight</th><th>Area</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.recentItems.map((item) => (
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
    </>
  );
}

function CollectorDashboard({ data }) {
  return (
    <>
      <div className="stat-grid">
        <StatCard label="Waiting in your areas" value={data.stats.pendingInArea} accent to="/jobs" />
        <StatCard label="Total jobs" value={data.stats.totalJobs} />
        <StatCard label="Accepted" value={data.stats.accepted} />
        <StatCard label="Picked up" value={data.stats.pickedUp} />
        <StatCard label="Delivered" value={data.stats.delivered} accent />
        <StatCard label="Reward points" value={data.user.points} accent />
      </div>
      <div className="card">
        <h2 className="section-title">Covering: {data.areas.length ? data.areas.join(', ') : 'no areas yet'}</h2>
        {data.recentJobs.length === 0 && <p className="empty-state">No jobs accepted yet.</p>}
        {data.recentJobs.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Job #</th><th>Item</th><th>Category</th><th>Weight</th><th>Area</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.recentJobs.map((job) => (
                  <tr key={job.job_id}>
                    <td>{job.job_id}</td>
                    <td>{job.description}</td>
                    <td>{job.category}</td>
                    <td>{job.weight_kg}kg</td>
                    <td>{job.area_name}</td>
                    <td><StatusPill status={job.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function CenterDashboard({ data }) {
  return (
    <>
      <div className="stat-grid">
        <StatCard label="Awaiting confirmation" value={data.stats.pending} />
        <StatCard label="Confirmed at this center" value={data.stats.confirmed} accent />
        <StatCard label="Total weight processed" value={`${data.stats.totalWeightKg}kg`} accent />
      </div>
      <div className="card">
        <h2 className="section-title">
          {data.center ? `${data.center.name} (${data.center.area_name})` : 'Recently confirmed'}
        </h2>
        {data.recentConfirmed.length === 0 && <p className="empty-state">No deliveries confirmed yet.</p>}
        {data.recentConfirmed.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Job #</th><th>Item #</th><th>Item</th><th>Weight</th><th>Collector</th></tr>
              </thead>
              <tbody>
                {data.recentConfirmed.map((job) => (
                  <tr key={job.job_id}>
                    <td>{job.job_id}</td>
                    <td>{job.item_id}</td>
                    <td>{job.description}</td>
                    <td>{job.weight_kg}kg</td>
                    <td>{job.collector_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, accent, to }) {
  const content = (
    <>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </>
  );
  const className = `stat-card${accent ? ' accent' : ''}${to ? ' stat-card-link' : ''}`;
  return to ? (
    <Link to={to} className={className}>{content}</Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
