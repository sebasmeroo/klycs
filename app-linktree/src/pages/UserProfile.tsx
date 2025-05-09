import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, increment, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
// import UserCard from '../components/cardeditor/cardpreviewanduser/user/UserCard'; // Eliminado
import { CardLink as LinkType, Product as ProductType, TemplateType, BookingSettings, CardSectionType, CARD_SECTION_TYPES, Card } from '../components/cardeditor/types'; // Asegurado: CardSectionType, CARD_SECTION_TYPES, y Card (que debe tener sectionOrder)
// import { LinkButton, UserLinksContainer } from '../components/cardeditor/cardpreviewanduser/userlink'; // Eliminado
import NotFound from './NotFound';
// import CardPreview from '../components/cardeditor/cardpreviewanduser/CardPreview/CardPreview'; // Eliminado
import './UserProfile.css'; // Importar el archivo CSS
import { FiMenu, FiHome, FiShoppingBag } from 'react-icons/fi';
import BookingForm from '../components/booking/BookingForm'; // Importar BookingForm
import CardCoverImage from '../components/profile/CardCoverImage'; // NUEVO: Importar el componente
import UserProfileHeader from '../components/profile/UserProfileHeader'; // NUEVO: Importar
import CardTitle from '../components/profile/CardTitle'; // NUEVO: Importar
import CardDescription from '../components/profile/CardDescription'; // NUEVO: Importar
import CardLinksList from '../components/profile/CardLinksList'; // NUEVO: Importar
import CardProductsGrid from '../components/profile/CardProductsGrid'; // NUEVO: Importar
import PremiumCoverSlider, { CoverMediaItem } from '../components/profile/PremiumCoverSlider'; // IMPORTADO
// import { fetchLinksForUser } from '../services/linkService'; // Comentado temporalmente

// URLs para imágenes de respaldo seguras
const FALLBACK_IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/klycs-58190.appspot.com/o/defaults%2Fno-image.png?alt=media';
const FALLBACK_PRODUCT_IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/klycs-58190.appspot.com/o/defaults%2Fproduct-placeholder.png?alt=media';

// Interfaz para los datos iniciales pasados del inline al modal
interface InitialBookingData {
  date?: string;
  time?: string;
  serviceId?: string;
}

// Interfaz para los datos de tarjeta que usaremos para renderizar
// Se usará la interfaz Card importada de types.ts, que ya debe incluir sectionOrder
interface CardData extends Card { // EXTENDEMOS de Card para heredar sectionOrder y otros campos base
  // UserProfile puede tener campos adicionales o variaciones si es necesario,
  // pero los campos comunes deben venir de la interfaz Card.
  // Por ejemplo, si CardData aquí necesita más campos que la Card base:
  // customFieldForUserProfile?: string;
  isPremiumUser?: boolean;
  coverMediaItems?: CoverMediaItem[];
  // Reforzar tipos aquí localmente si el linter sigue sin verlos desde Card
  avatarUrl?: string | null; 
  displayName?: string | null;
  bio?: string | null;
  coverImageUrl?: string | null; 
}

// Importar CSS de plantillas
import '../components/cardeditor/templates/CommonTemplate.css';
import '../components/cardeditor/templates/basic/BasicTemplate.css';
import '../components/cardeditor/templates/link/LinkTemplate.css';
import '../components/cardeditor/templates/shop/ShopTemplate.css';

// Orden por defecto para las secciones en UserProfile
const DEFAULT_USER_PROFILE_SECTION_ORDER: CardSectionType[] = ['header', 'image', 'description', 'links', 'products', 'booking'];

// NUEVO: Mapeo de etiquetas (opcional, pero útil para depuración o futura UI)
const sectionLabelsForUserProfile: Record<CardSectionType, string> = {
  userProfileInfo: 'Información de Perfil',
  header: 'Título de Tarjeta',
  image: 'Imagen Principal',
  coverSlider: 'Carrusel Portada',
  description: 'Descripción',
  links: 'Enlaces',
  products: 'Productos',
  booking: 'Reservas'
};

