import React from 'react';
import './UserProfileHeader.css'; // Importar estilos

// Interfaz simplificada para los datos del usuario necesarios aquí
interface UserData {
  photoURL?: string | null;
  displayName?: string | null;
  bio?: string | null;
}

interface UserProfileHeaderProps {
  user: UserData | null;
  textColor?: string;     // Color de texto a aplicar (heredado)
  className?: string;
}

const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({
  user,
  textColor = '#333333', // Color por defecto si no se proporciona
  className = ''
}) => {

  if (!user) {
    // Podríamos mostrar un esqueleto o nada si el usuario no se carga
    return null; 
  }

  return (
    <div className={`user-profile-header text-center mb-4 ${className}`}> 
       {user.photoURL ? (
         <img 
           src={user.photoURL} 
           alt={user.displayName || 'Avatar'} 
           className="profile-avatar" // Usaremos esta clase para los estilos
           // Añadir onError aquí si quieres manejar errores de avatar directamente
           onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; /* O mostrar placeholder genérico */ }}
         />
       ) : (
         // Placeholder si no hay photoURL
         <div className="profile-avatar-placeholder d-flex align-items-center justify-content-center" >
           {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
         </div>
       )}
       <h1 className="profile-display-name" style={{ color: textColor }}>
         {user.displayName || 'Usuario'}
       </h1>
       {user.bio && (
         <p className="profile-bio-text mt-2" style={{ color: textColor }}>
           {user.bio}
         </p>
       )}
    </div>
  );
};

export default UserProfileHeader; 