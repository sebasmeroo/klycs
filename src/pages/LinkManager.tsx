import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase/config';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import Header from '../components/header';
import LinksManager from '../components/dashboard/LinksManager';

const LinkManagerPage = () => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        try {
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else {
            navigate('/dashboard');
          }
        } catch (error: any) {
          console.error('Error al cargar datos del usuario:', error);
          setError(error.message || 'Error al cargar datos del usuario');
        } finally {
          setLoading(false);
        }
      } else {
        navigate('/login');
      }
    };

    fetchUserData();
  }, [navigate]);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <p className="mt-3 text-center">Cargando enlaces...</p>
      </div>
    );
  }

  // Si hay un error, mostrar mensaje
  if (error) {
    return (
      <div className="container py-5">
        <div className="alert alert-error">
          {error}
        </div>
        <button className="btn btn-primary mt-3" onClick={() => navigate('/dashboard')}>
          Volver al Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <Header user={userData} />
      
      <div className="d-flex justify-between align-center mb-5">
        <h1>Gestor de Enlaces</h1>
        <button 
          className="btn btn-secondary"
          onClick={() => navigate('/dashboard')}
        >
          Volver al Dashboard
        </button>
      </div>

      <div className="card">
        <LinksManager userData={userData} />
      </div>
    </div>
  );
};

export default LinkManagerPage; 