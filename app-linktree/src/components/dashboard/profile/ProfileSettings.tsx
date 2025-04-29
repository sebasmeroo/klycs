import React, { useState, useEffect } from 'react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../../firebase/config';
import { 
  compressImage, 
  compressProfileImage, 
  getImagePreview, 
  CompressionStatus 
} from '../../../utils/imageCompression';
import { deleteImageFromStorage, uploadCardImage } from '../../../utils/storageUtils';
import CompressionInfo from '../../common/CompressionInfo';
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
  
  // Estados para compresión
  const [compressionStatus, setCompressionStatus] = useState<CompressionStatus>('idle');
  const [compressionData, setCompressionData] = useState<{
    originalSize?: number;
    compressedSize?: number;
    originalFormat?: string;
    compressionRatio?: number;
  }>({});

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      // Comprimir la imagen y usar la versión comprimida para la vista previa
      try {
        // Actualizar estado para mostrar que la compresión está en proceso
        setCompressionStatus('compressing');
        
        // Comprimir imagen usando la función especializada para perfiles
        const result = await compressProfileImage(selectedFile);
        
        // Actualizar estado de compresión con el resultado
        setCompressionStatus(result.success ? 'success' : 'error');
        setCompressionData({
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          originalFormat: result.originalFormat,
          compressionRatio: result.compressionRatio
        });
        
        // Guardar el archivo comprimido
        setFile(result.file);
        
        // Crear preview usando la función de utilidad
        const previewUrl = await getImagePreview(result.file);
        setPreview(previewUrl);
        
      } catch (error) {
        console.error('Error al comprimir imagen de perfil:', error);
        setCompressionStatus('error');
        
        // En caso de error, usar el archivo original
        const previewUrl = await getImagePreview(selectedFile);
        setPreview(previewUrl);
      }
    } else {
      setFile(null);
      setPreview(photoURL); // Revertir a la foto guardada si se cancela
      setCompressionStatus('idle');
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setCompressionStatus('compressing');
    
    try {
      // Comprimir imagen antes de subir usando la función especializada para perfiles
      const compressionResult = await compressProfileImage(file);
      const compressedFile = compressionResult.file;
      
      // Actualizar estado de compresión
      setCompressionStatus(compressionResult.success ? 'success' : 'error');
      setCompressionData({
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize,
        originalFormat: compressionResult.originalFormat,
        compressionRatio: compressionResult.compressionRatio
      });
      
      // Mostrar información de compresión si es necesario
      console.log(compressionResult.infoText);
      
      // Usar la función centralizada para subir el avatar
      const newPhotoURL = await uploadCardImage(
        compressedFile,
        auth.currentUser?.uid || '',
        'avatar',
        photoURL
      );
      
      // Actualizar Firestore
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          photoURL: newPhotoURL
        });
        
        // Actualizar estado local
        setPhotoURL(newPhotoURL);
        
        // Mostrar mensaje de éxito
        setSuccess(true);
      }
    } catch (error: any) {
      console.error('Error al actualizar foto de perfil:', error);
      setError('Error al actualizar foto de perfil. Inténtalo de nuevo.');
      setCompressionStatus('error');
    } finally {
      setLoading(false);
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

      // Si hay un archivo nuevo, comprimirlo y subirlo con la función centralizada
      if (file) {
        try {
          // Comprimir la imagen antes de subirla usando la función especializada para perfiles
          const compressionResult = await compressProfileImage(file);
          
          // Subir la imagen comprimida usando la función centralizada
          finalPhotoURL = await uploadCardImage(
            compressionResult.file, 
            auth.currentUser.uid,
            'avatar',
            userData?.photoURL
          );
        } catch (uploadError) {
          console.error('Error al subir foto de perfil:', uploadError);
          throw new Error('Error al subir la foto de perfil. Inténtalo de nuevo.');
        }
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
            <div className="profile-avatar-controls">
              <input
                type="file"
                id="avatar"
                accept="image/*"
                onChange={handleAvatarChange}
                className="profile-file-input"
              />
              <CompressionInfo 
                status={compressionStatus}
                originalSize={compressionData.originalSize}
                compressedSize={compressionData.compressedSize}
                originalFormat={compressionData.originalFormat}
                compressionRatio={compressionData.compressionRatio}
              />
            </div>
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