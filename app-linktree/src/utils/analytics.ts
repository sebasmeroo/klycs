import { logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { analytics } from '../firebase/config';

/**
 * Registra una vista de perfil de usuario
 */
export const trackProfileView = (username: string, cardId?: string) => {
  try {
    logEvent(analytics, 'profile_view', {
      profile_username: username,
      card_id: cardId || 'main',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al registrar vista de perfil en Analytics:', error);
  }
};

/**
 * Registra un clic en un enlace
 */
export const trackLinkClick = (linkData: {
  id: string;
  title: string;
  url: string;
  profileId?: string;
  cardId?: string;
}) => {
  try {
    const { id, title, url, profileId, cardId } = linkData;
    logEvent(analytics, 'link_click', {
      link_id: id,
      link_title: title,
      link_url: url,
      profile_id: profileId || '',
      card_id: cardId || '',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al registrar clic de enlace en Analytics:', error);
  }
};

/**
 * Registra la creación o edición de un enlace
 */
export const trackLinkCreated = (linkData: {
  id: string;
  title: string;
  userId: string;
}) => {
  try {
    logEvent(analytics, 'link_created', {
      link_id: linkData.id,
      link_title: linkData.title,
      user_id: linkData.userId
    });
  } catch (error) {
    console.error('Error al registrar creación de enlace en Analytics:', error);
  }
};

/**
 * Identifica al usuario en Analytics
 */
export const identifyUser = (userId: string, userData?: Record<string, any>) => {
  try {
    // Establecer el ID de usuario
    setUserId(analytics, userId);
    
    // Establecer propiedades de usuario si están disponibles
    if (userData) {
      setUserProperties(analytics, {
        account_type: userData.accountType || 'free',
        username: userData.username || '',
        user_role: userData.role || 'user',
        has_profile: !!userData.username,
        links_count: userData.links?.length || 0,
        products_count: userData.products?.length || 0,
        cards_count: userData.cards?.length || 0
      });
    }
  } catch (error) {
    console.error('Error al identificar usuario en Analytics:', error);
  }
};

/**
 * Registra vista de página
 */
export const trackPageView = (pageName: string, additionalParams?: Record<string, any>) => {
  try {
    logEvent(analytics, 'page_view', {
      page_name: pageName,
      page_path: window.location.pathname,
      ...additionalParams
    });
  } catch (error) {
    console.error('Error al registrar vista de página en Analytics:', error);
  }
};

/**
 * Registra interacción con producto
 */
export const trackProductInteraction = (action: 'view' | 'click' | 'purchase', productData: {
  id: string;
  name: string;
  price?: number;
  profileId?: string;
}) => {
  try {
    const { id, name, price, profileId } = productData;
    logEvent(analytics, `product_${action}`, {
      product_id: id,
      product_name: name,
      product_price: price || 0,
      profile_id: profileId || '',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error al registrar ${action} de producto en Analytics:`, error);
  }
}; 