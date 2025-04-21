import React, { useState, useEffect } from 'react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../../firebase/config';
import './dashboardperfil.css';

interface ProfileSettingsProps {
  userData: any;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ userData }) => {
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

  // Pantalla de carga mientras se espera userData
  if (!userDataLoaded) {
    return (
      <div className="profile-loading-wrapper">
        <div className="profile-spinner"></div>
        <p>Cargando datos del perfil...</p>
      </div>
    );
  }

  return (
    <div className="profile-section">
      <h2 className="profile-title">Configuración del Perfil</h2>

      {success && (
        <div className="profile-success-message">
          ¡Perfil actualizado con éxito!
        </div>
      )}

      {error && (
        <div className="profile-error-message">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="profile-form-wrapper">
        <div className="profile-field-container">
          <label htmlFor="displayName" className="profile-label">Nombre</label>
          <input
            type="text"
            id="displayName"
            className="profile-textfield"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>

        <div className="profile-field-container">
          <label htmlFor="bio" className="profile-label">Biografía</label>
          <textarea
            id="bio"
            className="profile-textfield profile-textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Cuéntanos un poco sobre ti..."
          />
        </div>

        <div className="profile-field-container">
          <label htmlFor="avatar" className="profile-label">Foto de perfil</label>
          <div className="profile-avatar-container">
            {preview ? (
              <img 
                src={preview} 
                alt="Preview" 
                className="profile-user-avatar" 
                style={{ width: '100px', height: '100px' }} 
              />
            ) : (
              <div 
                className="profile-avatar-default" 
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
              className="profile-file-input"
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="profile-save-button"
          disabled={loading}
        >
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
};

export default ProfileSettings; 