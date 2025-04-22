import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
import { v4 as uuidv4 } from 'uuid';
import { compressImage, getImagePreview } from '../../utils/imageCompression';
import { useState } from 'react';
import { getAuth } from 'firebase/auth';

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
      message: 'Error al comprimir la imagen'
    });
    throw error;
  }
};

// Añadir estado para información de compresión
const [compressionInfo, setCompressionInfo] = useState<{
  state: 'loading' | 'success' | 'error';
  message: string;
} | null>(null);

return (
  <form onSubmit={handleSubmit} className="profile-form">
    {/* ... existing code ... */}
    
    <div className="profile-photo-section">
      {/* ... existing code ... */}
      
      {compressionInfo && (
        <div className={`compression-info compression-info-${compressionInfo.state}`}>
          {compressionInfo.message}
        </div>
      )}
    </div>
    
    {/* ... existing code ... */}
  </form>
); 