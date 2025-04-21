import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="container auth-container">
      <div className="card text-center">
        <h1>404</h1>
        <h2 className="mb-3">Página no encontrada</h2>
        <p className="mb-4">La página que estás buscando no existe o ha sido movida.</p>
        <Link to="/" className="btn btn-primary">Volver al inicio</Link>
      </div>
    </div>
  );
};

export default NotFound; 