const UserProfile: React.FC = () => {
  // Extraer parámetros de la URL
  const params = useParams();
  const username = params.username;
  const cardIdFromParams = params.cardId;
  const productId = params.productId;
  
  // Añadir logs para diagnosticar problemas
  console.log("URL completa:", window.location.href);
  console.log("Todos los parámetros:", params);
  console.log("Username:", username);
  console.log("Card ID from Params:", cardIdFromParams);
  console.log("Product ID:", productId);
  
  const [user, setUser] = useState<any | null>(null);
  const [singleCard, setSingleCard] = useState<CardData | null>(null);
  const [singleProduct, setSingleProduct] = useState<any | null>(null);
  const [primaryCard, setPrimaryCard] = useState<CardData | null>(null); // Mantener estado
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({}); // Estado para imágenes fallidas
  const [failedMedia, setFailedMedia] = useState<Record<string, boolean>>({});
  // Ref para scroll a productos destacados
  const featuredRef = useRef<HTMLDivElement>(null);

  // NUEVO: Estados para links y productos cargados desde subcolecciones
  const [links, setLinks] = useState<LinkType[]>([]);
  const [cardProducts, setCardProducts] = useState<ProductType[]>([]);

  // *** Estados para controlar el flujo inline -> modal ***
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false); 
  const [inlineBookingData, setInlineBookingData] = useState<InitialBookingData | null>(null);

  // NUEVO: Función para cargar enlaces de una tarjeta
  const fetchLinksForCard = async (cardIdToFetch: string) => {
    try {
      const linksRef = collection(db, 'cards', cardIdToFetch, 'links');
      const linksQuery = query(linksRef, orderBy('order', 'asc')); // Asumiendo que tienes un campo 'order'
      const linksSnapshot = await getDocs(linksQuery);
      const fetchedLinks = linksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LinkType));
      setLinks(fetchedLinks);
      console.log(`Enlaces cargados para ${cardIdToFetch}:`, fetchedLinks.length);
    } catch (linkError) {
      console.error("Error cargando enlaces desde subcolección en UserProfile:", linkError);
      setLinks([]); // Limpiar en caso de error
    }
  };

  // NUEVO: Función para cargar productos de una tarjeta
  const fetchProductsForCard = async (cardIdToFetch: string, cardOwnerId: string) => {
    try {
      const associatedProductsRef = collection(db, 'cards', cardIdToFetch, 'cardProducts');
      const associatedProductsQuery = query(associatedProductsRef, orderBy('order', 'asc')); // Asumiendo campo 'order'
      const associatedProductsSnapshot = await getDocs(associatedProductsQuery);
      
      const productIdsToFetch = associatedProductsSnapshot.docs.map(doc => doc.data().productId as string);

      if (productIdsToFetch.length > 0) {
        const userProductsRef = collection(db, 'users', cardOwnerId, 'products');
        // Firestore 'in' query tiene un límite de 30 elementos a la vez (antes era 10)
        // Si esperas más de 30 productos por tarjeta, necesitarás paginar esta consulta.
        const productDetailsQuery = query(userProductsRef, where('__name__', 'in', productIdsToFetch.slice(0, 30)));
        const productDetailsSnapshot = await getDocs(productDetailsQuery);
        
        const productDetailsMap = new Map<string, ProductType>();
        productDetailsSnapshot.docs.forEach(doc => {
          productDetailsMap.set(doc.id, { id: doc.id, ...doc.data() } as ProductType);
        });
        
        const fetchedCardProducts = associatedProductsSnapshot.docs.map(assocDoc => {
          const assocProductId = assocDoc.data().productId;
          return productDetailsMap.get(assocProductId);
        }).filter((p): p is ProductType => p !== undefined);
        
        setCardProducts(fetchedCardProducts);
        console.log(`Productos asociados cargados para ${cardIdToFetch}:`, fetchedCardProducts.length);
      } else {
        setCardProducts([]);
        console.log(`No hay productos asociados para ${cardIdToFetch}`);
      }
    } catch (productError) {
      console.error("Error cargando productos asociados en UserProfile:", productError);
      setCardProducts([]); // Limpiar en caso de error
    }
  };

  useEffect(() => {
    const fetchUserProfileAndCard = async () => {
      setLoading(true);
      setError(null);
      setUser(null);
      setSingleCard(null);
      setPrimaryCard(null);
      setLinks([]); // NUEVO: Resetear links
      setCardProducts([]); // NUEVO: Resetear productos

      if (!username) {
        setError('Usuario no especificado');
        setLoading(false);
        return;
      }

      try {
        let userId: string | null = null;
        let fetchedUserData: any = null;

        const usersRef = collection(db, 'users');
        const qUsername = query(usersRef, where('username', '==', username));
        const usernameSnapshot = await getDocs(qUsername);

        if (!usernameSnapshot.empty) {
          fetchedUserData = usernameSnapshot.docs[0].data();
          userId = usernameSnapshot.docs[0].id;
        } else {
          try {
            const userDocRef = doc(db, 'users', username);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              fetchedUserData = userDoc.data();
              userId = username;
            } else {
              setError('Usuario no encontrado'); setLoading(false); return;
            }
          } catch (uidError) {
            setError('Error al buscar usuario'); setLoading(false); return;
          }
        }

        setUser({ ...fetchedUserData, uid: userId });

        if (cardIdFromParams) {
          console.log(`Intentando cargar tarjeta específica con ID: ${cardIdFromParams}`);
          const cardDocRef = doc(db, 'cards', cardIdFromParams);
          const cardDoc = await getDoc(cardDocRef);

          if (cardDoc.exists()) {
            const cardData = cardDoc.data() as CardData;
            if (cardData.userId === userId) {
              console.log('Tarjeta específica encontrada y pertenece al usuario:', cardData);
              setSingleCard({ ...cardData, id: cardIdFromParams });
              // NUEVO: Cargar links y productos para esta tarjeta
              await fetchLinksForCard(cardIdFromParams);
              if (userId) await fetchProductsForCard(cardIdFromParams, userId);
              
              try {
                await updateDoc(cardDocRef, { views: increment(1) });
                const analyticsRef = collection(db, 'cards', cardIdFromParams, 'analyticsEvents');
                await addDoc(analyticsRef, { type: 'view', timestamp: serverTimestamp(), userAgent: navigator.userAgent || null });
                console.log(`Vista registrada para la tarjeta: ${cardIdFromParams}`);
              } catch (analyticsError) {
                console.error("Error al registrar la vista:", analyticsError);
              }
            } else {
              setError('Tarjeta no encontrada o no pertenece a este usuario.'); setLoading(false); return;
            }
          } else {
            setError('Tarjeta no encontrada.'); setLoading(false); return;
          }
        } else if (!productId && userId) { // MODIFICADO: Asegurar que userId exista para buscar la tarjeta principal
           console.log('Buscando tarjeta principal para el usuario:', userId);
           // Lógica para determinar la tarjeta principal (simplificada para el ejemplo)
           // Esta lógica puede necesitar ser más robusta, por ejemplo, consultando la colección /cards
           // directamente, filtrando por userId y ordenando por un campo 'isPrimary' o 'lastUpdate'.
           // Por ahora, usaremos una consulta directa si no está en fetchedUserData.cards
           const cardsQuery = query(collection(db, 'cards'), where('userId', '==', userId), orderBy('lastUpdate', 'desc'), orderBy('createdAt', 'desc'));
           const userCardsSnapshot = await getDocs(cardsQuery);
           let cardToDisplay: CardData | null = null;

           if (!userCardsSnapshot.empty) {
             // Aquí podrías tener lógica para elegir la "principal" si hay varias
             // Por ejemplo, la más actualizada o una marcada como principal.
             // Tomaremos la primera por ahora.
             const primaryCardDoc = userCardsSnapshot.docs[0];
             cardToDisplay = { id: primaryCardDoc.id, ...primaryCardDoc.data() } as CardData;
           }

           if (cardToDisplay) {
              console.log('Tarjeta principal encontrada:', cardToDisplay);
              setPrimaryCard(cardToDisplay);
              // NUEVO: Cargar links y productos para la tarjeta principal
              await fetchLinksForCard(cardToDisplay.id);
              await fetchProductsForCard(cardToDisplay.id, userId); // userId ya está verificado arriba
           } else {
              console.log('No se encontró tarjeta principal para el usuario.');
           }
        } else if (productId) {
          console.log("Cargando producto específico (lógica pendiente si se necesita)");
        }

      } catch (err: any) {
        console.error("Error completo en fetchUserProfileAndCard:", err);
        setError('Ocurrió un error al cargar el perfil.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfileAndCard();

    // No necesitamos el listener de actualizaciones aquí si la carga es directa

  }, [username, cardIdFromParams, productId]); // Quitar lastUpdate de dependencias

  // --- useEffect para comprobar actualizaciones ---
  useEffect(() => {
    const cardToCheck = singleCard || primaryCard; // Usar la tarjeta relevante
    if (cardToCheck && !loading) {
      const checkForUpdates = async () => {
        try {
          console.log("Verificando actualizaciones para la tarjeta:", cardToCheck.id);
          
          // Verificar en la colección de tarjetas primero
          const cardDoc = await getDoc(doc(db, 'cards', cardToCheck.id));
          
          let newUpdate = false;
          let updateTimestamp = 0;
          
          if (cardDoc.exists()) {
            const cardData = cardDoc.data();
            
            // Si hay una marca de tiempo y es más reciente que la última conocida
            if (cardData.lastUpdate && cardData.lastUpdate > lastUpdate) {
              console.log("Se encontró una actualización más reciente en colección cards:", cardData.lastUpdate);
              updateTimestamp = cardData.lastUpdate;
              newUpdate = true;
            }
          }
          
          // Si no se encontró actualización en la colección cards, verificar en el usuario
          if (!newUpdate) {
            // Obtener el documento del usuario
            if (username) {
              // Buscar al usuario por username
              const usersRef = collection(db, 'users');
              const q = query(usersRef, where('username', '==', username));
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                const userData = querySnapshot.docs[0].data();
                
                // Verificar si existe la marca de tiempo para esta tarjeta
                if (userData.cardUpdates && userData.cardUpdates[cardToCheck.id]) {
                  const userUpdateTimestamp = userData.cardUpdates[cardToCheck.id];
                  
                  if (userUpdateTimestamp > lastUpdate) {
                    console.log("Se encontró una actualización más reciente en documento de usuario:", userUpdateTimestamp);
                    updateTimestamp = userUpdateTimestamp;
                    newUpdate = true;
                  }
                }
              }
            }
          }
          
          // Si encontramos una actualización más reciente, forzar una recarga
          if (newUpdate && updateTimestamp > 0) {
            console.log("Actualizando vista con nueva marca de tiempo:", updateTimestamp);
            setLastUpdate(updateTimestamp);
          }
        } catch (error) {
          console.warn("Error al verificar actualizaciones:", error);
        }
      };
      
      // Ejecutar inmediatamente y luego cada 10 segundos
      const intervalId = setInterval(checkForUpdates, 10000);
      checkForUpdates(); // Ejecutar inmediatamente al montar
      
      // Limpiar el intervalo cuando el componente se desmonte
      return () => clearInterval(intervalId);
    }
  }, [singleCard, primaryCard, loading, lastUpdate, username]); // Fin useEffect updates

  // --- Funciones auxiliares (handleImageError, getBackgroundStyle, isDarkBackground) ---
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, imageId: string, fallbackUrl: string) => {
      const imgElement = e.target as HTMLImageElement;
      if (failedImages[imageId]) {
          imgElement.onerror = null; imgElement.src = ''; imgElement.style.display = 'none'; return;
      }
      setFailedImages(prev => ({ ...prev, [imageId]: true }));
      imgElement.src = fallbackUrl;
      imgElement.classList.add('fallback-image');
  };

  const getBackgroundStyle = (cardData: CardData | null): React.CSSProperties => {
    if (!cardData) return {};
    if (cardData.backgroundType === 'color') return { backgroundColor: cardData.backgroundColor || '#ffffff' };
    if (cardData.backgroundType === 'gradient') return { background: cardData.backgroundGradient || 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)' };
    if (cardData.backgroundType === 'image' && cardData.backgroundImageURL) return {
        backgroundImage: `url(${cardData.backgroundImageURL})`,
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'
    };
    return {};
  };

  const isDarkBackground = (cardData: CardData | null): boolean => {
      if (!cardData) return false;
      if (cardData.backgroundType === 'gradient' || cardData.backgroundType === 'image') return true;
      if (cardData.backgroundType === 'color' && cardData.backgroundColor) {
          const hex = cardData.backgroundColor.replace('#', '');
          if (hex.length !== 6) return false; // Manejar hex inválido
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);
          return (r * 0.299 + g * 0.587 + b * 0.114) < 186;
      }
      return false;
  };

  // --- Función callback para el formulario inline --- 
  const handleInlineBookingComplete = (data: { date: string; time: string; serviceId: string }) => {
    console.log("Inline form completed. Data:", data);
    setInlineBookingData(data); // Guardar los datos seleccionados
    setIsBookingModalOpen(true); // Abrir el modal para el siguiente paso
  };

  // --- Función para cerrar el modal de reserva --- 
  const handleCloseBookingModal = () => {
    setIsBookingModalOpen(false);
    setInlineBookingData(null); // Limpiar los datos temporales al cerrar
  };

  // MODIFICADO: handleMediaError (más genérico)
  const handleMediaError = (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>, mediaId: string, fallbackUrl: string) => {
    console.warn(`Error al cargar el medio: ${mediaId}. Usando fallback.`);
    e.currentTarget.onerror = null; 
    setFailedMedia(prev => ({ ...prev, [mediaId]: true }));
  };

  // --- Renderizado ---

  if (loading) {
    return (
      <div className="container text-center mt-5">
        <div className="loader"></div>
        <p>Cargando perfil...</p>
      </div>
    );
  }

  if (error || !user) {
    return <NotFound />;
  }
  
  // Si estamos viendo un producto específico
  if (singleProduct) {
    console.log("Renderizando producto individual:", singleProduct);
    const imageSource = singleProduct.imageURL || singleProduct.imageUrl || singleProduct.image || '';
    
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className="card mb-4">
              {imageSource && (
                <div style={{ maxHeight: "300px", overflow: "hidden" }}>
                  <img 
                    src={imageSource} 
                    className="card-img-top" 
                    alt={singleProduct.title || "Producto"}
                    style={{ 
                      width: "100%", 
                      objectFit: "cover",
                      display: "block"
                    }}
                    onError={(e) => {
                      console.error("Error cargando imagen del producto:", imageSource);
                      e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Sin+imagen';
                    }}
                  />
                </div>
              )}
              <div className="card-body">
                <h2 className="card-title">{singleProduct.title || "Producto"}</h2>
                <p className="card-text">{singleProduct.description || "Sin descripción"}</p>
                <div className="d-flex justify-content-between align-items-center">
                  <h3 className="text-primary">
                    ${typeof singleProduct.price === 'number' 
                      ? singleProduct.price.toFixed(2) 
                      : parseFloat(singleProduct.price || '0').toFixed(2)}
                  </h3>
                  {(singleProduct.url || singleProduct.autoUrl) && (
                    <a href={singleProduct.url || singleProduct.autoUrl} 
                      target="_blank" rel="noopener noreferrer" 
                      className="btn btn-primary">
                      Comprar ahora
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determinar qué datos de tarjeta usar (específica o principal)
  const cardToRender = singleCard || primaryCard;
  const currentBackgroundStyle = getBackgroundStyle(cardToRender);
  const currentTextColor = isDarkBackground(cardToRender) ? '#ffffff' : '#333333';
  
  // MODIFICADO: Lógica mejorada para determinar currentSectionOrder, igual que en el editor
  let determinedSectionOrder: CardSectionType[];
  if (cardToRender?.sectionOrder && cardToRender.sectionOrder.length > 0) {
    const validSectionsFromDB = cardToRender.sectionOrder.filter(section => 
        (CARD_SECTION_TYPES as ReadonlyArray<string>).includes(section)
    );
    const uniqueValidSections = [...new Set(validSectionsFromDB)];
    const missingSections = DEFAULT_USER_PROFILE_SECTION_ORDER.filter(s => !uniqueValidSections.includes(s));
    determinedSectionOrder = [...uniqueValidSections, ...missingSections];
  } else {
    determinedSectionOrder = DEFAULT_USER_PROFILE_SECTION_ORDER;
  }
  const currentSectionOrder = determinedSectionOrder;
  // FIN MODIFICACIÓN

  // Función para renderizar una sección específica DENTRO de UserProfile
  const renderSectionInUserProfile = (sectionType: CardSectionType) => {
    if (!cardToRender) return null;
    const sectionKey = `${cardToRender.id}-${sectionType}`;

    switch (sectionType) {
      case 'userProfileInfo':
        // Forzar el tipo aquí como último recurso antes de reiniciar
        const UserProfileHeaderComponent = UserProfileHeader as any;
        return (
          <UserProfileHeaderComponent 
            key={sectionKey}
            avatarUrl={cardToRender?.avatarUrl || user?.photoURL || undefined} 
            displayName={cardToRender?.displayName || user?.displayName || 'Usuario'}
            bio={cardToRender?.bio || user?.bio || ''}
            textColor={currentTextColor}
            onImageError={handleMediaError as (e: React.SyntheticEvent<HTMLImageElement>, imageId: string, fallbackUrl: string) => void}
            failedImages={failedMedia}
            fallbackImageUrl={FALLBACK_IMAGE_URL}
          />
        );
      case 'header':
        return (
          <CardTitle 
            key={sectionKey}
            title={cardToRender.title} 
            textColor={currentTextColor} 
          />
        );
      case 'image':
        // Logs de diagnóstico para la sección 'image'
        console.log('[UserProfile - image section] cardToRender:', cardToRender);
        if (cardToRender) {
          console.log('[UserProfile - image section] cardToRender.isPremiumUser:', cardToRender.isPremiumUser);
          console.log('[UserProfile - image section] cardToRender.coverMediaItems:', cardToRender.coverMediaItems);
          console.log('[UserProfile - image section] cardToRender.coverMediaItems && cardToRender.coverMediaItems.length > 1:', cardToRender.coverMediaItems && cardToRender.coverMediaItems.length > 1);
        }

        const isPremium = cardToRender?.isPremiumUser === true;
        const hasMultipleItems = cardToRender?.coverMediaItems && cardToRender.coverMediaItems.length > 1;

        console.log('[UserProfile - image section] Evaluado isPremium:', isPremium);
        console.log('[UserProfile - image section] Evaluado hasMultipleItems:', hasMultipleItems);

        if (isPremium && hasMultipleItems && cardToRender?.coverMediaItems) {
          console.log("[UserProfile - image section] Condición CUMPLIDA: Renderizando PremiumCoverSlider");
          return (
            <PremiumCoverSlider
              key={sectionKey + '-slider'}
              mediaItems={cardToRender.coverMediaItems}
              fallbackImageUrl={FALLBACK_IMAGE_URL}
              onErrorCallback={handleMediaError}
              failedMedia={failedMedia}
              className="mb-4"
              loop={true}
              autoplayDelay={5000}
              effect="fade"
            />
          );
        } else {
          console.log("[UserProfile - image section] Condición NO CUMPLIDA o fallback: Renderizando CardCoverImage");
          const singleMediaUrl = cardToRender?.coverMediaItems && cardToRender.coverMediaItems.length > 0
                                 ? cardToRender.coverMediaItems[0].url
                                 : cardToRender?.coverImageUrl;
          const singleMediaId = cardToRender?.coverMediaItems && cardToRender.coverMediaItems.length > 0
                                ? cardToRender.coverMediaItems[0].id
                                : cardToRender?.id + '-cover';

          if (!singleMediaUrl) {
            console.log("No hay URL para CardCoverImage (ni coverMediaItems[0] ni coverImageUrl)");
            return null;
          }
          
          console.log("Renderizando CardCoverImage con URL:", singleMediaUrl);
          return (
            <CardCoverImage
              key={sectionKey + '-single'}
              imageUrl={singleMediaUrl || undefined}
              altText={cardToRender?.title || 'Imagen de portada'}
              cardId={singleMediaId || cardToRender?.id || 'default-cover-id'} 
              onErrorCallback={handleMediaError as (e: React.SyntheticEvent<HTMLImageElement>, imageId: string, fallbackUrl: string) => void}
              fallbackImageUrl={FALLBACK_IMAGE_URL}
              failedImages={failedMedia}
              className="mb-4"
            />
          );
        }
      case 'description':
        return (
          <CardDescription 
            key={sectionKey}
            description={cardToRender.description}
            textColor={currentTextColor}
          />
        );
      case 'links':
        return (
          <CardLinksList 
            key={sectionKey}
            links={links}
          />
        );
      case 'products':
        return (
          <CardProductsGrid
            key={sectionKey}
            products={cardProducts}
            textColor={currentTextColor}
            failedImages={failedImages}
            onErrorCallback={handleImageError}
            fallbackImageUrl={FALLBACK_PRODUCT_IMAGE_URL}
          />
        );
      case 'booking':
        const bookingSettings = (cardToRender as any)?.bookingSettings as BookingSettings | undefined;
        return (cardToRender?.template === 'shop' || cardToRender?.template === 'miniShop' || cardToRender?.template === 'headerStore') 
                && bookingSettings?.enabled && !isBookingModalOpen ? (
          <div className="inline-booking-container mb-4" key={sectionKey}>
            <BookingForm
              cardId={cardToRender.id}
              userId={cardToRender.userId || user?.uid || ''} 
              onClose={() => {}} 
              inlineMode={true} 
              onInlineComplete={handleInlineBookingComplete} 
              accentColor={cardToRender.theme?.primaryColor}
            />
          </div>
        ) : null;
      case 'coverSlider':
        if (cardToRender.isPremiumUser === true && cardToRender.coverMediaItems && cardToRender.coverMediaItems.length > 0) {
          console.log("Renderizando PremiumCoverSlider (vía case 'coverSlider')");
          return (
            <PremiumCoverSlider
              key={sectionKey + '-slider-explicit'}
              mediaItems={cardToRender.coverMediaItems}
              fallbackImageUrl={FALLBACK_IMAGE_URL}
              onErrorCallback={handleMediaError}
              failedMedia={failedMedia}
              className="mb-4"
              loop={true}
              autoplayDelay={5000}
              effect="fade"
            />
          );
        }
        return null;
      default:
        return null;
    }
  };

  // -- Renderizado de Perfil estilo Linktree --
  return (
    <>
      <div
        className={`user-profile-render-container linktree-style template-${cardToRender?.template || 'basic'}`}
        style={{ ...currentBackgroundStyle, color: currentTextColor, minHeight: '100vh' }}
        data-store-name={cardToRender?.template === 'shop' ? cardToRender?.storeName || '' : undefined}
      >
        <div className="container py-4"> 
          <div className="row justify-content-center">
            <div className="col-md-8 col-lg-6 col-xl-5"> 
              
              {/* --- Contenido de la Tarjeta (AHORA incluye la info de perfil si está en el orden) --- */} 
              {cardToRender ? (
                <div className="rendered-card-content-linktree"> 
                  {currentSectionOrder.map(sectionType => renderSectionInUserProfile(sectionType))}
                </div> 
              ) : (
                 // Mensaje si no hay tarjeta 
                 <div className="text-center py-5">
                   {error && <p className="text-danger mt-3">{error}</p>} 
                   {!error && <p className="text-muted mt-4">Este usuario aún no ha configurado una tarjeta.</p>}
                 </div>
              )}
              {/* --- Fin Contenido Tarjeta --- */} 

            </div>
          </div>
        </div>
      </div> 

      {/* ***** MODAL DE RESERVA (para paso final, permanece igual) ***** */} 
      {isBookingModalOpen && cardToRender && inlineBookingData && (
        <BookingForm
          cardId={cardToRender.id}
          userId={cardToRender.userId || user?.uid || ''} 
          onClose={handleCloseBookingModal} 
          inlineMode={false} 
          initialStep={4} 
          initialData={inlineBookingData} 
          accentColor={cardToRender.theme?.primaryColor}
        />
      )}
    </> 
  ); // Fin return
};

export default UserProfile; 