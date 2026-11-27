import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assignments from './pages/Assignments';
import CalendarPage from './pages/Calendar';
import Subjects from './pages/Subjects';
import SubjectDetail from './pages/SubjectDetail';
import Grades from './pages/Grades';
import Settings from './pages/Settings';
import SyncBadge from './components/SyncBadge';

const NAV = [
  { to: '/', label: 'Inicio', ico: '🏠' },
  { to: '/entregas', label: 'Entregas', ico: '📋' },
  { to: '/calendario', label: 'Calendario', ico: '📅' },
  { to: '/asignaturas', label: 'Asignaturas', ico: '📚' },
  { to: '/notas', label: 'Notas', ico: '🎯' },
  { to: '/ajustes', label: 'Ajustes', ico: '⚙️' },
];

export default function App() {
  const links = NAV.map((n) => (
    <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
      <span className="nav-ico">{n.ico}</span>
      {n.label}
    </NavLink>
  ));
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="./icon.svg" alt="" />
          Gestión Uni
        </div>
        {links}
        <span className="spacer" />
        <SyncBadge />
      </aside>
      <div className="mobile-sync"><SyncBadge compact /></div>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/entregas" element={<Assignments />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/asignaturas" element={<Subjects />} />
          <Route path="/asignaturas/:id" element={<SubjectDetail />} />
          <Route path="/notas" element={<Grades />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <nav className="bottom-nav">{links}</nav>
    </div>
  );
}
