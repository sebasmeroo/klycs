import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import UserCard from '../post-usuario/UserCard';
import { QRCodeSVG } from 'qrcode.react';

// URL base del hosting de Firebase
const FIREBASE_HOSTING_URL = 'https://klycs-58190.firebaseapp.com';

// Definir interfaz para las propiedades
interface ShareProfileProps {
  userData?: any; // Hacer userData opcional
}

const ShareProfile: React.FC<ShareProfileProps> = ({ userData: propUserData }) => {
  const { user } = useAuth();
  const [profileUrl, setProfileUrl] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const fetchUserData = async () => {
      // Si se proporcionan datos de usuario como prop, usarlos directamente
      if (propUserData) {
        setUserData(propUserData);
        if (propUserData.username) {
          setProfileUrl(`${FIREBASE_HOSTING_URL}/${propUserData.username}`);
        }
        setLoading(false);
        return;
      }
      
      // Si no hay props, obtener los datos del usuario actual
      if (!user?.uid) return;
      
      try {
        setLoading(true);
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData({
            displayName: data.displayName || user.displayName,
            email: data.email || user.email,
            username: data.username,
            bio: data.bio || '',
            photoURL: data.photoURL || user.photoURL,
          });
          
          // Establecer la URL del perfil basada en el nombre de usuario
          if (data.username) {
            setProfileUrl(`${FIREBASE_HOSTING_URL}/${data.username}`);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [user, propUserData]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(profileUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Error al copiar:', err);
      });
  };

  const shareOnTwitter = () => {
    const text = `¡Revisa mi perfil en LinkTree!`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(twitterUrl, '_blank');
  };

  const shareOnWhatsapp = () => {
    const text = `¡Revisa mi perfil en LinkTree!`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + profileUrl)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="loader"></div>
        <p className="text-center mt-4">Cargando información del perfil...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="mb-4">Compartir tu perfil</h2>
      
      {!userData?.username ? (
        <div className="alert alert-danger mb-4">
          Para tener un perfil público, primero debes configurar tu nombre de usuario en la sección de Perfil.
        </div>
      ) : (
        <div className="share-container">
          <div className="share-preview">
            <div className="preview-mode position-relative">
              <span className="preview-badge">Vista previa</span>
              <UserCard 
                userData={{
                  displayName: userData.displayName,
                  username: userData.username,
                  bio: userData.bio,
                  photoURL: userData.photoURL
                }}
                isPreview={true}
              />
            </div>
          </div>
          
          <div className="share-actions">
            <div>
              <h3 className="mb-3">Tu enlace personal</h3>
              <div className="url-container mb-3">
                <input 
                  type="text" 
                  className="form-control" 
                  value={profileUrl} 
                  readOnly 
                />
                <button 
                  className="btn btn-primary" 
                  onClick={copyToClipboard}
                >
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
              
              <h3 className="mb-3">Compartir en redes</h3>
              <div className="share-buttons mb-4">
                <button 
                  className="btn btn-primary" 
                  onClick={shareOnTwitter}
                >
                  Twitter
                </button>
                <button 
                  className="btn btn-success" 
                  onClick={shareOnWhatsapp}
                >
                  WhatsApp
                </button>
              </div>
              
              <div className="qr-container mb-4">
                <h3 className="mb-3">Código QR</h3>
                <QRCodeSVG 
                  value={profileUrl}
                  size={200}
                  level={"H"}
                  includeMargin={true}
                  className="qr-code"
                />
                <button 
                  className="btn btn-secondary mt-3" 
                  onClick={() => {
                    const canvas = document.querySelector('canvas');
                    if (canvas) {
                      const pngUrl = canvas.toDataURL('image/png');
                      const downloadLink = document.createElement('a');
                      downloadLink.href = pngUrl;
                      downloadLink.download = `${userData.username}_qr.png`;
                      document.body.appendChild(downloadLink);
                      downloadLink.click();
                      document.body.removeChild(downloadLink);
                    }
                  }}
                >
                  Descargar QR
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="mb-3">Consejos para compartir</h3>
              <ul className="tips-list">
                <li>Añade este enlace a tu biografía en Instagram, TikTok o Twitter.</li>
                <li>Comparte tu QR en tus tarjetas de presentación o materiales impresos.</li>
                <li>Incluye tu enlace en tus emails o firma digital.</li>
                <li>Para obtener más visitas, mantén actualizado tu perfil con enlaces relevantes.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareProfile; 