import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './UserContext.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PostItem from './pages/PostItem.jsx';
import JobList from './pages/JobList.jsx';
import StatusTracker from './pages/StatusTracker.jsx';
import CenterConfirm from './pages/CenterConfirm.jsx';
import Rewards from './pages/Rewards.jsx';

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('scrapswap_theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('scrapswap_theme', theme);
  }, [theme]);

  return [theme, setTheme];
}

function Nav({ theme, setTheme }) {
  const { user, setUser } = useUser();
  if (!user) return null;
  const link = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;
  return (
    <nav className="nav">
      <span className="nav-brand">♻ ScrapSwap</span>
      <NavLink to="/dashboard" className={link}>Dashboard</NavLink>
      {user.role === 'poster' && <NavLink to="/post" className={link}>Post item</NavLink>}
      {user.role === 'collector' && <NavLink to="/jobs" className={link}>Job list</NavLink>}
      {user.role !== 'center' && <NavLink to="/status" className={link}>Status</NavLink>}
      {user.role === 'center' && <NavLink to="/centers" className={link}>Drop-offs</NavLink>}
      <NavLink to="/rewards" className={link}>Rewards</NavLink>
      <span className="nav-spacer">
        {user.name} <span className="role-badge">{user.role}</span>
        <button
          className="theme-toggle"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="btn btn-sm" onClick={() => setUser(null)}>Log out</button>
      </span>
    </nav>
  );
}

function RequireUser({ children }) {
  const { user } = useUser();
  return user ? children : <Navigate to="/login" replace />;
}

function RequireRole({ roles, children }) {
  const { user } = useUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const [theme, setTheme] = useTheme();

  return (
    <UserProvider>
      <Nav theme={theme} setTheme={setTheme} />
      <div className="page">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<RequireUser><Dashboard /></RequireUser>} />
          <Route path="/post" element={<RequireRole roles={['poster']}><PostItem /></RequireRole>} />
          <Route path="/jobs" element={<RequireRole roles={['collector']}><JobList /></RequireRole>} />
          <Route path="/status" element={<RequireRole roles={['poster', 'collector']}><StatusTracker /></RequireRole>} />
          <Route path="/centers" element={<RequireRole roles={['center']}><CenterConfirm /></RequireRole>} />
          <Route path="/rewards" element={<RequireUser><Rewards /></RequireUser>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </UserProvider>
  );
}
