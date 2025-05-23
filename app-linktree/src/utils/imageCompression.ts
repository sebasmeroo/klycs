import imageCompression from 'browser-image-compression';

// Configuración predeterminada similar a Instagram/redes sociales
const defaultOptions = {
  maxSizeMB: 0.7,                   // Máximo 700KB
  maxWidthOrHeight: 1440,           // Límite de resolución (redes sociales)
  useWebWorker: true,               // Usa Web Worker para no bloquear UI
  fileType: 'image/webp',           // Convertir a WebP por mejor compresión
  initialQuality: 0.85,             // 85% calidad (buena calidad visual)
  alwaysKeepResolution: true,       // Preservar resolución original
  preserveExif: false               // Eliminar metadatos para reducir tamaño
};

// Configuración optimizada para imágenes de fondo
const backgroundImageOptions = {
  maxSizeMB: 1.2,                   // Permitir imágenes más grandes para fondos
  maxWidthOrHeight: 1920,           // Mayor resolución para fondos
  useWebWorker: true,
  fileType: 'image/webp',
  initialQuality: 0.82,             // Ligera reducción de calidad
  alwaysKeepResolution: false,      // Permitir redimensionar para fondos grandes
  preserveExif: false
};

// Configuración optimizada para fotos de perfil/avatar
const profileImageOptions = {
  maxSizeMB: 0.5,                   // Tamaño pequeño para avatares (500KB)
  maxWidthOrHeight: 500,            // Resolución suficiente para avatares
  useWebWorker: true,
  fileType: 'image/webp',
  initialQuality: 0.9,              // Alta calidad para rostros
  alwaysKeepResolution: false,      // Permitir redimensionar
  preserveExif: false
};

// Configuración optimizada para imágenes de productos
const productImageOptions = {
  maxSizeMB: 0.8,                   // Equilibrio tamaño/calidad para productos
  maxWidthOrHeight: 1200,           // Buena resolución para detalles de productos
  useWebWorker: true,
  fileType: 'image/webp',
  initialQuality: 0.88,             // Alta calidad para mostrar detalles del producto
  alwaysKeepResolution: false,      // Permitir redimensionar
  preserveExif: false
};

// Interfaz para el resultado del procesamiento
export interface CompressionResult {
  file: File;                       // Archivo comprimido
  originalSize: number;             // Tamaño original en bytes
  compressedSize: number;           // Tamaño comprimido en bytes
  originalFormat: string;           // Formato original (JPEG, PNG, etc.)
  compressedFormat: string;         // Formato comprimido (WebP)
  compressionRatio: number;         // Porcentaje de reducción
  infoText: string;                 // Texto formateado para mostrar
  success: boolean;                 // Indica si la compresión fue exitosa
}

// Tipo para el estado de compresión en componentes
export type CompressionStatus = 'idle' | 'compressing' | 'success' | 'error';

/**
 * Comprime una imagen y la convierte a WebP
 * @param file Archivo de imagen original
 * @param customOptions Opciones personalizadas (opcional)
 * @returns Resultado de la compresión con estadísticas
 */
export const compressImage = async (
  file: File,
  customOptions?: Partial<typeof defaultOptions>
): Promise<CompressionResult> => {
  try {
    const options = { ...defaultOptions, ...customOptions };
    
    // Obtener información del archivo original
    const originalSize = file.size;
    const originalFormat = file.type.split('/')[1].toUpperCase();
    
    // Comprimir imagen
    const compressedFile = await imageCompression(file, options);
    
    // Calcular estadísticas
    const compressedSize = compressedFile.size;
    const compressionRatio = (100 - (compressedSize * 100 / originalSize));
    
    // Formatear información para mostrar
    const infoText = `✅ Original: ${formatFileSize(originalSize)} (${originalFormat}) → 
                      Comprimido: ${formatFileSize(compressedSize)} (WEBP) - 
                      Reducción: ${compressionRatio.toFixed(1)}%`;
    
    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      originalFormat,
      compressedFormat: 'WEBP',
      compressionRatio,
      infoText,
      success: true
    };
  } catch (error) {
    console.error('Error al comprimir imagen:', error);
    
    // En caso de error, devolver el archivo original con información de error
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      originalFormat: file.type.split('/')[1].toUpperCase(),
      compressedFormat: file.type.split('/')[1].toUpperCase(),
      compressionRatio: 0,
      infoText: `⚠️ No se pudo comprimir. Usando archivo original (${formatFileSize(file.size)})`,
      success: false
    };
  }
};

/**
 * Comprime una imagen de fondo optimizada para visualización como background
 * @param file Archivo de imagen original
 * @param customOptions Opciones personalizadas (opcional)
 * @returns Resultado de la compresión con estadísticas
 */
export const compressBackgroundImage = async (
  file: File,
  customOptions?: Partial<typeof backgroundImageOptions>
): Promise<CompressionResult> => {
  // Utilizar la configuración específica para imágenes de fondo
  return compressImage(file, { ...backgroundImageOptions, ...customOptions });
};

/**
 * Comprime una imagen de perfil/avatar optimizada para visualización de rostros
 * @param file Archivo de imagen original
 * @param customOptions Opciones personalizadas (opcional)
 * @returns Resultado de la compresión con estadísticas
 */
export const compressProfileImage = async (
  file: File,
  customOptions?: Partial<typeof profileImageOptions>
): Promise<CompressionResult> => {
  // Utilizar la configuración específica para imágenes de perfil
  return compressImage(file, { ...profileImageOptions, ...customOptions });
};

/**
 * Comprime una imagen de producto optimizada para visualización de detalles
 * @param file Archivo de imagen original
 * @param customOptions Opciones personalizadas (opcional)
 * @returns Resultado de la compresión con estadísticas
 */
export const compressProductImage = async (
  file: File,
  customOptions?: Partial<typeof productImageOptions>
): Promise<CompressionResult> => {
  // Utilizar la configuración específica para imágenes de productos
  return compressImage(file, { ...productImageOptions, ...customOptions });
};

/**
 * Genera una URL de datos (base64) para previsualizar una imagen
 */
export const getImagePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Formatea el tamaño de archivo en KB o MB según corresponda
 * @param bytes Tamaño en bytes
 * @returns Tamaño formateado con unidad
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// Placeholder para futura implementación de compresión de video
export const compressVideo = async (file: File): Promise<File> => {
  // Esta función se implementará en el futuro
  console.warn('La compresión de video aún no está implementada. Usando archivo original.');
  return file;
}; 