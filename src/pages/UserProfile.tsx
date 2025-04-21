import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import UserCard from '../components/user/UserCard';
import { Link } from '../types';
import { LinkButton, UserLinksContainer } from '../components/userlink';
import NotFound from './NotFound';
import './UserProfile.css'; // Importar el archivo CSS

// URL base del hosting de Firebase
const FIREBASE_HOSTING_URL = 'https://klycs-58190.firebaseapp.com';

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
  const [links, setLinks] = useState<Link[]>([]);
  const [singleCard, setSingleCard] = useState<any | null>(null);
  const [singleProduct, setSingleProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        console.log("Ejecutando fetchUserProfile con:", { username, cardId, productId, lastUpdate });
        
        // Buscar usuario por username
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', username));
        const querySnapshot = await getDocs(q);
        
        console.log("Resultado de la búsqueda de usuario:", querySnapshot.empty ? "No encontrado" : "Encontrado");
        
        if (querySnapshot.empty) {
          // Si no se encuentra por username, intentar buscar por ID
          console.log("Intentando buscar por UID");
          try {
            const userDoc = await getDoc(doc(db, 'users', username || ''));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setUser({
                ...userData,
                uid: username
              });
              
              // Continuamos con la búsqueda de tarjetas
              handleCardOrProductSearch(userData, username || '');
            } else {
              setError('Usuario no encontrado');
              setLoading(false);
            }
          } catch (error) {
            console.error("Error buscando por UID:", error);
            setError('Usuario no encontrado');
            setLoading(false);
          }
          return;
        }

        // Obtener datos del usuario
        const userData = querySnapshot.docs[0].data();
        const userId = querySnapshot.docs[0].id;
        setUser({
          ...userData,
          uid: userId
        });
        
        // Procesamos la búsqueda de tarjetas o productos
        handleCardOrProductSearch(userData, userId);
      } catch (err) {
        setError('Error al cargar el perfil');
        console.error('Error fetching user profile:', err);
        setLoading(false);
      }
    };

    // Función para manejar la búsqueda de tarjetas o productos
    const handleCardOrProductSearch = async (userData: any, userId: string) => {
      // Si estamos viendo una tarjeta específica
      if (cardId && userData.cards) {
        console.log("Buscando tarjeta con ID:", cardId);
        console.log("Tarjetas disponibles:", userData.cards);
        
        // Primero, intentemos una búsqueda exacta por ID
        let foundCard = userData.cards.find((card: any) => card.id === cardId);
        
        // Si no encontramos por ID, buscamos en la URL
        if (!foundCard) {
          console.log("No se encontró por ID, buscando por slug");
          
          // Extraer el slug de la URL
          const urlSlug = cardId.includes('/') ? 
            cardId.split('/').pop() : cardId;
            
          console.log("Buscando por slug:", urlSlug);
          
          foundCard = userData.cards.find((card: any) => {
            if (!card.autoUrl) return false;
            
            const cardSlug = card.autoUrl.includes('/') ? 
              card.autoUrl.split('/').pop() : card.autoUrl;
              
            console.log(`Comparando: card=${cardSlug} con target=${urlSlug}`);
            return cardSlug === urlSlug;
          });
        }
        
        if (foundCard) {
          console.log("Tarjeta encontrada:", foundCard);
          
          // MEJORA: Después de encontrar la tarjeta en los datos del usuario,
          // intentamos obtener la versión más actualizada directamente de la colección 'cards'
          try {
            console.log("Buscando la versión más reciente en la colección 'cards'");
            const cardDoc = await getDoc(doc(db, 'cards', foundCard.id));
            
            if (cardDoc.exists()) {
              console.log("Versión de colección encontrada, usando datos más recientes");
              const cardData = cardDoc.data();
              
              // Verificar si hay una marca de tiempo de actualización
              if (cardData.lastUpdate) {
                console.log("Marca de tiempo de actualización encontrada:", cardData.lastUpdate);
                // Si la marca de tiempo es más reciente que la última carga, actualizar
                setLastUpdate(cardData.lastUpdate);
              }
              
              // Fusionar datos, dando prioridad a los datos de la colección 'cards'
              foundCard = {
                ...foundCard,
                ...cardData,
                // Nos aseguramos de mantener estos campos críticos
                id: foundCard.id,
                links: cardData.links || foundCard.links || [],
                products: cardData.products || foundCard.products || []
              };
              
              console.log("Datos fusionados:", foundCard);
            } else {
              console.log("No se encontró en la colección 'cards', usando datos del usuario");
            }
          } catch (error) {
            console.warn("Error al buscar en colección 'cards', usando datos del usuario:", error);
          }
          
          setSingleCard(foundCard);
          
          // Incrementar contador de vistas solo si el usuario está autenticado
          // o mediante algún mecanismo anónimo
          const currentUser = auth.currentUser;
          if (currentUser) {
            try {
              console.log("Usuario autenticado, actualizando contador de vistas");
              const updatedCards = userData.cards.map((c: any) => {
                if (c.id === foundCard.id) {
                  return { ...c, views: (c.views || 0) + 1 };
                }
                return c;
              });
              
              const userDocRef = doc(db, 'users', userId);
              await updateDoc(userDocRef, { cards: updatedCards });
            } catch (error) {
              console.error('Error al actualizar vistas:', error);
            }
          } else {
            console.log("Usuario no autenticado, no se actualiza el contador de vistas");
            // En una versión futura, podríamos implementar un contador anónimo de vistas
          }
        } else {
          // Si no se encuentra en el array de tarjetas del usuario, intentar buscarlo
          // directamente en la colección 'cards'
          try {
            console.log("Tarjeta no encontrada en datos de usuario, buscando en colección 'cards'");
            const cardDoc = await getDoc(doc(db, 'cards', cardId as string));
            
            if (cardDoc.exists()) {
              const cardData = cardDoc.data();
              console.log("Tarjeta encontrada en colección 'cards':", cardData);
              
              // Verificar si la tarjeta pertenece a este usuario
              if (cardData.userId === userId) {
                setSingleCard({
                  ...cardData,
                  id: cardId
                });
              } else {
                console.log("La tarjeta no pertenece a este usuario");
                setError('Tarjeta no encontrada');
              }
            } else {
              console.log("Tarjeta no encontrada en ninguna colección");
              setError('Tarjeta no encontrada');
            }
          } catch (error) {
            console.error("Error al buscar en colección 'cards':", error);
            setError('Tarjeta no encontrada');
          }
        }
      }
      
      // Si estamos viendo un producto específico
      else if (productId && userData.products) {
        console.log("Buscando producto con ID:", productId);
        console.log("Productos disponibles:", userData.products);
        
        // Primero, intentemos una búsqueda exacta por ID
        let foundProduct = userData.products.find((product: any) => product.id === productId);
        
        // Si no encontramos por ID, buscamos en la URL
        if (!foundProduct) {
          console.log("No se encontró por ID, buscando por slug");
          
          // Extraer el slug de la URL
          const urlSlug = productId.includes('/') ? 
            productId.split('/').pop() : productId;
            
          console.log("Buscando por slug:", urlSlug);
          
          foundProduct = userData.products.find((product: any) => {
            if (!product.autoUrl) return false;
            
            const productSlug = product.autoUrl.includes('/') ? 
              product.autoUrl.split('/').pop() : product.autoUrl;
              
            console.log(`Comparando: product=${productSlug} con target=${urlSlug}`);
            return productSlug === urlSlug;
          });
        }
        
        if (foundProduct) {
          console.log("Producto encontrado:", foundProduct);
          setSingleProduct(foundProduct);
        } else {
          console.log("Producto no encontrado");
          setError('Producto no encontrado');
        }
      }
      
      // Si estamos viendo el perfil general
      else if (!cardId && !productId) {
        // Obtener enlaces del usuario
        if (userData.links) {
          // Filtrar solo enlaces activos
          const activeLinks = userData.links
            .filter((link: Link) => link.active);
          
          setLinks(activeLinks);
        }
      }
      
      setLoading(false);
    };

    if (username) {
      fetchUserProfile();
    } else {
      setLoading(false);
      setError('Usuario no especificado');
    }
  }, [username, cardId, productId, lastUpdate]);

  // Crear un enlace predeterminado si el usuario no tiene enlaces
  const getLinksToDisplay = () => {
    if (links.length > 0) {
      return links;
    }

    // Enlace predeterminado si no hay enlaces
    return [{
      id: 'default-link',
      title: 'Visita mi página web',
      url: `${FIREBASE_HOSTING_URL}`,
      active: true
    }];
  };

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
  
  // Si estamos viendo una tarjeta específica
  if (singleCard) {
    // Determinar el estilo de fondo basado en el tipo de fondo
    const getBackgroundStyle = () => {
      console.log("Aplicando estilos de fondo para la tarjeta:", singleCard.id);
      console.log("Tipo de fondo:", singleCard.backgroundType);
      console.log("Color de fondo:", singleCard.backgroundColor);
      console.log("Gradiente de fondo:", singleCard.backgroundGradient);
      console.log("URL de imagen de fondo:", singleCard.backgroundImageURL);
      
      if (!singleCard.backgroundType || singleCard.backgroundType === 'color') {
        const bgColor = singleCard.backgroundColor || '#ffffff';
        console.log("Aplicando color de fondo:", bgColor);
        return { backgroundColor: bgColor };
      } else if (singleCard.backgroundType === 'gradient') {
        const gradient = singleCard.backgroundGradient || 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)';
        console.log("Aplicando gradiente:", gradient);
        return { background: gradient };
      } else if (singleCard.backgroundType === 'image' && singleCard.backgroundImageURL) {
        console.log("Aplicando imagen de fondo:", singleCard.backgroundImageURL);
        return { 
          backgroundImage: `url(${singleCard.backgroundImageURL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        };
      }
      
      console.log("No se aplicó ningún estilo de fondo específico, usando valor predeterminado");
      return {}; // Estilo predeterminado si no hay tipo de fondo
    };

    const cardStyle = getBackgroundStyle();
    console.log("Estilos finales aplicados:", cardStyle);
    
    // Determinar el estilo de texto basado en el fondo
    const getTextColorStyle = () => {
      // Para fondos oscuros, usamos texto claro; para fondos claros, texto oscuro
      if (singleCard.backgroundType === 'gradient' || 
          (singleCard.backgroundType === 'image') || 
          (singleCard.backgroundType === 'color' && singleCard.backgroundColor && 
           ['#000000', '#222222', '#333333', '#444444', '#555555', '#111111'].includes(singleCard.backgroundColor))) {
        return { color: '#ffffff' };
      }
      return { color: '#212529' }; // Color de texto bootstrap predeterminado
    };

    const textStyle = getTextColorStyle();
    
    // Determinar clases CSS según el tipo de fondo
    const getBackgroundClass = () => {
      if (!singleCard.backgroundType || singleCard.backgroundType === 'color') {
        return 'bg-color';
      } else if (singleCard.backgroundType === 'gradient') {
        return 'bg-gradient';
      } else if (singleCard.backgroundType === 'image' && singleCard.backgroundImageURL) {
        return 'bg-image';
      }
      return '';
    };
    
    // Determinar si el fondo es oscuro para aplicar clase de texto claro
    const isDarkBackground = () => {
      return singleCard.backgroundType === 'gradient' || 
             singleCard.backgroundType === 'image' || 
             (singleCard.backgroundType === 'color' && singleCard.backgroundColor && 
              ['#000000', '#222222', '#333333', '#444444', '#555555', '#111111'].includes(singleCard.backgroundColor));
    };

    return (
      <div className="container mt-5 user-card-container">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div 
              key={`card-${singleCard.id}-${lastUpdate}-${singleCard.backgroundType || 'default'}`}
              className={`card mb-4 user-card ${getBackgroundClass()} ${isDarkBackground() ? 'dark-bg' : ''}`}
              style={{
                ...cardStyle, 
                overflow: 'hidden',
                transition: 'background 0.3s ease, background-color 0.3s ease',
                minHeight: '300px' // Asegurar que la tarjeta tenga altura suficiente para mostrar el fondo
              }}
            >
              {singleCard.imageURL && (
                <img src={singleCard.imageURL} className="card-img-top" alt={singleCard.title} />
              )}
              <div className="card-body" style={textStyle}>
                <h2 className="card-title" style={textStyle}>{singleCard.title}</h2>
                <p className="card-text" style={textStyle}>{singleCard.description}</p>
                
                {/* Enlaces de la tarjeta */}
                {singleCard.links && singleCard.links.length > 0 && (
                  <UserLinksContainer links={singleCard.links} />
                )}
                
                {/* Productos de la tarjeta */}
                {singleCard.products && singleCard.products.length > 0 && (
                  <div className="products-container mt-4">
                    <h3 className="mb-3" style={textStyle}>Productos</h3>
                    <div className="row">
                      {singleCard.products
                        .filter((product: any) => product.active !== false)
                        .map((product: any) => {
                          // Debug para ver el producto completo
                          console.log("Renderizando producto:", product);
                          
                          // Determinar la URL de la imagen (manejando diferentes formatos posibles)
                          const imageSource = product.imageURL || product.imageUrl || product.image || '';
                          
                          return (
                            <div key={product.id} className="col-md-6 mb-3">
                              <div className="card h-100">
                                {imageSource && (
                                  <div className="product-image-wrapper" style={{ height: "180px", overflow: "hidden" }}>
                                    <img 
                                      src={imageSource} 
                                      className="card-img-top product-thumbnail" 
                                      alt={product.title || "Producto"} 
                                      style={{ 
                                        width: "100%", 
                                        height: "100%", 
                                        objectFit: "cover",
                                        display: "block"
                                      }}
                                      onError={(e) => {
                                        console.error("Error cargando imagen:", imageSource);
                                        e.currentTarget.src = 'https://via.placeholder.com/150?text=Sin+imagen';
                                      }}
                                    />
                                  </div>
                                )}
                                <div className="card-body d-flex flex-column">
                                  <h5 className="card-title">{product.title || "Producto sin título"}</h5>
                                  <p className="card-text small">
                                    {product.description 
                                      ? (product.description.length > 50 
                                        ? `${product.description.substring(0, 50)}...` 
                                        : product.description)
                                      : "Sin descripción"}
                                  </p>
                                  <div className="mt-auto d-flex justify-content-between align-items-center">
                                    <span className="text-primary fw-bold">
                                      ${typeof product.price === 'number' 
                                        ? product.price.toFixed(2) 
                                        : parseFloat(product.price || '0').toFixed(2)}
                                    </span>
                                    {(product.url || product.autoUrl) && (
                                      <a 
                                        href={product.url || product.autoUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="btn btn-sm btn-primary"
                                      >
                                        Ver producto
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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

  // Vista de perfil normal
  const linksToDisplay = getLinksToDisplay();

  // Efecto para comprobar actualizaciones periódicamente
  useEffect(() => {
    // Si estamos viendo una tarjeta específica, comprobar actualizaciones cada 10 segundos
    if (singleCard && !loading) {
      console.log("Configurando verificación periódica de actualizaciones...");
      
      const checkForUpdates = async () => {
        try {
          console.log("Verificando actualizaciones para la tarjeta:", singleCard.id);
          
          // Verificar en la colección de tarjetas primero
          const cardDoc = await getDoc(doc(db, 'cards', singleCard.id));
          
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
                if (userData.cardUpdates && userData.cardUpdates[singleCard.id]) {
                  const userUpdateTimestamp = userData.cardUpdates[singleCard.id];
                  
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
  }, [singleCard, loading, lastUpdate, username]);

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <UserCard user={user} />
          
          <UserLinksContainer links={linksToDisplay} className="mt-4" />
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 