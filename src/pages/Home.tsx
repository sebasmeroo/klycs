import React from 'react';
import { Link } from 'react-router-dom';

interface HomeProps {
  user?: any;
}

const Home: React.FC<HomeProps> = ({ user }) => {
  return (
    <div className="container" style={{ paddingTop: '4rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Bienvenido a LinkTree</h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
        Crea tu propio perfil personalizado y comienza a compartir tus enlaces y productos digitales
      </p>
      
      {!user ? (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <Link to="/register" className="btn btn-primary">Regístrate</Link>
          <Link to="/login" className="btn" style={{ backgroundColor: 'white', border: '1px solid #d1d5db' }}>Iniciar Sesión</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <Link to="/dashboard" className="btn btn-primary">Ir a mi Dashboard</Link>
          {user.username && (
            <Link to={`/${user.username}`} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              Ver mi Perfil
            </Link>
          )}
        </div>
      )}
      
      <div style={{ marginTop: '4rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Características Principales</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          <div className="card" style={{ width: '300px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Links Personalizados</h3>
            <p>Agrega todos tus enlaces sociales y sitios web importantes en un solo lugar</p>
          </div>
          <div className="card" style={{ width: '300px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Productos Digitales</h3>
            <p>Vende tus productos digitales o servicios directamente desde tu perfil</p>
          </div>
          <div className="card" style={{ width: '300px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Pagos con Stripe</h3>
            <p>Recibe pagos directamente a tu cuenta de Stripe de manera segura y sencilla</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home; 