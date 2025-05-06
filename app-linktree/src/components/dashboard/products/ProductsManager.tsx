import React, { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc, getDoc, collection, query, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import { 
  compressImage, 
  compressProductImage, 
  getImagePreview, 
  CompressionStatus 
} from '../../../utils/imageCompression';
import { deleteImageFromStorage, uploadCardImage } from '../../../utils/storageUtils';
import CompressionInfo from '../../common/CompressionInfo';
import './css/ProductsManager.css';
import { useAuth } from '../../../context/AuthContext';
import { FiEdit, FiEye, FiEyeOff, FiTrash2, FiRefreshCw } from 'react-icons/fi';

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

interface ProductsManagerProps {
  userData: any;
}

// Definir límites de productos por plan (FREE = 2, según solicitud)
const PRODUCT_LIMITS = {
  FREE: 2, 
  BASIC: 20,
  PRO: Infinity,
  ADMIN: Infinity,
};

const ProductsManager: React.FC<ProductsManagerProps> = ({ userData }) => {
  // Obtener el plan efectivo del contexto
  const { effectivePlan, loadingAuth, loadingProfile } = useAuth(); 

  // Estado de compresión
  const [compressionStatus, setCompressionStatus] = useState<CompressionStatus>('idle');
  const [compressionData, setCompressionData] = useState<{
    originalSize?: number;
    compressedSize?: number;
    originalFormat?: string;
    compressionRatio?: number;
  }>({});
  const [compressionInfo, setCompressionInfo] = useState<string>('');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formExpanded, setFormExpanded] = useState(false);
  // Control del modal de edición lateral
  const [showEditModal, setShowEditModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  // Modal de creación
  const [showAddModal, setShowAddModal] = useState(false);
  const [isClosingAdd, setIsClosingAdd] = useState(false);
  const [internalLoading, setInternalLoading] = useState(true);

  // Cargar productos existentes desde userData al montar o cuando userData cambie
  useEffect(() => {
    setInternalLoading(true);
    setError(null);
    let unsubscribe: (() => void) | null = null;

    if (userData && userData.uid) {
      console.log(`[ProductsManager] Estableciendo listener para productos del usuario: ${userData.uid}`);
      const productsCollectionRef = collection(db, 'users', userData.uid, 'products');
      const q = query(productsCollectionRef);

      unsubscribe = onSnapshot(q, 
        (querySnapshot) => {
          const fetchedProducts = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Product[];
          console.log("[ProductsManager] Productos recibidos del listener:", fetchedProducts.length);
          setProducts(fetchedProducts);
          setInternalLoading(false);
        },
        (error) => {
          console.error("[ProductsManager] Error al escuchar productos:", error);
          setError("Error al cargar los productos en tiempo real. Inténtalo de nuevo.");
          setInternalLoading(false);
        }
      );
    } else {
      console.log("[ProductsManager] No hay userData.uid, no se puede cargar productos.");
      setProducts([]);
      setInternalLoading(false);
    }

    return () => {
      if (unsubscribe) {
        console.log("[ProductsManager] Cancelando listener de productos.");
        unsubscribe();
      }
    };
  }, [userData]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const originalFile = e.target.files[0];
      
      try {
        // Actualizar estado para mostrar que la compresión está en proceso
        setCompressionStatus('compressing');
        setCompressionInfo('Comprimiendo... Por favor espera.');
        
        // Usar la función especializada para compresión de productos
        const result = await compressProductImage(originalFile);
        
        // Actualizar estado de compresión con el resultado
        setCompressionStatus(result.success ? 'success' : 'error');
        setCompressionData({
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          originalFormat: result.originalFormat,
          compressionRatio: result.compressionRatio
        });
        
        // Guardar información para mostrar al usuario (para compatibilidad)
        setCompressionInfo(result.infoText);
        
        // Usar archivo comprimido
        setFile(result.file);
        
        // Generar preview
        const previewUrl = await getImagePreview(result.file);
        setImagePreview(previewUrl);
        
      } catch (error) {
        console.error('Error al comprimir imagen:', error);
        // Si falla la compresión, usar el archivo original
        setCompressionStatus('error');
        setCompressionInfo(`⚠️ No se pudo comprimir. Usando archivo original (${(originalFile.size / 1024).toFixed(2)} KB)`);
        setFile(originalFile);
        
        // Preview del archivo original
        const previewUrl = await getImagePreview(originalFile);
        setImagePreview(previewUrl);
      }
    } else {
      setFile(null);
      setImagePreview(null);
      setCompressionStatus('idle');
      setCompressionInfo('');
    }
  };

  // Función para validar URL
  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Función para generar una URL automática
  const generateAutoUrl = (title: string, username: string) => {
    // Asegurar que title y username sean strings válidos
    const safeTitle = title || 'producto';
    const safeUsername = username || 'usuario';
    
    const slug = safeTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-');
    
    // Usar el dominio de Firebase Hosting en lugar de window.location.origin
    const firebaseHostingDomain = 'https://klycs-58190.firebaseapp.com';
    
    return `${firebaseHostingDomain}/${safeUsername}/product/${slug}-${Date.now().toString(36)}`;
  };

  // Calcular si el usuario puede crear más productos
  const currentProductCount = products.length;
  const productLimit = PRODUCT_LIMITS[effectivePlan] || 0;
  const canCreateMoreProducts = currentProductCount < productLimit;

  // Añadir o actualizar producto
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingId && !canCreateMoreProducts) {
        setError(`Has alcanzado el límite de ${productLimit} productos para tu plan ${effectivePlan}.`);
        return;
    }
    
    if (!title.trim() || !price.trim() || isNaN(parseFloat(price)) ) {
      setError('El título y un precio válido son obligatorios.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    if (!userData || !userData.uid) {
        setError("No se pudo obtener la información del usuario.");
        setLoading(false);
        return;
    }

    const productsCollectionRef = collection(db, 'users', userData.uid, 'products');
    
    try {
      let imageURL = editingId ? products.find(p => p.id === editingId)?.imageURL : '';
      
      if (file) {
        try {
          const oldImageUrl = editingId ? imageURL : undefined;
          imageURL = await uploadCardImage(file, userData.uid, 'product', oldImageUrl);
        } catch (uploadError: any) {
          console.error('Error al subir imagen del producto:', uploadError);
          setError('Error al subir la imagen. Se usará una imagen por defecto.');
          imageURL = imageURL || 'https://via.placeholder.com/400x300?text=Error+Imagen';
        }
      } else if (!editingId && !imageURL) {
          imageURL = 'https://via.placeholder.com/400x300?text=Sin+Imagen';
      }
      
      let finalUrl = url.trim();
      if (finalUrl && !isValidUrl(finalUrl)) {
          if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
              finalUrl = 'http://' + finalUrl;
              if (!isValidUrl(finalUrl)) {
                  setError('La URL externa proporcionada no es válida.');
                  setLoading(false);
                  return;
              }
          } else {
             setError('La URL externa proporcionada no es válida.');
             setLoading(false);
             return;
          }
      }

      const productData: Omit<Product, 'id'> = {
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        imageURL: imageURL as string,
        url: finalUrl || undefined,
        autoUrl: generateAutoUrl(title.trim(), userData.username || userData.uid),
        active: editingId ? products.find(p => p.id === editingId)?.active ?? true : true,
      };

      if (editingId) {
        const productRef = doc(db, 'users', userData.uid, 'products', editingId);
        await updateDoc(productRef, productData);
        setSuccess('Producto actualizado correctamente');
      } else {
        await addDoc(productsCollectionRef, productData);
        setSuccess('Producto añadido correctamente');
      }

      resetForm();
      closeAddModal();
      closeModal();
      
      setTimeout(() => setSuccess(null), 3000);

    } catch (error: any) {
      console.error('Error al guardar el producto:', error);
      setError(`Error al guardar el producto: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [editingId, canCreateMoreProducts, productLimit, effectivePlan, title, price, file, userData, url, description, products]);

  // Editar producto (abrir modal lateral)
  const handleEdit = (product: Product) => {
    setTitle(product.title);
    setDescription(product.description);
    setPrice(product.price.toString());
    setUrl(product.url || '');
    setImagePreview(product.imageURL);
    setEditingId(product.id);
    setIsClosing(false);
    setShowEditModal(true);
  };

  // Cerrar modal con animacion
  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowEditModal(false);
      setEditingId(null);
      setError(null);
      setIsClosing(false);
    }, 300);
  };

  // Eliminar producto
  const handleDelete = useCallback(async (id: string) => {
    if (!userData || !userData.uid) {
      setError("No se pudo obtener la información del usuario.");
      return;
    }

    const productToDelete = products.find(p => p.id === id);
    if (!productToDelete) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    
    const productRef = doc(db, 'users', userData.uid, 'products', id);
    
    try {
      if (productToDelete.imageURL && !productToDelete.imageURL.includes('via.placeholder.com')) {
          try {
              const imageRef = ref(storage, productToDelete.imageURL);
              await deleteObject(imageRef);
              console.log("Imagen del producto eliminada de Storage:", productToDelete.imageURL);
          } catch (storageError: any) {
              if (storageError.code !== 'storage/object-not-found') {
                  console.warn("Error al eliminar imagen de Storage (se continúa con la eliminación del documento):", storageError);
              }
          }
      }
      
      await deleteDoc(productRef);
      console.log("Producto eliminado de Firestore:", id);
      setSuccess("Producto eliminado correctamente.");
      setTimeout(() => setSuccess(null), 3000);

    } catch (error: any) {
      console.error('Error al eliminar producto:', error);
      setError('Error al eliminar el producto. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [userData, products]);

  // Alternar estado activo
  const toggleActive = useCallback(async (id: string) => {
      if (!userData || !userData.uid) return;
      
      const productToToggle = products.find(p => p.id === id);
      if (!productToToggle) return;
      
      const newActiveState = !productToToggle.active;
      const productRef = doc(db, 'users', userData.uid, 'products', id);
      
      try {
          await updateDoc(productRef, { active: newActiveState });
          setSuccess(`Producto ${newActiveState ? 'activado' : 'desactivado'}.`);
          setTimeout(() => setSuccess(null), 3000);
      } catch (error) {
          console.error("Error al cambiar estado active del producto:", error);
          setError("Error al cambiar el estado del producto.");
      }
  }, [userData, products]);

  // Regenerar URL automática para un producto
  const regenerateAutoUrl = useCallback(async (id: string) => {
      if (!userData || !userData.uid) return;
      
      const productToUpdate = products.find(p => p.id === id);
      if (!productToUpdate) return;
      
      const newAutoUrl = generateAutoUrl(productToUpdate.title, userData.username || userData.uid);
      const productRef = doc(db, 'users', userData.uid, 'products', id);
      
      setLoading(true);
      try {
          await updateDoc(productRef, { autoUrl: newAutoUrl });
          setSuccess('URL automática regenerada.');
          setTimeout(() => setSuccess(null), 3000);
      } catch (error) {
          console.error("Error al regenerar autoUrl:", error);
          setError("Error al regenerar la URL automática.");
      } finally {
         setLoading(false);
      }
  }, [userData, products]);

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

  // Resetear formulario
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPrice('');
    setUrl('');
    setFile(null);
    setImagePreview(null);
    setEditingId(null);
    setFormExpanded(false);
    setCompressionInfo('');
  };

  // Abrir modal para añadir producto
  const openAddModal = () => {
    resetForm();
    setEditingId(null);
    setIsClosingAdd(false);
    setShowAddModal(true);
  };

  // Cerrar modal de añadir con animación
  const closeAddModal = () => {
    setIsClosingAdd(true);
    setTimeout(() => {
      setShowAddModal(false);
      setIsClosingAdd(false);
      resetForm();
    }, 300);
  };

  // Si el contexto de Auth/Profile aún está cargando, mostrar mensaje
  if (loadingAuth || loadingProfile || internalLoading) {
     return <div className="products-loading">Cargando productos...</div>;
  }

  return (
    <div className="products-container">
      <div className="products-header">
        <h2>Gestionar Productos</h2>
        <p className="products-subtitle">Crea y administra productos que podrás compartir con tus clientes.</p>
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
      
      {/* Botón para añadir nuevo producto */}
      <div className="add-product-button-container">
        <button
          type="button"
          className="add-product-toggle-btn"
          onClick={openAddModal}
          disabled={!canCreateMoreProducts}
        >
          Añadir Nuevo Producto
        </button>
        
        {/* Botón para crear producto de prueba */}
        <button
          type="button"
          className="add-product-toggle-btn"
          style={{ marginLeft: '10px', backgroundColor: '#ff9800' }}
          onClick={() => {
            // Crear un producto de prueba
            const testProduct = {
              id: uuidv4(),
              title: 'Producto de Prueba',
              description: 'Este es un producto de prueba generado automáticamente',
              price: 19.99,
              imageURL: 'https://via.placeholder.com/400x300?text=Producto+de+Prueba',
              url: 'https://ejemplo.com/producto',
              active: true
            };
            
            // Añadir a la lista de productos
            const updatedProducts = [...products, testProduct];
            setProducts(updatedProducts);
          }}
        >
          Crear Producto de Prueba
        </button>
      </div>
      
      {/* Lista de productos */}
      <div className="mb-4">
        <h3 className="mb-3">Tus Productos ({currentProductCount}/{productLimit === Infinity ? '∞' : productLimit})</h3>
        
        {products.length === 0 ? (
          <p>No tienes productos todavía. Añade tu primer producto arriba.</p>
        ) : (
          <div className="products-list">
            {products.map(product => (
              <div key={product.id} className={`product-card ${!product.active ? 'opacity-50' : ''}`}>
                {/* Imagen del producto con wrapper para reservar espacio */}
                <div className="product-image-wrapper">
                  <img
                    src={product.imageURL}
                    alt={product.title}
                    className="product-image"
                  />
                </div>
                {/* Botón de edición siempre visible sobre la imagen */}
                <button
                  className="product-img-edit-btn"
                  onClick={() => handleEdit(product)}
                  title="Editar producto"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="edit-icon"
                  >
                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                    <path d="M2 15.25V18h2.75l8.349-8.349-2.75-2.75L2 15.25z" />
                  </svg>
                  <span className="edit-label">Editar</span>
                </button>
                {/* Información permanente debajo de la imagen */}
                <div className="product-info">
                  <h4 className="product-title">{product.title}</h4>
                  {product.description && <p className="product-description">{product.description}</p>}
                  <p className="product-price">{(typeof product.price === 'number' ? product.price.toFixed(2) : product.price)} €</p>
                  {(product.url || product.autoUrl) && (
                    <p className="product-url"><a href={product.url || product.autoUrl} target="_blank" rel="noopener noreferrer">Visitar</a></p>
                  )}
                  <div className="product-actions">
                    <button className="product-btn delete" onClick={() => handleDelete(product.id)} title="Eliminar">🗑️</button>
                    <button className="product-btn share" onClick={() => copyLinkToClipboard(product.url || product.autoUrl || '')} title="Compartir">🔗</button>
                  </div>
                </div>
              </div>
            ))}
            {/* Placeholder cards para mantener layout de 4 columnas incluso con pocos productos */}
            {Array.from({ length: Math.max(0, 4 - products.length) }).map((_, idx) => (
              <div key={`placeholder-${idx}`} className="product-card placeholder">
                <div className="placeholder-content">
                  <svg className="placeholder-icon" width="48" height="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73L12 2 4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73L12 22l8-4.27A2 2 0 0 0 21 16z" stroke="#555" strokeWidth="2" fill="none"/>
                  </svg>
                  <p className="placeholder-text">Aquí irá tu producto</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal lateral de edición */}
      {showEditModal && editingId && (
        <div className="edit-modal-overlay" onClick={closeModal}>
          {/* Preview del producto a editar */}
          <div className={`edit-modal-preview ${isClosing ? 'closing' : 'opening'}`}>
            <div className="product-card">
              <img src={imagePreview || ''} alt="Preview" className="product-image" />
              <div className="product-info">
                <h4 className="product-title">{title}</h4>
                {description && <p className="product-description">{description}</p>}
                <p className="product-price">{price} €</p>
              </div>
            </div>
          </div>
          <div
            className={`edit-modal ${isClosing ? 'closing' : 'opening'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close-btn" onClick={closeModal}>&times;</button>
            <form onSubmit={handleSubmit} className="edit-modal-form">
              <h3>Editar Producto</h3>
              <div className="product-input-group">
                <label htmlFor="productTitle">Título</label>
                <input
                  type="text"
                  id="productTitle"
                  className="product-input form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="product-input-group">
                <label htmlFor="productDescription">Descripción</label>
                <textarea
                  id="productDescription"
                  className="product-textarea form-control"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="product-input-group">
                <label htmlFor="productPrice">Precio</label>
                <input
                  type="number"
                  id="productPrice"
                  className="product-input form-control"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div className="product-input-group image-upload-group">
                <label htmlFor="productImage">Imagen</label>
                <div className="upload-controls">
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="modal-preview" />
                  )}
                  <input
                    type="file"
                    id="productImage"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="form-control modal-file-input"
                  />
                  <CompressionInfo 
                    status={compressionStatus}
                    originalSize={compressionData.originalSize}
                    compressedSize={compressionData.compressedSize}
                    originalFormat={compressionData.originalFormat}
                    compressionRatio={compressionData.compressionRatio}
                    message={compressionInfo}
                  />
                </div>
              </div>
              {/* Botones de acción */}
              <div className="product-button-group modal-buttons">
                <button type="submit" className="product-add-btn" disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal creación de producto */}
      {showAddModal && (
        <div className="edit-modal-overlay" onClick={closeAddModal}>
          {/* Preview dinámico de nuevo producto */}
          <div className={`edit-modal-preview ${isClosingAdd ? 'closing' : 'opening'}`} onClick={e => e.stopPropagation()}>
            <div className="product-card">
              {/* Imagen o placeholder */}
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="product-image" />
              ) : (
                <div className="modal-placeholder">
                  {/* Icono de placeholder */}
                  <svg className="placeholder-icon" width="48" height="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73L12 2 4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73L12 22l8-4.27A2 2 0 0 0 21 16z" stroke="#555" strokeWidth="2" fill="none"/>
                  </svg>
                  <p className="placeholder-text">Aquí irá tu imagen</p>
                </div>
              )}
              <div className="product-info">
                <h4 className="product-title">{title || 'Aquí irá tu título'}</h4>
                <p className="product-description">{description || 'Aquí irá la descripción...'}</p>
                <p className="product-price">{price ? parseFloat(price).toFixed(2) + ' €' : '0.00 €'}</p>
              </div>
            </div>
          </div>
          <div
            className={`edit-modal ${isClosingAdd ? 'closing' : 'opening'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close-btn" onClick={closeAddModal}>&times;</button>
            <form onSubmit={handleSubmit} className="edit-modal-form">
              <h3>Añadir Nuevo Producto</h3>
              <div className="product-input-group">
                <label htmlFor="productTitle">Título</label>
                <input
                  type="text"
                  id="productTitle"
                  className="product-input form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="product-input-group">
                <label htmlFor="productDescription">Descripción</label>
                <textarea
                  id="productDescription"
                  className="product-textarea form-control"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="product-input-group">
                <label htmlFor="productPrice">Precio</label>
                <input
                  type="number"
                  id="productPrice"
                  className="product-input form-control"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div className="product-input-group">
                <label htmlFor="productUrl">URL</label>
                <input
                  type="url"
                  id="productUrl"
                  className="product-input form-control"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://tudominio.com/producto"
                  required
                />
              </div>
              <div className="product-input-group image-upload-group">
                <label htmlFor="productImage">Imagen</label>
                <div className="upload-controls">
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="modal-preview" />
                  )}
                  <input
                    type="file"
                    id="productImage"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="form-control modal-file-input"
                  />
                  <CompressionInfo 
                    status={compressionStatus}
                    originalSize={compressionData.originalSize}
                    compressedSize={compressionData.compressedSize}
                    originalFormat={compressionData.originalFormat}
                    compressionRatio={compressionData.compressionRatio}
                    message={compressionInfo}
                  />
                </div>
              </div>
              <div className="product-button-group modal-buttons">
                <button type="submit" className="product-add-btn" disabled={loading}>
                  {loading ? 'Guardando...' : 'Crear Producto'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeAddModal}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsManager; 