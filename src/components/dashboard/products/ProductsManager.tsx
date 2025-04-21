import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import './css/ProductsManager.css';

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

const ProductsManager: React.FC<ProductsManagerProps> = ({ userData }) => {
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
  const [autoGenerateLinks, setAutoGenerateLinks] = useState(true);
  const [formExpanded, setFormExpanded] = useState(false);
  // Control del modal de edición lateral
  const [showEditModal, setShowEditModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  // Modal de creación
  const [showAddModal, setShowAddModal] = useState(false);
  const [isClosingAdd, setIsClosingAdd] = useState(false);

  // Cargar productos existentes cuando se monta el componente
  useEffect(() => {
    if (userData && userData.products) {
      // Verificar si hay productos sin URL automática y generarlas si la opción está activada
      const updatedProducts = userData.products.map((product: Product) => {
        if (!product.url && autoGenerateLinks && !product.autoUrl) {
          return {
            ...product,
            autoUrl: generateAutoUrl(product.title, userData.username || userData.uid)
          };
        }
        return product;
      });
      
      setProducts(updatedProducts);
      
      // Si hay cambios en los productos, guardarlos en Firestore
      if (JSON.stringify(updatedProducts) !== JSON.stringify(userData.products)) {
        saveProductsToFirestore(updatedProducts);
      }
    }
  }, [userData, autoGenerateLinks]);

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
      setImagePreview(null);
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

  // Guardar productos en Firestore
  const saveProductsToFirestore = async (updatedProducts: Product[]) => {
    if (!userData || !userData.uid) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const userDocRef = doc(db, 'users', userData.uid);
      await updateDoc(userDocRef, { products: updatedProducts });
      setSuccess('Productos guardados correctamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Error al guardar productos:', error);
      setError('Error al guardar cambios. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Añadir o actualizar producto
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Debes proporcionar un título para el producto');
      return;
    }
    
    if (!price.trim() || isNaN(parseFloat(price))) {
      setError('Debes proporcionar un precio válido');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      let formattedUrl = url.trim();
      let autoUrl: string | undefined = undefined;
      let imageURL = '';
      
      // Si no hay URL pero autoGenerateLinks está activado, generar una URL automática
      if (!formattedUrl && autoGenerateLinks) {
        autoUrl = generateAutoUrl(title, userData.username || userData.uid);
      } else if (formattedUrl) {
        // Validar URL y añadir http:// si no lo tiene
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
          formattedUrl = 'https://' + formattedUrl;
        }
        
        if (!isValidUrl(formattedUrl)) {
          setError('Por favor, introduce una URL válida');
          setLoading(false);
          return;
        }
      }
      
      // Subir imagen a Firebase Storage si hay un archivo nuevo
      if (file) {
        try {
          const storageRef = ref(storage, `products/${userData.uid}/${uuidv4()}`);
          await uploadBytes(storageRef, file);
          imageURL = await getDownloadURL(storageRef);
        } catch (storageError: any) {
          console.error('Error al subir imagen:', storageError);
          // Si hay un error al subir a Storage, usar una imagen de placeholder
          imageURL = 'https://via.placeholder.com/400x300?text=Sin+Imagen';
        }
      } else if (editingId) {
        // Mantener la imagen actual si es una edición
        const currentProduct = products.find(p => p.id === editingId);
        imageURL = currentProduct?.imageURL || '';
      } else {
        // Si no hay imagen, usa una imagen de marcador de posición
        imageURL = 'https://via.placeholder.com/400x300?text=Sin+Imagen';
      }
      
      let updatedProducts = [...products];
      
      if (editingId) {
        // Actualizar producto existente
        updatedProducts = updatedProducts.map(product => 
          product.id === editingId ? { 
            ...product, 
            title, 
            description,
            price: parseFloat(price),
            url: formattedUrl || '',
            autoUrl: !formattedUrl ? autoUrl : undefined,
            imageURL
          } : product
        );
        // Cerrar edición y modal
        setEditingId(null);
        setShowEditModal(false);
      } else {
        // Añadir nuevo producto
        const newProduct: Product = {
          id: uuidv4(),
          title,
          description,
          price: parseFloat(price),
          url: formattedUrl || '',
          autoUrl: !formattedUrl ? autoUrl : undefined,
          imageURL,
          active: true
        };
        updatedProducts = [...updatedProducts, newProduct];
        // Cerrar modal de creación
        closeAddModal();
      }
      
      setProducts(updatedProducts);
      await saveProductsToFirestore(updatedProducts);
      
      // Limpiar formulario
      setTitle('');
      setDescription('');
      setPrice('');
      setUrl('');
      setFile(null);
      setImagePreview(null);
      setFormExpanded(false);
      
      setSuccess(editingId ? 'Producto actualizado' : 'Producto guardado correctamente');
    } catch (error: any) {
      console.error('Error al guardar producto:', error);
      setError('Error al guardar el producto. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

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
  const handleDelete = (id: string) => {
    const updatedProducts = products.filter(product => product.id !== id);
    setProducts(updatedProducts);
    saveProductsToFirestore(updatedProducts);
  };

  // Alternar estado activo
  const toggleActive = (id: string) => {
    const updatedProducts = products.map(product => 
      product.id === id ? { ...product, active: !product.active } : product
    );
    setProducts(updatedProducts);
    saveProductsToFirestore(updatedProducts);
  };

  // Regenerar URL automática para un producto
  const regenerateAutoUrl = (id: string) => {
    const updatedProducts = products.map(product => {
      if (product.id === id) {
        return {
          ...product,
          autoUrl: generateAutoUrl(product.title, userData.username || userData.uid)
        };
      }
      return product;
    });
    
    setProducts(updatedProducts);
    saveProductsToFirestore(updatedProducts);
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

  return (
    <div className="products-container">
      <div className="products-header">
        <h2>Gestionar Productos</h2>
        <div className="form-check">
          <input
            type="checkbox"
            id="autoGenerateProductLinks"
            className="form-check-input"
            checked={autoGenerateLinks}
            onChange={() => setAutoGenerateLinks(!autoGenerateLinks)}
          />
          <label htmlFor="autoGenerateProductLinks" className="form-check-label">
            Generar enlaces automáticamente para productos sin URL
          </label>
        </div>
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
        >
          Añadir Nuevo Producto
        </button>
      </div>
      
      {/* Lista de productos */}
      <div className="mb-4">
        <h3 className="mb-3">Tus Productos</h3>
        
        {products.length === 0 ? (
          <p>No tienes productos todavía. Añade tu primer producto arriba.</p>
        ) : (
          <div className="products-list">
            {products.map(product => (
              <div key={product.id} className={`product-card ${!product.active ? 'opacity-50' : ''}`}>
                {/* Imagen del producto */}
                <img
                  src={product.imageURL}
                  alt={product.title}
                  className="product-image"
                />
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="placeholder-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9 6 9-6" />
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