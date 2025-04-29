/**
 * Genera una URL automática amigable para compartir basada en el título de la tarjeta y el nombre de usuario
 * Elimina caracteres especiales y espacios para crear un slug válido
 */
export const generateAutoUrl = (title: string, username: string): string => {
  const safeTitle = title || 'card';
  const safeUsername = username || 'usuario';
  
  // Convertir a minúsculas y eliminar caracteres especiales
  const slug = safeTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Crear URL con el formato: /usuario/nombre-de-tarjeta
  return `/profile/${safeUsername}/${slug}`;
}; 