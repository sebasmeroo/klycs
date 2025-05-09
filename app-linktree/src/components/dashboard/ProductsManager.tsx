import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import { Product } from '../cardeditor/types';

interface ProductsManagerProps {
  userData: any;
}

const ProductsManager: React.FC<ProductsManagerProps> = ({ userData }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [productType, setProductType] = useState<'digital' | 'service'>('digital');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cargar productos existentes cuando se monta el componente
  useEffect(() => {
    if (userData && userData.products) {
      const loadedProducts = userData.products.map((p: any) => {
        let numericPrice = 0;
        if (typeof p.price === 'number') {
          numericPrice = p.price;
        } else if (typeof p.price === 'string') {
          numericPrice = parseFloat(String(p.price).replace(',', '.') || '0');
        } // Si no es string o number, se queda en 0 por defecto. 
          // Esto simplifica el manejo de tipos para datos antiguos/inesperados.

        return {
          id: p.id,
          title: p.name || p.title || '',
          description: p.description || '',
          price: isNaN(numericPrice) ? 0 : numericPrice, 
          imageURL: p.imageUrl || p.imageURL,
          type: p.type || 'digital',
          active: p.active !== undefined ? p.active : true,
          autoUrl: p.autoUrl, // Incluir si existen en tu tipo Product
          url: p.url,         // Incluir si existen en tu tipo Product
        };
      });
      setProducts(loadedProducts);
    }
  }, [userData]);

  // Guardar productos en Firestore
  const saveProductsToFirestore = async (updatedProducts: Product[]) => {
    if (!userData || !userData.uid) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const userDocRef = doc(db, 'users', userData.uid);
      const productsToSave = updatedProducts.map(p => ({
        ...p,
        price: typeof p.price === 'string' ? parseFloat(p.price.replace(',', '.')) : p.price,
      }));
      await updateDoc(userDocRef, { products: productsToSave });
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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Debes proporcionar un nombre para el producto');
      return;
    }
    
    if (!price.trim()) {
      setError('Debes proporcionar un precio');
      return;
    }
    
    const numericPrice = parseFloat(price.replace(',', '.'));
    if (isNaN(numericPrice)) {
      setError('Por favor, introduce un precio válido');
      return;
    }
    
    let updatedProducts = [...products];
    
    if (editingId) {
      // Actualizar producto existente
      updatedProducts = updatedProducts.map(product => 
        product.id === editingId ? { 
          ...product, 
          title,
          description, 
          price: numericPrice,
          imageURL,
          type: productType,
        } : product
      );
      setEditingId(null);
    } else {
      // Añadir nuevo producto
      const newProduct: Product = {
        id: uuidv4(),
        title,
        description,
        price: numericPrice,
        imageURL,
        type: productType,
        active: true
      };
      updatedProducts = [...updatedProducts, newProduct];
    }
    
    setProducts(updatedProducts);
    saveProductsToFirestore(updatedProducts);
    setTitle('');
    setDescription('');
    setPrice('');
    setImageURL('');
    setProductType('digital');
  };

  // Editar producto
  const handleEdit = (product: Product) => {
    setTitle(product.title);
    setDescription(product.description || '');
    setPrice(String(product.price));
    setImageURL(product.imageURL || '');
    setProductType(product.type || 'digital');
    setEditingId(product.id);
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

  return (
    <div>
      <h2 className="mb-4">Gestionar Productos</h2>
      
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
      
      {/* Formulario para añadir o editar productos */}
      <form onSubmit={handleSubmit} className="card mb-4">
        <h3 className="mb-3">{editingId ? 'Editar Producto' : 'Añadir Nuevo Producto'}</h3>
        
        <div className="form-group">
          <label htmlFor="productTitle">Nombre</label>
          <input
            type="text"
            id="productTitle"
            className="form-control"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre de tu producto"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="productDescription">Descripción</label>
          <textarea
            id="productDescription"
            className="form-control"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe tu producto"
            rows={3}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="productPrice">Precio (€)</label>
          <input
            type="text"
            id="productPrice"
            className="form-control"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="19.99"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="productType">Tipo de Producto</label>
          <select
            id="productType"
            className="form-control"
            value={productType}
            onChange={(e) => setProductType(e.target.value as 'digital' | 'service')}
          >
            <option value="digital">Digital</option>
            <option value="service">Servicio</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="productImageURL">URL de imagen</label>
          <input
            type="text"
            id="productImageURL"
            className="form-control"
            value={imageURL}
            onChange={(e) => setImageURL(e.target.value)}
            placeholder="https://ejemplo.com/imagen.jpg"
          />
        </div>
        
        <div className="d-flex gap-2">
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
          >
            {loading ? 'Guardando...' : editingId ? 'Actualizar Producto' : 'Añadir Producto'}
          </button>
          
          {editingId && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                setEditingId(null);
                setTitle('');
                setDescription('');
                setPrice('');
                setImageURL('');
                setProductType('digital');
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
      
      {/* Lista de productos */}
      <div className="mb-4">
        <h3 className="mb-3">Tus Productos</h3>
        
        {products.length === 0 ? (
          <p>No tienes productos todavía. Añade tu primer producto arriba.</p>
        ) : (
          <div className="products-editor-container">
            {products.map((product) => (
              <div 
                key={product.id}
                className={`product-editor-item ${!product.active ? 'inactive' : ''}`}
              >
                <div className="product-editor-details">
                  {product.imageURL && (
                    <div className="product-editor-image">
                      <img src={product.imageURL} alt={product.title} />
                    </div>
                  )}
                  <div className="product-editor-info">
                    <p className="product-editor-name">{product.title}</p>
                    <p className="product-editor-price">{product.price} €</p>
                    {product.description && (
                      <p className="product-editor-description">{product.description}</p>
                    )}
                  </div>
                  <p className="product-editor-type" style={{fontSize: '0.8em', color: '#666'}}>Tipo: {product.type}</p>
                </div>
                
                <div className="product-editor-actions">
                  <button 
                    type="button" 
                    className="btn-icon" 
                    onClick={() => toggleActive(product.id)}
                    title={product.active ? 'Desactivar producto' : 'Activar producto'}
                  >
                    {product.active ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button 
                    type="button" 
                    className="btn-icon" 
                    onClick={() => handleEdit(product)}
                    title="Editar producto"
                  >
                    ✏️
                  </button>
                  <button 
                    type="button" 
                    className="btn-icon delete" 
                    onClick={() => handleDelete(product.id)}
                    title="Eliminar producto"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Vista previa */}
      <div className="card preview-section">
        <h3 className="mb-3">Vista Previa</h3>
        
        <div className="preview-container">
          {products.length === 0 ? (
            <p className="text-center">Añade productos para ver cómo se verán en tu perfil</p>
          ) : (
            <div className="products-grid">
              {products.filter(p => p.active === true || p.active === undefined).map((product) => (
                <div 
                  key={product.id}
                  className="product-preview-item"
                >
                  {product.imageURL && (
                    <div className="product-preview-image">
                      <img src={product.imageURL} alt={product.title} />
                    </div>
                  )}
                  <div className="product-preview-info">
                    <h4 className="product-preview-name">{product.title}</h4>
                    <p className="product-preview-price">{product.price} €</p>
                    {product.description && (
                      <p className="product-preview-description">{product.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductsManager; 