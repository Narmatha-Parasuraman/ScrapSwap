import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useUser } from '../UserContext.jsx';

const HOME_ROUTE = { poster: '/dashboard', collector: '/dashboard', center: '/dashboard' };

export default function Login() {
  const { setUser } = useUser();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('poster');
  const [areas, setAreas] = useState('');
  const [centers, setCenters] = useState([]);
  const [centerChoice, setCenterChoice] = useState('');
  const [centerName, setCenterName] = useState('');
  const [centerAreaName, setCenterAreaName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode === 'signup' && role === 'center') {
      api.centers().then(setCenters).catch(() => {});
    }
  }, [mode, role]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      let user;
      if (mode === 'login') {
        user = await api.login({ phone, password });
      } else if (role === 'collector') {
        const areaList = areas.split(',').map((a) => a.trim()).filter(Boolean);
        if (areaList.length === 0) {
          setError('Enter at least one area you cover.');
          return;
        }
        user = await api.signup({ name, phone, password, role, areas: areaList });
      } else if (role === 'center') {
        const body = { name, phone, password, role };
        if (centerChoice === '__new__') {
          body.centerName = centerName;
          body.centerAreaName = centerAreaName;
        } else {
          body.centerId = centerChoice;
        }
        user = await api.signup(body);
      } else {
        user = await api.signup({ name, phone, password, role });
      }
      setUser(user);
      navigate(HOME_ROUTE[user.role] ?? '/post');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-shell">
      <form onSubmit={handleSubmit} className="card form">
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>{mode === 'login' ? 'Log in' : 'Create an account'}</h1>
        <p style={{ margin: '0 0 4px', color: 'var(--ink-500)', fontSize: '0.88rem' }}>
          {mode === 'login' ? 'Welcome back to ScrapSwap.' : 'Join ScrapSwap as a poster, collector, or recycle center.'}
        </p>
        {mode === 'signup' && (
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        )}
        <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={mode === 'signup' ? 6 : undefined}
          required
        />
        {mode === 'signup' && (
          <>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="poster">Poster</option>
              <option value="collector">Collector</option>
              <option value="center">Recycle center staff</option>
            </select>
            {role === 'collector' && (
              <input
                placeholder="Areas covered (comma-separated) *"
                value={areas}
                onChange={(e) => setAreas(e.target.value)}
                required
              />
            )}
            {role === 'center' && (
              <>
                <select value={centerChoice} onChange={(e) => setCenterChoice(e.target.value)} required>
                  <option value="" disabled>Which recycle center?</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.area_name})</option>
                  ))}
                  <option value="__new__">+ Register a new center</option>
                </select>
                {centerChoice === '__new__' && (
                  <>
                    <input placeholder="Center name" value={centerName} onChange={(e) => setCenterName(e.target.value)} required />
                    <input placeholder="Center area name" value={centerAreaName} onChange={(e) => setCenterAreaName(e.target.value)} required />
                  </>
                )}
              </>
            )}
          </>
        )}
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn btn-primary">{mode === 'login' ? 'Log in' : 'Sign up'}</button>
        <button type="button" className="btn-link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
        </button>
      </form>
    </div>
  );
}
