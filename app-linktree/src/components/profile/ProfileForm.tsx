import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import { compressImage, getImagePreview } from '../../utils/imageCompression';
import { useState } from 'react';
import { getAuth } from 'firebase/auth';

// Definir la interfaz para las props si handleSubmit es pasado desde el padre
interface ProfileFormProps {
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  // Otras props que pueda necesitar el formulario
}

const ProfileForm: React.FC<ProfileFormProps> = ({ handleSubmit }) => {
  // Estados locales que faltaban
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  
  // Añadir estado para información de compresión (movido dentro del componente)
  const [compressionInfo, setCompressionInfo] = useState<{
    state: 'loading' | 'success' | 'error';
    message: string;
  } | null>(null);

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setProfilePhotoFile(selectedFile);
      
      // Usar utilidad centralizada para la vista previa
      getImagePreview(selectedFile).then(preview => {
        setProfilePhotoPreview(preview);
      });
    }
  };

  const uploadProfilePhoto = async (photoFile: File) => {
    try {
      const auth = getAuth();
      if (!auth.currentUser) throw new Error('Usuario no autenticado');
      
      // Comprimir imagen antes de subir
      const compressionResult = await compressImage(photoFile);
      console.log(compressionResult.infoText);
      setCompressionInfo({
        state: 'success',
        message: compressionResult.infoText
      });
      
      const storageRef = ref(storage, `profiles/${auth.currentUser.uid}/${uuidv4()}`);
      await uploadBytes(storageRef, compressionResult.file);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error al subir imagen:', error);
      setCompressionInfo({
        state: 'error',
        message: 'Error al comprimir la imagen' // Mensaje más específico
      });
      throw error;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="profile-form">
      {/* Aquí irían los inputs del formulario, por ejemplo: */}
      <div className="form-group">
        <label htmlFor="profilePhoto">Foto de Perfil</label>
        <input type="file" id="profilePhoto" onChange={handleProfilePhotoChange} accept="image/*" />
        {profilePhotoPreview && (
          <img src={profilePhotoPreview} alt="Vista previa" style={{ width: '100px', height: '100px', marginTop: '10px' }} />
        )}
      </div>
      
      <div className="profile-photo-section">
        {/* ... más campos del formulario ... */}
        
        {compressionInfo && (
          <div className={`compression-info compression-info-${compressionInfo.state}`}>
            {compressionInfo.message}
          </div>
        )}
      </div>
      
      <button type="submit">Guardar Perfil</button>
      {/* ... existing code ... */}
    </form>
  ); 
};

export default ProfileForm; // Exportar el componente 