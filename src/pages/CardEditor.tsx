import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import Header from '../components/header';
import '../components/cardeditor/CardEditor.css';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

// Interfaces
interface CardLink {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  imageURL: string;
  url?: string;
  autoUrl?: string;
  active: boolean;
}

interface Card {
  id: string;
  title: string;
  description: string;
  imageURL?: string;
  links: CardLink[];
  products: Product[];
  autoUrl?: string;
  active: boolean;
  views: number;
  createdAt: number;
  backgroundType?: 'image' | 'color' | 'gradient';
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImageURL?: string;
  userId: string;
}

// Define LinkData interface to fix the missing type
interface LinkData {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

const CardEditor: React.FC = () => {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  
  // Estados para la tarjeta
  const [userData, setUserData] = useState<any>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estados para el fondo
  const [backgroundType, setBackgroundType] = useState<'image' | 'color' | 'gradient'>('color');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [backgroundGradient, setBackgroundGradient] = useState('linear-gradient(135deg, #4b6cb7 0%, #182848 100%)');
  const [backgroundImageURL, setBackgroundImageURL] = useState<string | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  
  // Estados para los enlaces
  const [linkId, setLinkId] = useState<string | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);

  // Estados para productos
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [userProducts, setUserProducts] = useState<Product[]>([]);

