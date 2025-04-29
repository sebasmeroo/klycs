import { collection, addDoc, Timestamp, doc, getDoc, updateDoc, increment, setDoc, arrayUnion, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logEvent } from 'firebase/analytics';
import { analytics } from '../firebase/config';

// Definición de tipo para los datos de visitantes activos
interface ViewerData {
  id: string;
  expiresAt?: { seconds: number; nanoseconds: number };
  cardId?: string;
  [key: string]: any;
}

/**
 * Servicio para manejar operaciones de analíticas
 */
export const AnalyticsService = {
  /**
   * Obtiene o genera un identificador único de visitante
   * @returns ID único del visitante
   */
  getVisitorId(): string {
    // Intentar obtener el ID existente del almacenamiento local
    let visitorId = localStorage.getItem('visitorId');
    
    // Si no existe, crear uno nuevo
    if (!visitorId) {
      // Generar un ID único basado en una combinación de timestamp y número aleatorio
      visitorId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('visitorId', visitorId);
    }
    
    return visitorId;
  },

  /**
   * Obtiene información de geolocalización básica basada en IP
   * @returns Promesa con el código de país
   */
  async getGeoInfo(): Promise<string> {
    try {
      // Usar un servicio gratuito de geolocalización por IP
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      return data.country_code || 'unknown';
    } catch (error) {
      console.error('Error al obtener geolocalización:', error);
      return 'unknown';
    }
  },

  /**
   * Registra una nueva vista de perfil
   * @param profileId - ID del perfil visto
   * @param cardId - ID de la tarjeta vista (opcional)
   * @param referer - Sitio de referencia (opcional)
   * @param userAgent - Información del navegador (opcional)
   */
  async recordProfileView(
    profileId: string, 
    cardId?: string, 
    referer?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Extraer información del dispositivo y navegador desde userAgent
      const deviceInfo = this.extractDeviceInfo(userAgent || navigator.userAgent);
      
      // Obtener identificador de visitante único
      const visitorId = this.getVisitorId();
      
      // Obtener información de geolocalización
      const country = await this.getGeoInfo();
      
      // Obtener sesión
      const sessionId = this.getSessionId();
      
      // Crear objeto de vista de perfil
      const viewData = {
        timestamp: Timestamp.now(),
        referer: referer || document.referrer || 'direct',
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        country: country,
        visitorId: visitorId,
        sessionId: sessionId,
        cardId: cardId || 'main'
      };
      
      // 1. Guardar en la colección de analytics del usuario
      const userAnalyticsRef = doc(db, `users/${profileId}/analytics/views`);
      const userAnalyticsDoc = await getDoc(userAnalyticsRef);
      
      if (userAnalyticsDoc.exists()) {
        // Si existe, actualizamos contadores y añadimos a la lista de vistas recientes
        await updateDoc(userAnalyticsRef, {
          totalViews: increment(1),
          recentViews: arrayUnion(viewData),
          [`devices.${deviceInfo.device}`]: increment(1),
          [`browsers.${deviceInfo.browser}`]: increment(1),
          [`countries.${country}`]: increment(1),
          [`referrers.${viewData.referer}`]: increment(1),
          lastUpdated: Timestamp.now()
        });
      } else {
        // Si no existe, creamos el documento con la primera vista
        await setDoc(userAnalyticsRef, {
          totalViews: 1,
          recentViews: [viewData],
          devices: { [deviceInfo.device]: 1 },
          browsers: { [deviceInfo.browser]: 1 },
          countries: { [country]: 1 },
          referrers: { [viewData.referer]: 1 },
          uniqueVisitors: [visitorId],
          lastUpdated: Timestamp.now()
        });
      }
      
      // 2. Si hay una tarjeta específica, registrar datos en esa tarjeta
      if (cardId) {
        const cardAnalyticsRef = doc(db, `users/${profileId}/cards/${cardId}/analytics/views`);
        const cardAnalyticsDoc = await getDoc(cardAnalyticsRef);
        
        if (cardAnalyticsDoc.exists()) {
          await updateDoc(cardAnalyticsRef, {
            totalViews: increment(1),
            recentViews: arrayUnion(viewData),
            [`devices.${deviceInfo.device}`]: increment(1),
            [`browsers.${deviceInfo.browser}`]: increment(1),
            [`countries.${country}`]: increment(1),
            [`referrers.${viewData.referer}`]: increment(1),
            lastUpdated: Timestamp.now()
          });
        } else {
          await setDoc(cardAnalyticsRef, {
            totalViews: 1,
            recentViews: [viewData],
            devices: { [deviceInfo.device]: 1 },
            browsers: { [deviceInfo.browser]: 1 },
            countries: { [country]: 1 },
            referrers: { [viewData.referer]: 1 },
            uniqueVisitors: [visitorId],
            lastUpdated: Timestamp.now()
          });
        }
        
        // Actualizar contador de vistas en la tarjeta
        const cardRef = doc(db, `users/${profileId}/cards/${cardId}`);
        const cardDoc = await getDoc(cardRef);
        
        if (cardDoc.exists()) {
          await updateDoc(cardRef, {
            views: increment(1)
          });
        }
      }
      
      // 3. Registrar visitante activo en tiempo real
      this.registerActiveViewer(profileId, cardId, visitorId, viewData);
      
      // 4. Actualizar contador general en el perfil del usuario
      const profileRef = doc(db, 'users', profileId);
      const profileDoc = await getDoc(profileRef);
      
      if (profileDoc.exists()) {
        await updateDoc(profileRef, {
          totalViews: increment(1),
          lastVisitTime: Timestamp.now()
        });
      }

      // 5. Registrar también en Firebase Analytics para tener datos agregados
      try {
        logEvent(analytics, 'profile_view', {
          profile_id: profileId,
          card_id: cardId || 'main',
          visitor_id: visitorId,
          device: deviceInfo.device,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          country: country,
          timestamp: new Date().toISOString()
        });
      } catch (analyticsError) {
        console.error('Error al registrar en Firebase Analytics:', analyticsError);
      }
    } catch (error) {
      console.error('Error al registrar vista de perfil:', error);
    }
  },
  
  /**
   * Registra un nuevo clic en un enlace
   * @param profileId - ID del perfil
   * @param cardId - ID de la tarjeta
   * @param linkId - ID del enlace
   * @param linkUrl - URL del enlace
   * @param linkTitle - Título del enlace (opcional)
   */
  async recordLinkClick(
    profileId: string,
    cardId: string,
    linkId: string,
    linkUrl: string,
    linkTitle?: string
  ): Promise<void> {
    try {
      // Extraer información del dispositivo
      const deviceInfo = this.extractDeviceInfo(navigator.userAgent);
      
      // Obtener identificador de visitante único
      const visitorId = this.getVisitorId();
      
      // Obtener información de geolocalización
      const country = await this.getGeoInfo();
      
      // Obtener sesión
      const sessionId = this.getSessionId();
      
      // Crear objeto de clic
      const clickData = {
        linkId,
        linkUrl,
        linkTitle: linkTitle || '',
        timestamp: Timestamp.now(),
        referer: document.referrer || 'direct',
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        country: country,
        visitorId: visitorId,
        sessionId: sessionId,
        cardId: cardId
      };
      
      // 1. Guardar en la colección de analytics de clicks del usuario
      const userClicksRef = doc(db, `users/${profileId}/analytics/clicks`);
      const userClicksDoc = await getDoc(userClicksRef);
      
      if (userClicksDoc.exists()) {
        await updateDoc(userClicksRef, {
          totalClicks: increment(1),
          recentClicks: arrayUnion(clickData),
          [`links.${linkId}.clicks`]: increment(1),
          [`links.${linkId}.title`]: linkTitle || '',
          [`links.${linkId}.url`]: linkUrl,
          lastUpdated: Timestamp.now()
        });
      } else {
        await setDoc(userClicksRef, {
          totalClicks: 1,
          recentClicks: [clickData],
          links: {
            [linkId]: {
              clicks: 1,
              title: linkTitle || '',
              url: linkUrl
            }
          },
          lastUpdated: Timestamp.now()
        });
      }
      
      // 2. Guardar en la colección de analytics de clicks de la tarjeta
      const cardClicksRef = doc(db, `users/${profileId}/cards/${cardId}/analytics/clicks`);
      const cardClicksDoc = await getDoc(cardClicksRef);
      
      if (cardClicksDoc.exists()) {
        await updateDoc(cardClicksRef, {
          totalClicks: increment(1),
          recentClicks: arrayUnion(clickData),
          [`links.${linkId}.clicks`]: increment(1),
          [`links.${linkId}.title`]: linkTitle || '',
          [`links.${linkId}.url`]: linkUrl,
          lastUpdated: Timestamp.now()
        });
      } else {
        await setDoc(cardClicksRef, {
          totalClicks: 1,
          recentClicks: [clickData],
          links: {
            [linkId]: {
              clicks: 1,
              title: linkTitle || '',
              url: linkUrl
            }
          },
          lastUpdated: Timestamp.now()
        });
      }
      
      // 3. Registrar también en Firebase Analytics
      try {
        logEvent(analytics, 'link_click', {
          profile_id: profileId,
          card_id: cardId,
          link_id: linkId,
          link_url: linkUrl,
          link_title: linkTitle || '',
          visitor_id: visitorId,
          device: deviceInfo.device,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          country: country,
          timestamp: new Date().toISOString()
        });
      } catch (analyticsError) {
        console.error('Error al registrar en Firebase Analytics:', analyticsError);
      }
    } catch (error) {
      console.error('Error al registrar clic de enlace:', error);
    }
  },
  
  /**
   * Registra un visitante activo en tiempo real
   * @param profileId - ID del perfil
   * @param cardId - ID de la tarjeta (opcional)
   * @param visitorId - ID del visitante
   * @param viewData - Datos adicionales de la visita
   */
  async registerActiveViewer(
    profileId: string,
    cardId: string | undefined,
    visitorId: string,
    viewData: any
  ): Promise<void> {
    try {
      const timestamp = Timestamp.now();
      const activeViewerRef = doc(db, `users/${profileId}/activeViewers/${visitorId}`);
      
      // Guardar información del espectador activo
      await setDoc(activeViewerRef, {
        ...viewData,
        lastActive: timestamp,
        cardId: cardId || 'profile',
        // Establecer tiempo de expiración (2 minutos después)
        expiresAt: new Timestamp(
          timestamp.seconds + 120, // 2 minutos
          timestamp.nanoseconds
        )
      });
      
      // Configurar heartbeat para mantener activo mientras esté en la página
      this.setupHeartbeat(profileId, visitorId, cardId);
      
    } catch (error) {
      console.error('Error al registrar visitante activo:', error);
    }
  },
  
  /**
   * Configura un latido periódico para mantener el estado activo
   * @param profileId - ID del perfil
   * @param visitorId - ID del visitante
   * @param cardId - ID de la tarjeta (opcional)
   */
  setupHeartbeat(profileId: string, visitorId: string, cardId?: string): void {
    // Variable global para el intervalo
    let intervalId: number;
    
    // Función para actualizar el tiempo activo
    const updateActiveTime = async () => {
      try {
        const timestamp = Timestamp.now();
        const activeViewerRef = doc(db, `users/${profileId}/activeViewers/${visitorId}`);
        
        await updateDoc(activeViewerRef, {
          lastActive: timestamp,
          expiresAt: new Timestamp(
            timestamp.seconds + 120, // 2 minutos
            timestamp.nanoseconds
          )
        });
      } catch (error) {
        console.error('Error en heartbeat:', error);
        if (intervalId) window.clearInterval(intervalId);
      }
    };
    
    // Establecer intervalo cada 30 segundos
    intervalId = window.setInterval(updateActiveTime, 30000);
    
    // Cuando la ventana se cierra, eliminar al visitante activo
    window.addEventListener('beforeunload', async () => {
      try {
        if (intervalId) window.clearInterval(intervalId);
        
        const activeViewerRef = doc(db, `users/${profileId}/activeViewers/${visitorId}`);
        // Opción 1: Eliminar el documento
        await deleteDoc(activeViewerRef);
        
        // Opción 2: Marcar como inactivo (descomentarlo si prefieres esta opción)
        // await setDoc(activeViewerRef, { 
        //   active: false,
        //   leftAt: Timestamp.now() 
        // }, { merge: true });
      } catch (error) {
        console.error('Error al limpiar visitante activo:', error);
      }
    });
  },
  
  /**
   * Suscribe a los visitantes activos en tiempo real
   * @param profileId - ID del perfil
   * @param cardId - ID de la tarjeta (opcional)
   * @param callback - Función para procesar los datos recibidos
   * @returns Una función para cancelar la suscripción
   */
  subscribeToActiveViewers(
    profileId: string,
    cardId: string | null,
    callback: (viewers: any[]) => void
  ): () => void {
    // Crear referencia a la colección de visitantes activos
    const activeViewersRef = collection(db, `users/${profileId}/activeViewers`);
    
    // Crear suscripción en tiempo real
    const unsubscribe = onSnapshot(activeViewersRef, (snapshot) => {
      // Filtrar por tarjeta si es necesario y procesar datos
      const viewers = snapshot.docs
        .map(doc => {
          return {
            id: doc.id,
            ...doc.data()
          } as ViewerData;
        })
        .filter(viewer => {
          const now = Timestamp.now().seconds;
          const expiresAt = viewer.expiresAt?.seconds || 0;
          
          // Filtrar por cardId si es necesario
          const cardMatch = cardId ? viewer.cardId === cardId : true;
          
          // Solo incluir si no ha expirado y coincide con la tarjeta
          return expiresAt > now && cardMatch;
        });
      
      // Enviar datos filtrados a la callback
      callback(viewers);
    }, (error) => {
      console.error("Error en suscripción a visitantes activos:", error);
    });
    
    // Devolver función para cancelar suscripción
    return unsubscribe;
  },
  
  /**
   * Obtiene las métricas de analytics para un usuario o tarjeta
   * @param profileId - ID del perfil
   * @param cardId - ID de la tarjeta (opcional)
   * @returns Promesa con los datos de analytics
   */
  async getAnalytics(profileId: string, cardId?: string): Promise<any> {
    try {
      // Determinar si buscamos métricas de usuario o de tarjeta
      const analyticsPath = cardId
        ? `users/${profileId}/cards/${cardId}/analytics`
        : `users/${profileId}/analytics`;
      
      // Obtener vistas
      const viewsRef = doc(db, `${analyticsPath}/views`);
      const viewsDoc = await getDoc(viewsRef);
      
      // Obtener clics
      const clicksRef = doc(db, `${analyticsPath}/clicks`);
      const clicksDoc = await getDoc(clicksRef);
      
      // Construir y devolver objeto con datos
      return {
        views: viewsDoc.exists() ? viewsDoc.data() : { totalViews: 0 },
        clicks: clicksDoc.exists() ? clicksDoc.data() : { totalClicks: 0 },
        conversionRate: this.calculateConversionRate(viewsDoc.data(), clicksDoc.data())
      };
    } catch (error) {
      console.error('Error al obtener datos de analytics:', error);
      return {
        views: { totalViews: 0 },
        clicks: { totalClicks: 0 },
        conversionRate: 0
      };
    }
  },
  
  /**
   * Calcula la tasa de conversión basada en vistas y clics
   * @param viewsData - Datos de vistas
   * @param clicksData - Datos de clics
   * @returns Tasa de conversión en porcentaje
   */
  calculateConversionRate(viewsData: any, clicksData: any): number {
    const totalViews = viewsData?.totalViews || 0;
    const totalClicks = clicksData?.totalClicks || 0;
    
    if (totalViews === 0) return 0;
    
    return Math.round((totalClicks / totalViews) * 100);
  },
  
  /**
   * Genera un ID de sesión único
   * @returns ID de sesión
   */
  getSessionId(): string {
    // Comprobar si ya tenemos un ID de sesión para esta sesión
    let sessionId = sessionStorage.getItem('sessionId');
    
    // Si no existe, crear uno nuevo
    if (!sessionId) {
      sessionId = `session_${Date.now()}`;
      sessionStorage.setItem('sessionId', sessionId);
    }
    
    return sessionId;
  },

  /**
   * Extrae información del dispositivo a partir del user agent
   * @param userAgent - String del user agent
   */
  extractDeviceInfo(userAgent: string): { device: string; browser: string; os: string } {
    const ua = userAgent.toLowerCase();
    
    // Detectar dispositivo
    let device = 'desktop';
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      device = 'tablet';
    } else if (
      /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)
    ) {
      device = 'mobile';
    }
    
    // Detectar navegador
    let browser = 'other';
    if (ua.indexOf('firefox') > -1) {
      browser = 'firefox';
    } else if (ua.indexOf('edg') > -1 || ua.indexOf('edge') > -1) {
      browser = 'edge';
    } else if (ua.indexOf('chrome') > -1) {
      browser = 'chrome';
    } else if (ua.indexOf('safari') > -1) {
      browser = 'safari';
    } else if (ua.indexOf('opera') > -1 || ua.indexOf('opr') > -1) {
      browser = 'opera';
    } else if (ua.indexOf('msie') > -1 || ua.indexOf('trident') > -1) {
      browser = 'ie';
    }
    
    // Detectar sistema operativo
    let os = 'other';
    if (ua.indexOf('windows') > -1) {
      os = 'windows';
    } else if (ua.indexOf('mac') > -1) {
      os = 'mac';
    } else if (ua.indexOf('linux') > -1) {
      os = 'linux';
    } else if (ua.indexOf('android') > -1) {
      os = 'android';
    } else if (ua.indexOf('ios') > -1 || /(ipad|iphone|ipod)/i.test(ua)) {
      os = 'ios';
    }
    
    return { device, browser, os };
  }
};

export default AnalyticsService; 