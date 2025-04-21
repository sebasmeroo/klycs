import React from 'react';
import { User } from '../../types';
import '../../pages/UserProfile.css'; // Importar los estilos que creamos anteriormente

// Extender la interfaz User para incluir las tarjetas
interface ExtendedUser extends User {
  cards?: Array<{
    id: string;
    title?: string;
    description?: string;
    backgroundType?: 'image' | 'color' | 'gradient';
    backgroundColor?: string;
    backgroundGradient?: string;
    backgroundImageURL?: string;
    active?: boolean;
    lastUpdate?: number;
    createdAt?: number;
  }>;
}

interface UserCardProps {
  user: ExtendedUser;
}

const UserCard: React.FC<UserCardProps> = ({ user }) => {
  // Determinar el estilo de fondo basado en el tipo de fondo
  const getBackgroundStyle = () => {
    // Buscar la tarjeta activa y más reciente
    const activeCards = user.cards?.filter(card => card.active !== false) || [];
    // Ordenar por fecha de creación (más reciente primero)
    const sortedCards = [...activeCards].sort((a, b) => {
      // Si hay lastUpdate, usarlo primero
      if (a.lastUpdate && b.lastUpdate) {
        return b.lastUpdate - a.lastUpdate;
      } else if (a.lastUpdate) {
        return -1; // a tiene lastUpdate, b no
      } else if (b.lastUpdate) {
        return 1;  // b tiene lastUpdate, a no
      }
      // Si no hay lastUpdate, usar createdAt
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
    const activeCards = user.cards?.filter(card => card.active !== false) || [];
    const sortedCards = [...activeCards].sort((a, b) => {
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
    const activeCards = user.cards?.filter(card => card.active !== false) || [];
    const sortedCards = [...activeCards].sort((a, b) => {
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
    <div 
      className={`card user-card mb-4 ${getBackgroundClass()} ${isDarkBackground() ? 'dark-bg' : ''}`}
      style={{
        ...backgroundStyle,
        overflow: 'hidden',
        transition: 'background 0.3s ease, background-color 0.3s ease',
        minHeight: '200px'
      }}
    >
      <div className="card-body text-center">
        {user.photoURL ? (
          <img 
            src={user.photoURL} 
            alt={user.displayName} 
            className="avatar mb-3"
            style={{ position: 'relative', zIndex: 2 }}
          />
        ) : (
          <div 
            className="avatar-placeholder mb-3"
            style={{ position: 'relative', zIndex: 2 }}
          >
            {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        )}
        
        <h3 className="card-title">{user.displayName}</h3>
        
        {user.bio && (
          <p className="card-text">{user.bio}</p>
        )}
      </div>
    </div>
  );
};

export default UserCard; 