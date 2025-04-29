import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extrae la ruta de Storage de una URL de Firebase
 * @param url URL de Firebase Storage
 * @returns Ruta decodificada o null si no se puede extraer
 */
export const getStoragePathFromURL = (url: string | undefined): string | null => {
  if (!url || !url.includes('firebasestorage.googleapis.com')) return null;
  
  try {
    // Extraer el token de la URL
    const urlObj = new URL(url);
    const fullPath = urlObj.pathname;
    
    // Extraer la ruta de la URL decodificada
    // El formato es: /v0/b/[BUCKET]/o/[PATH_ENCODED]
    const match = fullPath.match(/\/v0\/b\/[^\/]+\/o\/([^?]+)/);
    if (match && match[1]) {
      // Decodificar la ruta
      const decodedPath = decodeURIComponent(match[1]);
      console.log('Ruta extraída de URL:', decodedPath);
      return decodedPath;
    }
  } catch (e) {
    console.error('Error al extraer ruta de storage:', e);
  }
  
  return null;
};

/**
 * Elimina una imagen de Firebase Storage a partir de su URL
 * @param url URL de Firebase Storage
 * @returns Promise<boolean> indica si se eliminó correctamente
 */
export const deleteImageFromStorage = async (url: string | undefined): Promise<boolean> => {
  if (!url) return false;
  
  const path = getStoragePathFromURL(url);
  if (!path) return false;
  
  try {
    console.log('Intentando eliminar imagen en ruta:', path);
    const imageRef = ref(storage, path);
    await deleteObject(imageRef);
    console.log('Imagen eliminada correctamente:', path);
    return true;
  } catch (error: any) {
    console.error('Error al eliminar imagen:', error);
    // No lanzar error para no interrumpir el flujo principal
    return false;
  }
};

/**
 * Sube una imagen a Firebase Storage y devuelve su URL
 * @param file Archivo comprimido a subir
 * @param userId ID del usuario propietario de la imagen
 * @param imageType Tipo de imagen ('main', 'background' o 'product')
 * @param oldImageUrl URL anterior para eliminar la imagen vieja (opcional)
 * @returns URL pública de la imagen en Firebase Storage
 */
export const uploadCardImage = async (
  file: File,
  userId: string,
  imageType: 'main' | 'background' | 'product' | 'avatar',
  oldImageUrl?: string
): Promise<string> => {
  try {
    // 1. Eliminar imagen anterior si existe
    if (oldImageUrl) {
      const deleted = await deleteImageFromStorage(oldImageUrl);
      if (deleted) {
        console.log(`Imagen ${imageType} antigua eliminada`);
      }
    }
    
    // 2. Generar un ID único para la ruta de la imagen
    const imageId = uuidv4();
    const imagePath = `${imageType === 'avatar' ? 'avatars' : 'cards'}/${userId}/${imageType}_${imageId}`;
    
    console.log(`Subiendo imagen ${imageType} a:`, imagePath);
    const imageRef = ref(storage, imagePath);
    
    // 3. Subir imagen a Firebase Storage
    await uploadBytes(imageRef, file);
    
    // 4. Obtener URL pública
    const downloadURL = await getDownloadURL(imageRef);
    console.log(`Imagen ${imageType} subida con éxito:`, downloadURL);
    
    return downloadURL;
  } catch (error: any) {
    console.error(`Error al subir imagen ${imageType}:`, error);
    
    // Mensaje de error descriptivo basado en el código de error
    const errorMessage = error.code === 'storage/unauthorized' 
      ? `No tienes permisos para subir esta imagen. Contacta con el administrador.`
      : `Error al subir la imagen ${imageType}. Inténtalo de nuevo.`;
      
    throw new Error(errorMessage);
  }
}; 