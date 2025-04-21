import React from 'react';
import { Link } from 'react-router-dom';

interface LinksManagerTempProps {
  userData: any;
}

// Ignoramos userData por ahora, pero lo mantenemos en la interfaz para consistencia
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LinksManagerTemp: React.FC<LinksManagerTempProps> = ({ userData }) => {
  return (
    <div>
      <h2 className="mb-4">Gestionar Enlaces</h2>
      
      <div className="card mb-4 text-center p-4">
        <p className="mb-4">Hemos trasladado el gestor de enlaces a una página dedicada para una mejor experiencia.</p>
        <Link to="/links" className="btn btn-primary">
          Ir al Gestor de Enlaces
        </Link>
      </div>
    </div>
  );
};

export default LinksManagerTemp; 