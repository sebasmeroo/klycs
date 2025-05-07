import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
// import UserCard from '../components/cardeditor/cardpreviewanduser/user/UserCard'; // Eliminado
import { CardLink as LinkType, Product as ProductType, TemplateType, BookingSettings } from '../components/cardeditor/types'; // Corregido: CardLink as LinkType, Añadido BookingSettings
// import { LinkButton, UserLinksContainer } from '../components/cardeditor/cardpreviewanduser/userlink'; // Eliminado
import NotFound from './NotFound';
// import CardPreview from '../components/cardeditor/cardpreviewanduser/CardPreview/CardPreview'; // Eliminado
import './UserProfile.css'; // Importar el archivo CSS
import { FiMenu, FiHome, FiShoppingBag } from 'react-icons/fi';
import BookingForm from '../components/booking/BookingForm'; // Importar BookingForm
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
interface CardData {
  id: string;
  title?: string;
  description?: string;
  imageURL?: string | null;
  backgroundType?: 'image' | 'color' | 'gradient';
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImageURL?: string | null;
  storeName?: string;
  links?: LinkType[];
  products?: ProductType[];
  active?: boolean;
  lastUpdate?: number;
  createdAt?: number;
  views?: number; // Añadido por si acaso
  userId?: string; // Añadido por si acaso
  template?: TemplateType; // Añadir propiedad template
  bookingSettings?: BookingSettings; // Añadir bookingSettings
  theme?: {
    primaryColor?: string;
  };
}

// Importar CSS de plantillas
import '../components/cardeditor/templates/CommonTemplate.css';
import '../components/cardeditor/templates/basic/BasicTemplate.css';
import '../components/cardeditor/templates/link/LinkTemplate.css';
import '../components/cardeditor/templates/shop/ShopTemplate.css';

