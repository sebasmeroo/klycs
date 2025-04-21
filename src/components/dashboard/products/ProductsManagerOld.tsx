import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import '../products/css/ProductsManager.css';

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  active: boolean;
}

interface ProductsManagerProps {
  userData: any;
}

const ProductsManagerOld: React.FC<ProductsManagerProps> = ({ userData }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cargar productos existentes cuando se monta el componente
  useEffect(() => {
    if (userData && userData.products) {
      setProducts(userData.products);
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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Debes proporcionar un nombre para el producto');
      return;
    }
    
    if (!price.trim()) {
      setError('Debes proporcionar un precio');
      return;
    }
    
    // Validar que el precio es un número
    if (isNaN(parseFloat(price.replace(',', '.')))) {
      setError('Por favor, introduce un precio válido');
      return;
    }
    
    let updatedProducts = [...products];
    
    if (editingId) {
      // Actualizar producto existente
      updatedProducts = updatedProducts.map(product => 
        product.id === editingId ? { 
          ...product, 
          name, 
          description, 
          price, 
          imageUrl 
        } : product
      );
      setEditingId(null);
    } else {
      // Añadir nuevo producto
      const newProduct: Product = {
        id: uuidv4(),
        name,
        description,
        price,
        imageUrl,
        active: true
      };
      updatedProducts = [...updatedProducts, newProduct];
    }
    
    setProducts(updatedProducts);
    saveProductsToFirestore(updatedProducts);
    setName('');
    setDescription('');
    setPrice('');
    setImageUrl('');
  };

  // Editar producto
  const handleEdit = (product: Product) => {
    setName(product.name);
    setDescription(product.description);
    setPrice(product.price);
    setImageUrl(product.imageUrl);
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
          <label htmlFor="productName">Nombre</label>
          <input
            type="text"
            id="productName"
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
          <label htmlFor="productImage">URL de imagen</label>
          <input
            type="text"
            id="productImage"
            className="form-control"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
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
                setName('');
                setDescription('');
                setPrice('');
                setImageUrl('');
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
                  {product.imageUrl && (
                    <div className="product-editor-image">
                      <img src={product.imageUrl} alt={product.name} />
                    </div>
                  )}
                  <div className="product-editor-info">
                    <p className="product-editor-name">{product.name}</p>
                    <p className="product-editor-price">{product.price} €</p>
                    {product.description && (
                      <p className="product-editor-description">{product.description}</p>
                    )}
                  </div>
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
              {products.filter(product => product.active).map((product) => (
                <div 
                  key={product.id}
                  className="product-preview-item"
                >
                  {product.imageUrl && (
                    <div className="product-preview-image">
                      <img src={product.imageUrl} alt={product.name} />
                    </div>
                  )}
                  <div className="product-preview-info">
                    <h4 className="product-preview-name">{product.name}</h4>
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

export default ProductsManagerOld; 