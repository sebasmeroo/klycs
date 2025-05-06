import React, { useState, useEffect } from 'react';
import './HeroSection.css'; // Importar el archivo CSS
import { Link } from 'react-router-dom'; // Importar Link
import { User } from 'firebase/auth'; // Importar tipo User si es necesario

// Definir Props para aceptar el usuario
interface HeroSectionProps {
  user: User | null; // O el tipo correcto que venga de useAuth
}

const HeroSection: React.FC<HeroSectionProps> = ({ user }) => {
  const phrases = ['vendes', 'reservas', 'rediriges', 'administra'];
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % phrases.length);
        setFade(true);
      }, 1000); // tiempo de transición
    }, 4000); // tiempo entre cambios

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hero-section">
      <h1 className="hero-title">
      &nbsp;&nbsp; Con Klycs &nbsp;&nbsp;       
        <span className={`rotating-word-container word-${index}`}> 
          <span className={`rotating-word ${fade ? 'fade-in' : 'fade-out'}`}>{phrases[index]}</span>
        </span> todo desde un enlace.
      </h1>
      <p className="hero-subtitle">
        {/* Texto actualizado describiendo Klycs */}
        Unifica todos tus enlaces, productos, reservas y contenido en un solo perfil digital potente y fácil de compartir.
      </p>
      {/* Lógica condicional para botones */}
      <div className="hero-auth-buttons">
        {!user ? (
          <>
            <Link to="/login" className="hero-button hero-login-btn">
              Iniciar Sesión
            </Link>
            <Link to="/register" className="hero-button hero-register-btn">
              Registrarse
            </Link>
          </>
        ) : (
          <Link to="/dashboard" className="hero-button hero-dashboard-btn">
            Ir a mi Dashboard
          </Link>
        )}
      </div>
    </div>
  );
};

export default HeroSection; 