const UserProfile: React.FC = () => {
  // Extraer parámetros de la URL
  const params = useParams();
  const username = params.username;
  const cardId = params.cardId;
  const productId = params.productId;
  
  // Añadir logs para diagnosticar problemas
  console.log("URL completa:", window.location.href);
  console.log("Todos los parámetros:", params);
  console.log("Username:", username);
  console.log("Card ID:", cardId);
  console.log("Product ID:", productId);
  
  const [user, setUser] = useState<any | null>(null);
  const [singleCard, setSingleCard] = useState<CardData | null>(null);
  const [singleProduct, setSingleProduct] = useState<any | null>(null);
  const [primaryCard, setPrimaryCard] = useState<CardData | null>(null); // Mantener estado
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({}); // Estado para imágenes fallidas
  // Ref para scroll a productos destacados
  const featuredRef = useRef<HTMLDivElement>(null);

  // *** Estados para controlar el flujo inline -> modal ***
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false); 
  const [inlineBookingData, setInlineBookingData] = useState<InitialBookingData | null>(null);

  useEffect(() => {
    const fetchUserProfileAndCard = async () => {
      setLoading(true);
      setError(null);
      setUser(null);
      setSingleCard(null);
      setPrimaryCard(null);

      if (!username) {
        setError('Usuario no especificado');
        setLoading(false);
        return;
      }

      try {
        // 1. Buscar Usuario (por username o UID)
        let userId: string | null = null;
        let fetchedUserData: any = null;

        const usersRef = collection(db, 'users');
        const qUsername = query(usersRef, where('username', '==', username));
        const usernameSnapshot = await getDocs(qUsername);

        if (!usernameSnapshot.empty) {
          fetchedUserData = usernameSnapshot.docs[0].data();
          userId = usernameSnapshot.docs[0].id;
        } else {
          // Intentar buscar por UID si el username de la URL es un UID válido
          try {
            const userDocRef = doc(db, 'users', username);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              fetchedUserData = userDoc.data();
              userId = username; // El username de la URL era el UID
            } else {
              setError('Usuario no encontrado');
              return;
            }
          } catch (uidError) {
            setError('Error al buscar usuario');
            return;
          }
        }

        setUser({ ...fetchedUserData, uid: userId });

        // 2. Determinar qué tarjeta cargar
        if (cardId) {
          // 2a. Cargar tarjeta específica por ID
          console.log(`Intentando cargar tarjeta específica con ID: ${cardId}`);
          const cardDocRef = doc(db, 'cards', cardId);
          const cardDoc = await getDoc(cardDocRef);

          if (cardDoc.exists()) {
            const cardData = cardDoc.data() as CardData;
            // Verificar pertenencia
            if (cardData.userId === userId) {
              console.log('Tarjeta específica encontrada y pertenece al usuario:', cardData);
              setSingleCard({ ...cardData, id: cardId });
              
              // **** INICIO: CÓDIGO DE SEGUIMIENTO DE VISTAS ****
              try {
                await updateDoc(cardDocRef, {
                  views: increment(1)
                });
                const analyticsRef = collection(db, 'cards', cardId, 'analyticsEvents');
                await addDoc(analyticsRef, {
                  type: 'view',
                  timestamp: serverTimestamp(),
                  userAgent: navigator.userAgent || null,
                });
                console.log(`Vista registrada para la tarjeta: ${cardId}`);
              } catch (analyticsError) {
                console.error("Error al registrar la vista:", analyticsError);
              }
              // **** FIN: CÓDIGO DE SEGUIMIENTO DE VISTAS ****

            } else {
              console.warn(`La tarjeta ${cardId} no pertenece al usuario ${userId}`);
              setError('Tarjeta no encontrada o no pertenece a este usuario.');
              return;
            }
          } else {
            console.warn(`No se encontró la tarjeta con ID ${cardId} en la colección /cards`);
            setError('Tarjeta no encontrada.');
            return;
          }
        } else if (!productId) {
           // 2b. Si no hay cardId ni productId, buscar tarjeta principal del usuario
           console.log('Buscando tarjeta principal para el usuario');
           const userCardsArray = (fetchedUserData?.cards && Array.isArray(fetchedUserData.cards)) ? fetchedUserData.cards : [];
           const activeCards = userCardsArray.filter((card: any) => card.active !== false);
           let cardToDisplay: CardData | null = null;

           if (activeCards.length > 0) {
             // Ordenar activas por fecha
             const sortedActiveCards = [...activeCards].sort((a: any, b: any) => {
               const timeA = a.lastUpdate || a.createdAt || 0;
               const timeB = b.lastUpdate || b.createdAt || 0;
               return timeB - timeA;
             });
             cardToDisplay = sortedActiveCards[0];
           } else if (userCardsArray.length > 0) {
             // Si no hay activas, mostrar la más reciente
             const sortedCards = [...userCardsArray].sort((a: any, b: any) => {
               const timeA = a.lastUpdate || a.createdAt || 0;
               const timeB = b.lastUpdate || b.createdAt || 0;
               return timeB - timeA;
             });
             cardToDisplay = sortedCards[0];
           }

           if (cardToDisplay) {
              // Opcional: Cargar la versión más reciente de /cards para la principal
              try {
                 const primaryCardDocRef = doc(db, 'cards', cardToDisplay.id);
                 const primaryCardDoc = await getDoc(primaryCardDocRef);
                 if (primaryCardDoc.exists()) {
                    const freshCardData = primaryCardDoc.data();
                    cardToDisplay = { ...cardToDisplay, ...freshCardData };
                 } else {
                    console.warn(`La tarjeta principal ${cardToDisplay.id} listada en usuario no se encontró en /cards`);
                 }
              } catch (fetchPrimaryError) {
                 console.error('Error buscando tarjeta principal en /cards:', fetchPrimaryError);
              }
              console.log('Tarjeta principal encontrada:', cardToDisplay);
              setPrimaryCard(cardToDisplay);
           } else {
              console.log('No se encontró tarjeta principal para el usuario.');
           }
        } else if (productId) {
          // 2c. Cargar producto específico (lógica similar a la anterior, si es necesaria)
          console.log("Cargando producto específico (lógica pendiente si se necesita)");
          // Aquí iría la lógica para buscar el producto si decides mostrarlo en una URL dedicada
          // const foundProduct = fetchedUserData?.products?.find(p => p.id === productId || p.autoUrl?.endsWith(productId));
          // if (foundProduct) setSingleProduct(foundProduct);
          // else setError('Producto no encontrado');
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

  }, [username, cardId, productId]); // Quitar lastUpdate de dependencias

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
              
              {/* --- Sección de Información del Usuario (Siempre visible) --- */} 
              <div className="user-profile-header text-center mb-4"> 
                 {user?.photoURL ? (
                   <img 
                     src={user.photoURL} 
                     alt={user.displayName || 'Avatar'} 
                     className="profile-avatar mb-3 mx-auto" 
                     onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; /* O mostrar placeholder */ }}
                   />
                 ) : (
                   <div className="profile-avatar-placeholder mb-3 mx-auto d-flex align-items-center justify-content-center" >
                     {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                   </div>
                 )}
                 <h1 className="profile-display-name" style={{ color: currentTextColor }}>{user?.displayName || 'Usuario'}</h1>
                 {user?.bio && <p className="profile-bio-text mt-2" style={{ color: currentTextColor }}>{user.bio}</p>}
              </div>
              {/* --- Fin Sección Info Usuario --- */}

              {/* ***** FORMULARIO DE RESERVA INTEGRADO ***** */} 
              {(cardToRender?.template === 'shop' || cardToRender?.template === 'miniShop' || cardToRender?.template === 'headerStore') 
                && cardToRender?.bookingSettings?.enabled && (
                // Renderizar el inline solo si el modal NO está abierto
                !isBookingModalOpen && (
                    <div className="inline-booking-container mb-4">
                      <BookingForm
                        cardId={cardToRender.id}
                        userId={cardToRender.userId || user?.uid || ''} 
                        onClose={() => {}} // onClose no es relevante para inline
                        inlineMode={true} 
                        onInlineComplete={handleInlineBookingComplete} // Pasar la función callback
                        accentColor={cardToRender.theme?.primaryColor}
                      />
                    </div>
                )
              )}
              {/* ***** FIN FORMULARIO DE RESERVA INTEGRADO ***** */} 

              {/* --- Contenido de la Tarjeta (si existe) --- */} 
              {cardToRender ? (
                <div className="rendered-card-content-linktree"> 
                  {/* ***** AÑADIR IMAGEN PRINCIPAL DE LA TARJETA ***** */}
                  {cardToRender.imageURL && (
                    <div className="rendered-main-image-container mb-4"> { /* Contenedor opcional */ }
                      <img
                        src={failedImages[cardToRender.id] ? FALLBACK_IMAGE_URL : cardToRender.imageURL}
                        alt={cardToRender.title || 'Imagen principal'}
                        className="rendered-main-image-linktree" // Añadir clase específica
                        onError={(e) => handleImageError(e, cardToRender.id, FALLBACK_IMAGE_URL)}
                      />
                    </div>
                  )}
                  {/* ***** FIN IMAGEN PRINCIPAL ***** */}

                  {/* Descripción */} 
                  {cardToRender.description && (
                    <p className="rendered-description-linktree text-center mb-4"> 
                      {cardToRender.description}
                    </p>
                  )}

                  {/* Enlaces */} 
                  {cardToRender.links?.filter(l => l.active).length > 0 && (
                    <div className="rendered-links-container-linktree mb-4">
                      {(cardToRender.links || []).filter(l => l.active).map(link => (
                        <a key={link.id} href={link.url} className="rendered-link-button-linktree" target="_blank" rel="noopener noreferrer">
                          {link.title}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Productos Destacados */} 
                  {cardToRender.products?.filter(p => p.active !== false).length > 0 && (
                     <>
                       <h5 className="rendered-section-title-linktree" style={{ color: currentTextColor }}>Productos Destacados</h5> 
                       <div className="rendered-featured-products-linktree mb-4"> 
                         {(cardToRender.products || []).filter(p => p.active !== false).map(product => (
                           <div key={product.id} className="rendered-product-item-linktree"> 
                             <img 
                               src={failedImages[product.id] ? FALLBACK_PRODUCT_IMAGE_URL : (product.imageURL || FALLBACK_PRODUCT_IMAGE_URL)} 
                               alt={product.title}
                               className="rendered-product-image-linktree"
                               onError={(e) => handleImageError(e, product.id, FALLBACK_PRODUCT_IMAGE_URL)}
                             />
                             <div className="rendered-product-info"> 
                               <h6 className="rendered-product-title">{product.title}</h6>
                               <p className="rendered-product-price">{typeof product.price === 'number' ? product.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : 'Consultar'}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                     </>
                  )}
                  
                </div> // Fin rendered-card-content-linktree
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

      {/* ***** MODAL DE RESERVA (para paso final) ***** */} 
      {isBookingModalOpen && cardToRender && inlineBookingData && (
        <BookingForm
          cardId={cardToRender.id}
          userId={cardToRender.userId || user?.uid || ''} 
          onClose={handleCloseBookingModal} // Usar la nueva función de cierre
          inlineMode={false} // Forzar modo modal
          initialStep={4} // Empezar en el paso 4 (detalles)
          initialData={inlineBookingData} // Pasar los datos pre-seleccionados
          accentColor={cardToRender.theme?.primaryColor}
        />
      )}
    </> 
  ); // Fin return
};

export default UserProfile; 