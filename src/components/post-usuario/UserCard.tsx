import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import LinkItem from './LinkItem';
import ProductItem from './ProductItem';
import './UserCard.css'; // Importar los estilos CSS locales

interface CardType {
  id?: string;
  title?: string;
  description?: string;
  active?: boolean;
  lastUpdate?: number;
  createdAt?: number;
  backgroundType?: 'color' | 'gradient' | 'image';
  backgroundColor?: string;
  gradientStart?: string;
  gradientEnd?: string;
  backgroundImageURL?: string;
  links?: any[];
}

interface UserCardProps {
  userData: any;
  isPreview?: boolean;
}

const UserCard: React.FC<UserCardProps> = ({ userData, isPreview = false }) => {
  if (!userData) {
    return (
      <div className="user-card-container">
        <div className="user-card loading">
          <div className="loader"></div>
          <p className="text-center mt-3">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  const { displayName, username, photoURL, bio, links = [], products = [], cards = [] } = userData;
  const activeLinks = links.filter((link: any) => link.active);
  const activeProducts = products.filter((product: any) => product.active);
  
  // Obtener el estilo de fondo según el tipo
  const getBackgroundStyle = () => {
    // Filtrar tarjetas activas y ordenarlas por fecha de actualización
    const activeCards = cards?.filter((card: CardType) => card.active !== false) || [];
    const sortedCards = [...activeCards].sort((a: CardType, b: CardType) => {
      if (a.lastUpdate && b.lastUpdate) {
        return b.lastUpdate - a.lastUpdate;
      } else if (a.lastUpdate) {
        return -1;
      } else if (b.lastUpdate) {
        return 1;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    
    // Usar la primera tarjeta activa y más reciente
    const userCard = sortedCards.length > 0 ? sortedCards[0] : null;
    
    if (!userCard) return {}; // Si no hay tarjeta, devolver estilo vacío
    
    console.log("Aplicando estilos de fondo para UserCard (tarjeta más reciente):", userCard.id);
    
    if (!userCard.backgroundType || userCard.backgroundType === 'color') {
      const bgColor = userCard.backgroundColor || '#ffffff';
      console.log("Aplicando color de fondo en UserCard:", bgColor);
      return { backgroundColor: bgColor };
    } else if (userCard.backgroundType === 'gradient') {
      const gradient = userCard.backgroundGradient || 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)';
      console.log("Aplicando gradiente en UserCard:", gradient);
      return { background: gradient };
    } else if (userCard.backgroundType === 'image' && userCard.backgroundImageURL) {
      console.log("Aplicando imagen de fondo en UserCard:", userCard.backgroundImageURL);
      return { 
        backgroundImage: `url(${userCard.backgroundImageURL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      };
    }
    
    return {}; // Estilo predeterminado si no hay tipo de fondo
  };

  const backgroundStyle = getBackgroundStyle();
  
  // Determinar clases CSS según el tipo de fondo
  const getBackgroundClass = () => {
    // Usar la misma lógica de selección de tarjeta que en getBackgroundStyle
    const activeCards = cards?.filter((card: CardType) => card.active !== false) || [];
    const sortedCards = [...activeCards].sort((a: CardType, b: CardType) => {
      if (a.lastUpdate && b.lastUpdate) {
        return b.lastUpdate - a.lastUpdate;
      } else if (a.lastUpdate) {
        return -1;
      } else if (b.lastUpdate) {
        return 1;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    
    const userCard = sortedCards.length > 0 ? sortedCards[0] : null;
    if (!userCard) return '';
    
    if (!userCard.backgroundType || userCard.backgroundType === 'color') {
      return 'bg-color';
    } else if (userCard.backgroundType === 'gradient') {
      return 'bg-gradient';
    } else if (userCard.backgroundType === 'image' && userCard.backgroundImageURL) {
      return 'bg-image';
    }
    return '';
  };
  
  // Determinar si el fondo es oscuro para aplicar clase de texto claro
  const isDarkBackground = () => {
    // Usar la misma lógica de selección de tarjeta
    const activeCards = cards?.filter((card: CardType) => card.active !== false) || [];
    const sortedCards = [...activeCards].sort((a: CardType, b: CardType) => {
      if (a.lastUpdate && b.lastUpdate) {
        return b.lastUpdate - a.lastUpdate;
      } else if (a.lastUpdate) {
        return -1;
      } else if (b.lastUpdate) {
        return 1;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    
    const userCard = sortedCards.length > 0 ? sortedCards[0] : null;
    if (!userCard) return false;
    
    return userCard.backgroundType === 'gradient' || 
           userCard.backgroundType === 'image' || 
           (userCard.backgroundType === 'color' && userCard.backgroundColor && 
            ['#000000', '#222222', '#333333', '#444444', '#555555', '#111111'].includes(userCard.backgroundColor));
  };

  return (
    <div className={`user-card-container ${isPreview ? 'preview-mode' : ''}`}>
      <div className={`user-card ${getBackgroundClass()} ${isDarkBackground() ? 'dark-bg' : ''}`} 
           style={{
             ...backgroundStyle,
             transition: 'background 0.3s ease, background-color 0.3s ease'
           }}>
        {isPreview && (
          <div className="preview-badge">
            Vista previa
          </div>
        )}

        <div className="user-card-header">
          {photoURL ? (
            <img 
              src={photoURL} 
              alt={displayName || username} 
              className="user-avatar"
              style={{ position: 'relative', zIndex: 2 }}
            />
          ) : (
            <div className="user-avatar-placeholder" style={{ position: 'relative', zIndex: 2 }}>
              {displayName ? displayName.charAt(0).toUpperCase() : username ? username.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
          
          <h1 className="user-name">{displayName || username}</h1>
          
          {username && displayName && (
            <p className="user-username">@{username}</p>
          )}
          
          {bio && (
            <p className="user-bio">{bio}</p>
          )}
        </div>

        {activeLinks.length > 0 && (
          <div className="user-links-section">
            {activeLinks.map((link: any) => (
              <LinkItem key={link.id} link={link} />
            ))}
          </div>
        )}

        {activeProducts.length > 0 && (
          <div className="user-products-section">
            <h2 className="section-title">Productos</h2>
            <div className="user-products-grid">
              {activeProducts.map((product: any) => (
                <ProductItem key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        <div className="user-card-footer">
          <p className="footer-text">
            Creado con <Link to="/" className="footer-link">Linktree</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserCard; 