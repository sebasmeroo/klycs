import React from 'react';
import './Footer.css';
import { Link } from 'react-router-dom';
import { FiGithub, FiTwitter, FiLinkedin } from 'react-icons/fi'; // Iconos ejemplo

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-section">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-brand">
            <Link to="/" className="brand-link">Klycs</Link>
            <p className="copyright">© {currentYear} Klycs. Todos los derechos reservados.</p>
          </div>
          <div className="footer-links">
            {/* <Link to="/terms" className="footer-link">Términos</Link>
            <Link to="/privacy" className="footer-link">Privacidad</Link>
            <Link to="/contact" className="footer-link">Contacto</Link> */} 
          </div>
          <div className="footer-social">
            {/* <a href="#" target="_blank" rel="noopener noreferrer" className="social-link"><FiTwitter /></a>
            <a href="#" target="_blank" rel="noopener noreferrer" className="social-link"><FiGithub /></a>
            <a href="#" target="_blank" rel="noopener noreferrer" className="social-link"><FiLinkedin /></a> */} 
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 