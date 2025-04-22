import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';

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