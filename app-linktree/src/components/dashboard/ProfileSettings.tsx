import React, { useState, useEffect } from 'react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

interface ProfileSettingsProps {
  userData: any;
}

// Función auxiliar para calcular días restantes
const calculateDaysRemaining = (endDate: Date): number => {
  const now = new Date();
  const end = new Date(endDate); // Asegurar que es un objeto Date
  // Ignorar la hora, comparar solo fechas
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Redondear hacia arriba
  return diffDays >= 0 ? diffDays : 0; // Devolver 0 si la fecha ya pasó
};

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ userData }) => {
  // Obtener datos del contexto
  const { subscriptionEndDate, loadingSubscription, effectivePlan } = useAuth();

  // Inicializar los estados con valores seguros, incluso si userData es null
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [userDataLoaded, setUserDataLoaded] = useState(false);

  // Efecto para actualizar los estados cuando userData cambia
  useEffect(() => {
    // Comprobar explícitamente si userData no es null/undefined
    if (userData) {
      setDisplayName(userData.displayName || '');
      setBio(userData.bio || '');
      setPhotoURL(userData.photoURL || '');
      setPreview(userData.photoURL || null);
      setUserDataLoaded(true);
    } else {
      // Si userData se vuelve null después de cargar, podría ser un deslogueo
      // Re-inicializar los estados si es necesario, o confiar en que el componente se desmonte/remonte.
      setUserDataLoaded(false); // Marcar como no cargado si userData es null
    }
  }, [userData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      // Crear preview local
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      }
      reader.readAsDataURL(selectedFile);
    } else {
      setFile(null);
      setPreview(photoURL); // Revertir a la foto guardada si se cancela
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!auth.currentUser) {
        throw new Error('Usuario no autenticado');
      }

      let finalPhotoURL = photoURL;

      // Si hay un archivo nuevo, subirlo a Storage
      if (file) {
        const storageRef = ref(storage, `avatars/${auth.currentUser.uid}`);
        await uploadBytes(storageRef, file);
        finalPhotoURL = await getDownloadURL(storageRef);
      }

      // Actualizar perfil en Auth
      await updateProfile(auth.currentUser, {
        displayName,
        photoURL: finalPhotoURL
      });

      // Actualizar documento en Firestore
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName,
        photoURL: finalPhotoURL,
        bio
      });

      setPhotoURL(finalPhotoURL);
      setFile(null); // Limpiar el archivo después de subir
      setSuccess(true);
    } catch (error: any) {
      setError(error.message || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de carga general (mejor esperar a ambos: perfil y suscripción si es relevante)
  if (!userDataLoaded || loadingSubscription) {
    return (
      <div className="text-center py-4">
        <div className="loader mb-2"></div>
        <p>Cargando configuración...</p>
      </div>
    );
  }

  // Renderizar la información de la suscripción
  const renderSubscriptionInfo = () => {
    if (effectivePlan === 'FREE') {
      return <p>Actualmente tienes el plan <strong>GRATIS</strong>.</p>;
    }
    if (effectivePlan === 'ADMIN') {
        return <p>Tienes permisos de <strong>ADMINISTRADOR</strong>.</p>;
    }
    if (subscriptionEndDate) {
      const daysRemaining = calculateDaysRemaining(subscriptionEndDate.toDate());
      const formattedDate = subscriptionEndDate.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      if (daysRemaining === 1) {
         return <p>Tu plan <strong>{effectivePlan}</strong> se renueva/termina <strong>mañana</strong> ({formattedDate}).</p>;
      } else if (daysRemaining > 0) {
         return <p>Tu plan <strong>{effectivePlan}</strong> se renueva/termina en <strong>{daysRemaining} días</strong> ({formattedDate}).</p>;
      } else {
         // Esto no debería pasar si effectivePlan se calcula correctamente
         return <p>Tu plan <strong>{effectivePlan}</strong> ha terminado ({formattedDate}).</p>;
      }
    } else {
      // Si tiene plan BASIC/PRO pero no hay fecha (caso raro, error?)
      return <p>Tienes el plan <strong>{effectivePlan}</strong>, pero no se encontró la fecha de renovación.</p>;
    }
  };

  return (
    <div>
      <h2 className="mb-4">Configuración</h2>

      {/* --- Sección de Información de Suscripción --- */} 
      <div className="card mb-4">
        <h3 className="mb-3">Tu Plan Actual</h3>
        {renderSubscriptionInfo()}
        {/* Podrías añadir un botón para ir a gestionar la suscripción (Stripe Customer Portal) */} 
        {/* <button className="btn btn-secondary mt-3">Gestionar Suscripción</button> */} 
      </div>
      {/* --- Fin Sección Suscripción --- */} 

      {success && (
        <div className="alert alert-success">
          ¡Perfil actualizado con éxito!
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* --- Formulario de Perfil (existente) --- */}
      <div className="card mb-4">
         <h3 className="mb-3">Datos del Perfil</h3>
         <form onSubmit={handleSubmit}>
           <div className="form-group">
             <label htmlFor="displayName">Nombre</label>
             <input
               type="text"
               id="displayName"
               className="form-control"
               value={displayName}
               onChange={(e) => setDisplayName(e.target.value)}
               required
             />
           </div>

           <div className="form-group">
             <label htmlFor="bio">Biografía</label>
             <textarea
               id="bio"
               className="form-control"
               value={bio}
               onChange={(e) => setBio(e.target.value)}
               rows={4}
               placeholder="Cuéntanos un poco sobre ti..."
             />
           </div>

           <div className="form-group">
             <label htmlFor="avatar">Foto de perfil</label>
             <div className="d-flex align-center gap-4 mt-2">
               {preview ? (
                 <img 
                   src={preview} 
                   alt="Preview" 
                   className="profile-avatar" 
                   style={{ width: '100px', height: '100px' }} 
                 />
               ) : (
                 <div 
                   className="profile-avatar-placeholder" 
                   style={{ width: '100px', height: '100px', fontSize: '2.5rem' }}
                 >
                   {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                 </div>
               )}
               <input
                 type="file"
                 id="avatar"
                 accept="image/*"
                 onChange={handleFileChange}
                 className="form-control"
               />
             </div>
           </div>

           <button 
             type="submit" 
             className="btn btn-primary mt-4"
             disabled={loading}
           >
             {loading ? 'Guardando...' : 'Guardar cambios de perfil'}
           </button>
         </form>
      </div>
       {/* --- Fin Formulario Perfil --- */}
    </div>
  );
};

export default ProfileSettings; 