import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Componentes
import LinkItem from '../components/profile/LinkItem';
import ProductItem from '../components/profile/ProductItem';

const Profile = () => {
  const { username } = useParams<{ username: string }>();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const usernameRef = doc(db, 'usernames', username || '');
        const usernameDoc = await getDoc(usernameRef);

        if (!usernameDoc.exists()) {
          setError('Perfil no encontrado');
          setLoading(false);
          return;
        }

        const userId = usernameDoc.data().uid;
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          setProfileData(userDoc.data());
        } else {
          setError('Perfil no encontrado');
        }
      } catch (error) {
        console.error('Error al cargar el perfil:', error);
        setError('Error al cargar el perfil');
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchProfileData();
    }
  }, [username]);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="container auth-container">
        <div className="card text-center">
          <h2>{error || 'Perfil no encontrado'}</h2>
          <p className="mt-3 mb-4">El perfil que estás buscando no existe o no está disponible.</p>
          <Link to="/" className="btn btn-primary mt-3">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="linktree-profile-container">
      {/* Cabecera del perfil */}
      <div className="profile-header">
        {profileData.photoURL ? (
          <img 
            src={profileData.photoURL} 
            alt={profileData.displayName} 
            className="profile-avatar"
          />
        ) : (
          <div className="profile-avatar-placeholder">
            {profileData.displayName?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
        <h1 className="profile-name">{profileData.displayName}</h1>
        <p className="profile-username">@{profileData.username}</p>
        {profileData.bio && <p className="profile-bio">{profileData.bio}</p>}
      </div>

      {/* Enlaces */}
      {profileData.links && profileData.links.length > 0 && (
        <div className="links-container">
          {profileData.links.map((link: any, index: number) => (
            <LinkItem key={index} link={link} />
          ))}
        </div>
      )}

      {/* Productos */}
      {profileData.products && profileData.products.length > 0 && (
        <>
          <h2 className="products-title">Productos y Servicios</h2>
          <div className="products-grid">
            {profileData.products.map((product: any, index: number) => (
              <ProductItem key={index} product={product} profileData={profileData} />
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="footer">
        Impulsado por <span className="brand">LinkTree</span>
      </div>
    </div>
  );
};

export default Profile; 