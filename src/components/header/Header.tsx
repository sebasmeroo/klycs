import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import './Header.css';

interface HeaderProps {
  user: any | null;
}

const Header: React.FC<HeaderProps> = ({ user }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const isActive = (path: string) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <header className="header-container">
      <div className="header-content">
        <div className="header-brand">
          <Link to="/" className="brand" onClick={closeMenu}>Klycs</Link>
        </div>
        
        {/* Menú de navegación en desktop */}
        <nav className="header-nav">
          <Link to="/" className={`nav-link ${isActive('/')}`}>Inicio</Link>
          
          {user ? (
            <>
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>Dashboard</Link>
              {user.username && (
                <Link 
                  to={`/${user.username}`} 
                  className="nav-link" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Mi Perfil
                </Link>
              )}
              <button 
                className="nav-button" 
                onClick={handleLogout}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={`nav-link ${isActive('/login')}`}>Iniciar Sesión</Link>
              <Link to="/register" className="btn-header-primary">Registrarse</Link>
            </>
          )}
        </nav>
        
        {/* Botón de menú en móvil */}
        <button 
          className="mobile-menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
        >
          <span className="menu-icon">
            {menuOpen ? 'Cerrar' : 'Menú'}
          </span>
        </button>
      </div>
      
      {/* Menú móvil desplegable */}
      {menuOpen && (
        <nav className="mobile-nav">
          <Link to="/" className={`mobile-nav-link ${isActive('/')}`} onClick={closeMenu}>Inicio</Link>
          
          {user ? (
            <>
              <Link to="/dashboard" className={`mobile-nav-link ${isActive('/dashboard')}`} onClick={closeMenu}>Dashboard</Link>
              {user.username && (
                <Link 
                  to={`/${user.username}`} 
                  className="mobile-nav-link" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={closeMenu}
                >
                  Mi Perfil
                </Link>
              )}
              <button 
                className="mobile-nav-button" 
                onClick={() => {
                  closeMenu();
                  handleLogout();
                }}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={`mobile-nav-link ${isActive('/login')}`} onClick={closeMenu}>Iniciar Sesión</Link>
              <Link to="/register" className="btn-header-mobile" onClick={closeMenu}>Registrarse</Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
};

export default Header; 