  // Links state
  const [links, setLinks] = useState<LinkData[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchCardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check if user is authenticated
        const auth = getAuth();
        
        // Verificar autenticación usando promesa
        const user = auth.currentUser;
        if (!user) {
          console.log("Usuario no autenticado, redirigiendo a login");
          navigate('/login');
          return;
        }

        console.log("Usuario autenticado:", user.uid);
        
        try {
          // Intentar obtener la tarjeta directamente de la colección 'cards'
          const cardRef = doc(db, 'cards', cardId as string);
          const cardDoc = await getDoc(cardRef);
          
          if (!cardDoc.exists()) {
            console.log("Tarjeta no encontrada en colección 'cards', buscando en datos de usuario");
            
            // Si no se encuentra, intentar obtener desde el usuario
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (!userDoc.exists()) {
              setError('Datos de usuario no encontrados');
              setLoading(false);
              return;
            }
            
            setUserData(userDoc.data());
            
            // Buscar la tarjeta en los datos del usuario
            const userData = userDoc.data();
            const userCards = userData.cards || [];
            const cardData = userCards.find((c: Card) => c.id === cardId);
            
            if (!cardData) {
              setError('Tarjeta no encontrada en los datos del usuario');
              setLoading(false);
              return;
            }
            
            // Procesar los datos de la tarjeta
            processCardData(cardData);
          } else {
            // Si se encontró la tarjeta en la colección 'cards'
            const cardData = cardDoc.data() as Card;
            
            // Verificar que la tarjeta pertenece al usuario
            // Esto depende de la estructura de tus datos, ajustar según sea necesario
            // (por ejemplo, si las tarjetas tienen un campo 'userId')
            
            // Obtener datos del usuario de todas formas para el encabezado
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              setUserData(userDoc.data());
            }
            
            // Procesar los datos de la tarjeta
            processCardData(cardData);
          }
        } catch (error: any) {
          console.error('Error al acceder a Firestore:', error);
          setError(`Error al acceder a la base de datos: ${error.message}`);
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Error cargando datos de la tarjeta:', error);
        setError(`Error cargando datos de la tarjeta: ${error.message}`);
        setLoading(false);
      }
    };
    
    // Función auxiliar para procesar los datos de la tarjeta
    const processCardData = (cardData: Card) => {
      // Format products if they exist
      if (cardData.products) {
        cardData.products = cardData.products.map((product: any) => {
          return {
            ...product,
            price: parseFloat(product.price)
          };
        });
      } else {
        cardData.products = [];
      }

      setCard(cardData);
      setTitle(cardData.title);
      setDescription(cardData.description || '');
      if (cardData.imageURL) {
        setImagePreview(cardData.imageURL);
      }
      
      // Set background properties
      setBackgroundType(cardData.backgroundType || 'color');
      setBackgroundColor(cardData.backgroundColor || '#ffffff');
      setBackgroundGradient(cardData.backgroundGradient || 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)');
      if (cardData.backgroundImageURL) {
        setBackgroundImageURL(cardData.backgroundImageURL);
      }
      
      // Cargar productos del usuario si hay usuario autenticado
      if (auth.currentUser) {
        fetchUserProducts(auth.currentUser.uid);
      }
      
      setLoading(false);
    };

    fetchCardData();
  }, [cardId, navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      // Crear preview local
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      }
      reader.readAsDataURL(selectedFile);
    } else {
      setFile(null);
      setImagePreview(card?.imageURL || null);
    }
  };

  // Handle background image file change
  const handleBackgroundFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setBackgroundFile(selectedFile);
      // Create local preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundImageURL(reader.result as string);
      }
      reader.readAsDataURL(selectedFile);
    } else {
      setBackgroundFile(null);
      setBackgroundImageURL(card?.backgroundImageURL || null);
    }
  };

  // Handle changing background type
  const handleBackgroundTypeChange = (type: 'image' | 'color' | 'gradient') => {
    setBackgroundType(type);
  };

  const generateAutoUrl = (title: string, username: string) => {
    const safeTitle = title || 'card';
    const safeUsername = username || 'usuario';
    
    const slug = safeTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-');
    
    const firebaseHostingDomain = 'https://klycs-58190.firebaseapp.com';
    
    return `${firebaseHostingDomain}/${safeUsername}/card/${slug}-${Date.now().toString(36)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let imageURL = card?.imageURL || '';
      if (file) {
        // Upload image
        imageURL = await uploadImageAndGetURL(file);
      }
      
      // Upload background image if needed
      let updatedBackgroundImageURL = backgroundImageURL;
      if (backgroundType === 'image' && backgroundFile) {
        updatedBackgroundImageURL = await uploadImageAndGetURL(backgroundFile);
      }

      // Get current user
      const auth = getAuth();
      if (!auth.currentUser) {
        throw new Error('Usuario no autenticado');
      }

      // Preparar el objeto con los datos actualizados
      const updatedCardData: any = {
        title,
        description,
        imageURL,
        backgroundType,
        userId: auth.currentUser.uid,
      };
      
      // Añadir los campos específicos según el tipo de fondo
      if (backgroundType === 'color') {
        updatedCardData.backgroundColor = backgroundColor || '#ffffff';
        updatedCardData.backgroundGradient = null;
        updatedCardData.backgroundImageURL = null;
      } else if (backgroundType === 'gradient') {
        updatedCardData.backgroundGradient = backgroundGradient || 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)';
        updatedCardData.backgroundColor = null;
        updatedCardData.backgroundImageURL = null;
      } else if (backgroundType === 'image') {
        // Solo establecer backgroundImageURL si tiene un valor
        if (updatedBackgroundImageURL) {
          updatedCardData.backgroundImageURL = updatedBackgroundImageURL;
        } else if (card?.backgroundImageURL) {
          updatedCardData.backgroundImageURL = card.backgroundImageURL;
        } else {
          updatedCardData.backgroundImageURL = null;
        }
        updatedCardData.backgroundColor = null;
        updatedCardData.backgroundGradient = null;
      }

      // Primero actualizar los datos en el array de cards del usuario
      // (esto tiene menos restricciones de permisos que actualizar directamente el documento)
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        throw new Error('Datos de usuario no encontrados');
      }
      
      const userData = userDoc.data();
      const userCards = userData.cards || [];
      const cardIndex = userCards.findIndex((c: Card) => c.id === cardId);
      
      if (cardIndex >= 0) {
        // Actualizar la tarjeta existente en el array
        userCards[cardIndex] = { 
          ...userCards[cardIndex], 
          ...updatedCardData,
          // Asegurarse de que estos campos esenciales permanezcan
          id: cardId,
          active: userCards[cardIndex].active !== undefined ? userCards[cardIndex].active : true,
          views: userCards[cardIndex].views || 0,
          createdAt: userCards[cardIndex].createdAt || Date.now(),
          links: userCards[cardIndex].links || [],
          products: userCards[cardIndex].products || []
        };
        
        // Actualizar el documento del usuario primero
        await updateDoc(userDocRef, { cards: userCards });
        
        // Ahora intentar actualizar el documento específico de la tarjeta
        // Si falla por permisos, al menos ya actualizamos el array del usuario
        try {
          const cardDocRef = doc(db, 'cards', cardId as string);
          // Obtener primero los datos actuales para no sobrescribir campos que no estamos actualizando
          const cardDoc = await getDoc(cardDocRef);
          
          if (cardDoc.exists()) {
            const currentCardData = cardDoc.data();
            await updateDoc(cardDocRef, {
              ...updatedCardData,
              // Mantener campos que no estamos actualizando
              active: currentCardData.active !== undefined ? currentCardData.active : true,
              views: currentCardData.views || 0,
              createdAt: currentCardData.createdAt || Date.now(),
              links: currentCardData.links || [],
              products: currentCardData.products || []
            });
          }
        } catch (cardUpdateError) {
          console.warn('No se pudo actualizar el documento individual de la tarjeta, pero se actualizó en el array del usuario:', cardUpdateError);
          // No lanzamos el error para no interrumpir el flujo si al menos actualizamos en el array
        }
        
        // Intentar crear/actualizar una marca de tiempo para forzar recargas en las vistas públicas
        try {
          // Añadir una marca de tiempo a la tarjeta para forzar la actualización de la vista pública
          const timestamp = Date.now();
          
          // Actualizar en la colección de usuarios
          await updateDoc(userDocRef, { 
            [`cardUpdates.${cardId}`]: timestamp 
          });
          
          // Intentar actualizar también en la colección de tarjetas
          // Primero verificar si el documento existe antes de intentar actualizarlo
          try {
            const cardDocRef = doc(db, 'cards', cardId as string);
            const cardDoc = await getDoc(cardDocRef);
            
            if (cardDoc.exists()) {
              // Solo intentar actualizar si el documento existe
              await updateDoc(cardDocRef, { 
                lastUpdate: timestamp 
              });
            } else {
              console.log('El documento de tarjeta no existe en la colección "cards", omitiendo actualización de marca de tiempo');
              // Si lo necesitamos, podríamos crear el documento aquí, pero es mejor mantener el enfoque de actualizar el array del usuario
            }
          } catch (e) {
            console.warn('No se pudo actualizar la marca de tiempo en la colección de tarjetas:', e);
            // No es un error crítico, podemos continuar
          }
          
          console.log('Marca de tiempo de actualización guardada:', timestamp);
        } catch (e) {
          console.warn('No se pudo guardar la marca de tiempo de actualización:', e);
        }
        
        setSuccess('Tarjeta actualizada correctamente');
        
        // Actualizar el estado local
        setCard(prev => {
          if (!prev) return null;
          const updatedCard = { 
            ...prev,
            ...updatedCardData,
          };
          return updatedCard;
        });
        
        // Si se actualizó la imagen de fondo, actualizar la vista previa
        if (backgroundType === 'image' && backgroundFile) {
          setBackgroundImageURL(updatedBackgroundImageURL);
          setBackgroundFile(null);
        }
      } else {
        setError('No se encontró la tarjeta en tus datos');
      }
      
    } catch (error: any) {
      console.error('Error updating card:', error);
      setError(`Error al actualizar la tarjeta: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Función para abrir el formulario para añadir un enlace
  const openAddLinkForm = () => {
    setLinkTitle('');
    setLinkUrl('');
    setEditingLinkId(null);
    setShowLinkForm(true);
  };

  // Función para editar un enlace existente
  const handleEditLink = (link: CardLink) => {
    setLinkTitle(link.title);
    setLinkUrl(link.url);
    setEditingLinkId(link.id);
    setShowLinkForm(true);
  };

  // Guardar enlace (nuevo o editado)
  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!linkTitle.trim()) {
      setError('Debes proporcionar un título para el enlace');
      return;
    }
    
    if (!linkUrl.trim()) {
      setError('Debes proporcionar una URL para el enlace');
      return;
    }
    
    if (!card) {
      setError('Error: tarjeta no cargada');
      return;
    }
    
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Validar URL y añadir http:// si no lo tiene
      let formattedUrl = linkUrl.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }
      
      let updatedLinks = [...card.links];
      
      if (editingLinkId) {
        // Actualizar enlace existente
        updatedLinks = updatedLinks.map(link => 
          link.id === editingLinkId ? { 
            ...link, 
            title: linkTitle, 
            url: formattedUrl
          } : link
        );
      } else {
        // Añadir nuevo enlace
        const newLink: CardLink = {
          id: uuidv4(),
          title: linkTitle,
          url: formattedUrl,
          active: true
        };
        updatedLinks = [...updatedLinks, newLink];
      }
      
      // Actualizar la tarjeta con los enlaces actualizados
      const updatedCard = {
        ...card,
        links: updatedLinks
      };
      
      // Actualizar el documento del usuario
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const updatedCards = userData.cards.map((c: Card) => 
          c.id === cardId ? updatedCard : c
        );
        
        await updateDoc(userDocRef, { cards: updatedCards });
        setCard(updatedCard as Card);
        setSuccess('Enlace guardado correctamente');
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccess(null), 3000);
      }
      
      // Cerrar formulario de enlaces
      setLinkTitle('');
      setLinkUrl('');
      setEditingLinkId(null);
      setShowLinkForm(false);
      
    } catch (error: any) {
      console.error('Error al guardar enlace:', error);
      setError('Error al guardar el enlace. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar enlace
  const handleDeleteLink = async (linkId: string) => {
    if (!card) {
      setError('Error: tarjeta no cargada');
      return;
    }
    
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }
    
    try {
      // Filtrar los enlaces para eliminar el enlace seleccionado
      const updatedLinks = card.links.filter(link => link.id !== linkId);
      
      // Actualizar la tarjeta con los enlaces actualizados
      const updatedCard = {
        ...card,
        links: updatedLinks
      };
      
      // Actualizar el documento del usuario
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const updatedCards = userData.cards.map((c: Card) => 
          c.id === cardId ? updatedCard : c
        );
        
        await updateDoc(userDocRef, { cards: updatedCards });
        setCard(updatedCard as Card);
        setSuccess('Enlace eliminado correctamente');
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error: any) {
      console.error('Error al eliminar enlace:', error);
      setError('Error al eliminar el enlace. Inténtalo de nuevo.');
    }
  };

  // Alternar estado activo de un enlace
  const toggleLinkActive = async (linkId: string) => {
    if (!card) {
      setError('Error: tarjeta no cargada');
      return;
    }
    
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }
    
    try {
      // Actualizar el estado activo del enlace
      const updatedLinks = card.links.map(link => 
        link.id === linkId ? { ...link, active: !link.active } : link
      );
      
      // Actualizar la tarjeta con los enlaces actualizados
      const updatedCard = {
        ...card,
        links: updatedLinks
      };
      
      // Actualizar el documento del usuario
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const updatedCards = userData.cards.map((c: Card) => 
          c.id === cardId ? updatedCard : c
        );
        
        await updateDoc(userDocRef, { cards: updatedCards });
        setCard(updatedCard as Card);
        setSuccess('Estado del enlace actualizado');
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error: any) {
      console.error('Error al actualizar estado del enlace:', error);
      setError('Error al actualizar el estado del enlace. Inténtalo de nuevo.');
    }
  };

  // Funciones para gestión de productos
  // Mostrar selector de productos
  const toggleProductSelector = () => {
    setShowProductSelector(!showProductSelector);
  };

  // Agregar un producto a la tarjeta
  const handleAddProductToCard = async (product: Product) => {
    if (!card) {
      setError('Error: tarjeta no cargada');
      return;
    }
    
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }
    
    try {
      // Verificar si el producto ya está en la tarjeta
      const productExists = card.products?.some(p => p.id === product.id);
      if (productExists) {
        setError('Este producto ya está en la tarjeta');
        return;
      }
      
      // Asegurarse de que el precio sea un número
      const productToAdd = {
        ...product,
        price: typeof product.price === 'number' ? product.price : parseFloat(product.price as any) || 0
      };
      
      // Actualizar la tarjeta con el nuevo producto
      const updatedCard = {
        ...card,
        products: [...(card.products || []), productToAdd]
      };
      
      // Actualizar el documento del usuario
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const updatedCards = userData.cards.map((c: Card) => 
          c.id === cardId ? updatedCard : c
        );
        
        await updateDoc(userDocRef, { cards: updatedCards });
        setCard(updatedCard as Card);
        setSuccess('Producto agregado a la tarjeta');
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error: any) {
      console.error('Error al agregar producto:', error);
      setError('Error al agregar el producto. Inténtalo de nuevo.');
    }
  };

  // Eliminar un producto de la tarjeta
  const handleRemoveProductFromCard = async (productId: string) => {
    if (!card) {
      setError('Error: tarjeta no cargada');
      return;
    }
    
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }
    
    try {
      // Filtrar los productos para eliminar el producto seleccionado
      const updatedProducts = card.products?.filter(product => product.id !== productId) || [];
      
      // Actualizar la tarjeta con los productos actualizados
      const updatedCard = {
        ...card,
        products: updatedProducts
      };
      
      // Actualizar el documento del usuario
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const updatedCards = userData.cards.map((c: Card) => 
          c.id === cardId ? updatedCard : c
        );
        
        await updateDoc(userDocRef, { cards: updatedCards });
        setCard(updatedCard as Card);
        setSuccess('Producto eliminado de la tarjeta');
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error: any) {
      console.error('Error al eliminar producto:', error);
      setError('Error al eliminar el producto. Inténtalo de nuevo.');
    }
  };

  // Copiar enlace al portapapeles
  const copyLinkToClipboard = (linkUrl: string) => {
    navigator.clipboard.writeText(linkUrl)
      .then(() => {
        setSuccess('Enlace copiado al portapapeles');
        setTimeout(() => setSuccess(null), 3000);
      })
      .catch(err => {
        setError('Error al copiar el enlace');
        console.error('Error al copiar:', err);
      });
  };

  // Función auxiliar para formatear el precio de manera segura
  const formatPrice = (price: any): string => {
    if (typeof price === 'number') {
      return price.toFixed(2);
    }
    
    const numericPrice = parseFloat(price);
    if (!isNaN(numericPrice)) {
      return numericPrice.toFixed(2);
    }
    
    return '0.00';
  };

  // Helper function to upload image and get URL
  const uploadImageAndGetURL = async (file: File): Promise<string> => {
    try {
      const auth = getAuth();
      if (!auth.currentUser) throw new Error('User not authenticated');
      
      const storageRef = ref(storage, `cards/${auth.currentUser.uid}/${uuidv4()}`);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  };

  // Agrega esta función para obtener los productos del usuario
  const fetchUserProducts = async (userId: string) => {
    try {
      // Intenta obtener los productos desde el documento del usuario
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Si el usuario tiene productos, establécelos en el estado
        if (userData.products && Array.isArray(userData.products)) {
          setUserProducts(userData.products);
        } else {
          // Crea algunos productos de ejemplo si no hay ninguno
          const demoProducts = [
            {
              id: 'demo1',
              title: 'Producto Demo 1',
              description: 'Este es un producto de ejemplo',
              price: 19.99,
              imageURL: '',
              active: true
            },
            {
              id: 'demo2',
              title: 'Producto Demo 2',
              description: 'Otro producto de ejemplo',
              price: 29.99,
              imageURL: '',
              active: true
            }
          ];
          setUserProducts(demoProducts);
        }
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  if (loading) {
    return (
      <div className="container text-center mt-5">
        <div className="loader"></div>
        <p>Cargando datos de la tarjeta...</p>
      </div>
    );
  }

  if (error && !card) {
    return (
      <div className="container mt-5">
        <div className="alert alert-error">
          {error}
        </div>
        <button 
          className="btn btn-primary mt-3"
          onClick={() => navigate('/dashboard')}
        >
          Volver al Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="card-editor-container">
      {userData && <Header user={userData} />}
      
      <div className="card-editor-header">
        <h1 className="card-editor-title">Editor de Tarjeta</h1>
        <button 
          className="btn btn-secondary"
          onClick={() => navigate('/dashboard')}
        >
          Volver al Dashboard
        </button>
      </div>
      
      {/* Mensaje de error */}
      {error && (
        <div className="alert alert-error mb-4">
          {error}
        </div>
      )}
      
      {/* Mensaje de éxito */}
      {success && (
        <div className="alert alert-success mb-4">
          {success}
        </div>
      )}
      
      <div className="card-editor-content">
        <div className="card-editor-form-container">
          {/* Formulario para editar datos de la tarjeta */}
          <div className="card-editor-form">
            <div className="form-section">
              <h2 className="section-title">Datos de la Tarjeta</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="title" className="form-label">Título</label>
                  <input
                    type="text"
                    id="title"
                    className="form-control"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="description" className="form-label">Descripción</label>
                  <textarea
                    id="description"
                    className="form-control"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="image" className="form-label">Imagen de la tarjeta</label>
                  <input type="file" id="image" name="image" accept="image/*" onChange={handleFileChange} />
                  {imagePreview && (
                    <div className="mt-2">
                      <img src={imagePreview} alt="Vista previa" className="w-32 h-32 object-cover" />
                    </div>
                  )}
                </div>
                {/* Background Configuration Section */}
                <div className="form-section">
                  <h3 className="section-title">Configuración del fondo</h3>
                  <div className="form-group">
                    <label className="form-label">Tipo de fondo</label>
                    <div className="background-type-buttons">
                      <button
                        type="button"
                        onClick={() => handleBackgroundTypeChange('color')}
                        className={`background-type-button ${backgroundType === 'color' ? 'active' : ''}`}
                      >
                        Color sólido
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBackgroundTypeChange('gradient')}
                        className={`background-type-button ${backgroundType === 'gradient' ? 'active' : ''}`}
                      >
                        Gradiente
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBackgroundTypeChange('image')}
                        className={`background-type-button ${backgroundType === 'image' ? 'active' : ''}`}
                      >
                        Imagen
                      </button>
                    </div>
                  </div>
                  {backgroundType === 'color' && (
                    <div className="form-group">
                      <label htmlFor="backgroundColor" className="form-label">Color de fondo</label>
                      <input
                        type="color"
                        id="backgroundColor"
                        value={backgroundColor || '#ffffff'}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                      />
                    </div>
                  )}
                  {backgroundType === 'gradient' && (
                    <div className="form-group">
                      <label htmlFor="backgroundGradient" className="form-label">Gradiente</label>
                      <select
                        id="backgroundGradient"
                        value={backgroundGradient || 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)'}
                        onChange={(e) => setBackgroundGradient(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm"
                      >
                        <option value="linear-gradient(to right, #4facfe 0%, #00f2fe 100%)">Azul a Cyan</option>
                        <option value="linear-gradient(to right, #fa709a 0%, #fee140 100%)">Rosa a Amarillo</option>
                        <option value="linear-gradient(to right, #43e97b 0%, #38f9d7 100%)">Verde a Turquesa</option>
                        <option value="linear-gradient(to right, #ff0844 0%, #ffb199 100%)">Rojo a Naranja</option>
                        <option value="linear-gradient(to right, #6a11cb 0%, #2575fc 100%)">Púrpura a Azul</option>
                      </select>
                      <div className="mt-2 h-10 w-full rounded-md" style={{ background: backgroundGradient || 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)' }}></div>
                    </div>
                  )}
                  {backgroundType === 'image' && (
                    <div className="form-group">
                      <label htmlFor="backgroundImage" className="form-label">Imagen de fondo</label>
                      <input 
                        type="file" 
                        id="backgroundImage" 
                        name="backgroundImage" 
                        accept="image/*" 
                        onChange={handleBackgroundFileChange} 
                      />
                      {backgroundImageURL && (
                        <div className="mt-2">
                          <img src={backgroundImageURL} alt="Vista previa del fondo" className="w-full h-32 object-cover rounded-md" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="form-section">
                  {card?.autoUrl && (
                    <div className="form-group">
                      <label className="form-label">URL de la tarjeta</label>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          value={card.autoUrl}
                          readOnly
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => copyLinkToClipboard(card.autoUrl || '')}
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}
                  <button 
                    type="submit" 
                    className="generate-button mt-3"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
          {/* Productos en la tarjeta */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="card-title mb-0">Productos en la Tarjeta</h2>
                <button 
                  className="btn btn-warning"
                  onClick={toggleProductSelector}
                >
                  {showProductSelector ? 'Cerrar Selector' : 'Agregar Producto'}
                </button>
              </div>
              {/* Lista de productos en la tarjeta */}
              {card && card.products && card.products.length > 0 ? (
                <div className="card-products">
                  {card.products.map(product => (
                    <div key={product.id} className="card-product-item">
                      <img src={product.imageURL} alt={product.title} className="card-product-image" />
                      <div className="card-product-details">
                        <p className="card-product-title">{product.title}</p>
                        <p className="card-product-price">${formatPrice(product.price)}</p>
                      </div>
                      <button 
                        className="card-product-remove-btn"
                        onClick={() => handleRemoveProductFromCard(product.id)}
                        title="Eliminar producto de la tarjeta"
                      >
                        <i className="bi bi-x-circle"></i>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center">Esta tarjeta no tiene productos todavía.</p>
              )}
            </div>
          </div>
          {/* Gestión de enlaces de la tarjeta */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="card-title mb-0">Enlaces de la Tarjeta</h2>
                <button 
                  className="btn btn-primary"
                  onClick={openAddLinkForm}
                >
                  Añadir Enlace
                </button>
              </div>
              {/* Formulario para añadir/editar enlaces */}
              {showLinkForm && (
                <div className="card mb-3">
                  <div className="card-body">
                    <h3 className="card-title">{editingLinkId ? 'Editar Enlace' : 'Añadir Nuevo Enlace'}</h3>
                    <form onSubmit={handleSaveLink}>
                      <div className="form-group">
                        <label htmlFor="linkTitle" className="form-label">Título del Enlace</label>
                        <input
                          type="text"
                          id="linkTitle"
                          className="form-control"
                          value={linkTitle}
                          onChange={(e) => setLinkTitle(e.target.value)}
                          placeholder="Nombre de tu enlace"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="linkUrl" className="form-label">URL</label>
                        <input
                          type="text"
                          id="linkUrl"
                          className="form-control"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="https://tuenlace.com"
                          required
                        />
                      </div>
                      <div className="d-flex gap-2">
                        <button 
                          type="submit" 
                          className="btn btn-primary"
                          disabled={loading}
                        >
                          {loading ? 'Guardando...' : editingLinkId ? 'Actualizar Enlace' : 'Añadir Enlace'}
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          onClick={() => {
                            setLinkTitle('');
                            setLinkUrl('');
                            setEditingLinkId(null);
                            setShowLinkForm(false);
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
              {/* Lista de enlaces */}
              {card && card.links.length > 0 ? (
                <ul className="list-group">
                  {card.links.map((link) => (
                    <li key={link.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <div className="d-flex align-items-center mb-1">
                            <input
                              type="checkbox"
                              checked={link.active}
                              onChange={() => toggleLinkActive(link.id)}
                              className="form-check-input me-2"
                            />
                            <h5 className="mb-0">{link.title}</h5>
                          </div>
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="d-block text-truncate" style={{ maxWidth: '300px' }}>
                            {link.url}
                          </a>
                        </div>
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleEditLink(link)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteLink(link.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center">Esta tarjeta no tiene enlaces todavía.</p>
              )}
            </div>
          </div>
          {/* Selector de productos (aparece cuando showProductSelector es true) */}
          {showProductSelector && (
            <div className="card product-selector-sidebar">
              <div className="card-header">
                <h2 className="card-title mb-0">Seleccionar Producto</h2>
              </div>
              <div className="card-body product-selector-body">
                {userProducts && userProducts.length > 0 ? (
                  userProducts.map(product => (
                    <div key={product.id} className="product-selector-item">
                      <div className="product-selector-image">
                        {product.imageURL ? (
                          <img src={product.imageURL} alt={product.title} />
                        ) : (
                          <span>📦</span>
                        )}
                      </div>
                      <div className="product-selector-details">
                        <h4>{product.title || "Producto"}</h4>
                        <p>${formatPrice(product.price || 0)}</p>
                      </div>
                      <button 
                        className="product-selector-add-btn"
                        onClick={() => handleAddProductToCard(product)}
                      >
                        Agregar
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-product-list">
                    <div className="empty-product-list-icon">📦</div>
                    <p>No tienes productos disponibles.</p>
                    <p>Ve a la sección de Productos para crear algunos.</p>
                  </div>
                )}
              </div>
              <div className="card-footer">
                <button 
                  className="close-selector-btn" 
                  onClick={toggleProductSelector}
                >
                  Cerrar Selector
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="card-preview-container">
          <div className="card-preview">
            {/* Aquí podrías mostrar una previsualización de la tarjeta si lo deseas */}
            {imagePreview ? (
              <img src={imagePreview} alt="Vista previa de la tarjeta" />
            ) : (
              <span>Previsualización de la tarjeta</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardEditor; 