import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { v4 as uuidv4 } from 'uuid';

interface Link {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

interface LinksManagerProps {
  userData: any;
}

const LinksManager: React.FC<LinksManagerProps> = ({ userData }) => {
  const [links, setLinks] = useState<Link[]>([]);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);

  // Cargar enlaces existentes cuando se monta el componente
  useEffect(() => {
    if (userData && userData.links) {
      setLinks(userData.links);
    }
  }, [userData]);

  // Función para validar URL
  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Guardar enlaces en Firestore
  const saveLinksToFirestore = async (updatedLinks: Link[]) => {
    if (!userData || !userData.uid) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const userDocRef = doc(db, 'users', userData.uid);
      await updateDoc(userDocRef, { links: updatedLinks });
      setSuccess('Enlaces guardados correctamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Error al guardar enlaces:', error);
      setError('Error al guardar cambios. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Añadir o actualizar enlace
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Debes proporcionar un título para el enlace');
      return;
    }
    
    if (!url.trim()) {
      setError('Debes proporcionar una URL');
      return;
    }
    
    // Validar URL y añadir http:// si no lo tiene
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
    
    if (!isValidUrl(formattedUrl)) {
      setError('Por favor, introduce una URL válida');
      return;
    }
    
    let updatedLinks = [...links];
    
    if (editingId) {
      // Actualizar enlace existente
      updatedLinks = updatedLinks.map(link => 
        link.id === editingId ? { ...link, title, url: formattedUrl } : link
      );
      setEditingId(null);
    } else {
      // Añadir nuevo enlace
      const newLink: Link = {
        id: uuidv4(),
        title,
        url: formattedUrl,
        active: true
      };
      updatedLinks = [...updatedLinks, newLink];
    }
    
    setLinks(updatedLinks);
    saveLinksToFirestore(updatedLinks);
    setTitle('');
    setUrl('');
  };

  // Editar enlace
  const handleEdit = (link: Link) => {
    setTitle(link.title);
    setUrl(link.url);
    setEditingId(link.id);
  };

  // Eliminar enlace
  const handleDelete = (id: string) => {
    const updatedLinks = links.filter(link => link.id !== id);
    setLinks(updatedLinks);
    saveLinksToFirestore(updatedLinks);
  };

  // Alternar estado activo
  const toggleActive = (id: string) => {
    const updatedLinks = links.map(link => 
      link.id === id ? { ...link, active: !link.active } : link
    );
    setLinks(updatedLinks);
    saveLinksToFirestore(updatedLinks);
  };

  // Manejar inicio de arrastre
  const handleDragStart = (id: string) => {
    setDraggedLinkId(id);
  };

  // Manejar evento durante el arrastre
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== draggedLinkId) {
      const draggedIndex = links.findIndex(link => link.id === draggedLinkId);
      const targetIndex = links.findIndex(link => link.id === id);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const updatedLinks = [...links];
        const [removed] = updatedLinks.splice(draggedIndex, 1);
        updatedLinks.splice(targetIndex, 0, removed);
        setLinks(updatedLinks);
      }
    }
  };

  // Manejar soltar después de arrastrar
  const handleDragEnd = () => {
    saveLinksToFirestore(links);
    setDraggedLinkId(null);
  };

  return (
    <div>
      <h2 className="mb-4">Gestionar Enlaces</h2>
      
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
      
      {/* Formulario para añadir o editar enlaces */}
      <form onSubmit={handleSubmit} className="card mb-4">
        <h3 className="mb-3">{editingId ? 'Editar Enlace' : 'Añadir Nuevo Enlace'}</h3>
        
        <div className="form-group">
          <label htmlFor="linkTitle">Título</label>
          <input
            type="text"
            id="linkTitle"
            className="form-control"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre de tu enlace"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="linkUrl">URL</label>
          <input
            type="text"
            id="linkUrl"
            className="form-control"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
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
            {loading ? 'Guardando...' : editingId ? 'Actualizar Enlace' : 'Añadir Enlace'}
          </button>
          
          {editingId && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                setEditingId(null);
                setTitle('');
                setUrl('');
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
      
      {/* Lista de enlaces */}
      <div className="mb-4">
        <h3 className="mb-3">Tus Enlaces</h3>
        
        {links.length === 0 ? (
          <p>No tienes enlaces todavía. Añade tu primer enlace arriba.</p>
        ) : (
          <div className="links-editor-container">
            {links.map((link) => (
              <div 
                key={link.id}
                className={`link-editor-item ${!link.active ? 'inactive' : ''} ${draggedLinkId === link.id ? 'dragging' : ''}`}
                draggable
                onDragStart={() => handleDragStart(link.id)}
                onDragOver={(e) => handleDragOver(e, link.id)}
                onDragEnd={handleDragEnd}
              >
                <div className="link-editor-details">
                  <div className="link-drag-handle">
                    <span className="drag-icon">≡</span>
                  </div>
                  <div className="link-editor-info">
                    <p className="link-editor-title">{link.title}</p>
                    <p className="link-editor-url">{link.url}</p>
                  </div>
                </div>
                
                <div className="link-editor-actions">
                  <button 
                    type="button" 
                    className="btn-icon" 
                    onClick={() => toggleActive(link.id)}
                    title={link.active ? 'Desactivar enlace' : 'Activar enlace'}
                  >
                    {link.active ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button 
                    type="button" 
                    className="btn-icon" 
                    onClick={() => handleEdit(link)}
                    title="Editar enlace"
                  >
                    ✏️
                  </button>
                  <button 
                    type="button" 
                    className="btn-icon delete" 
                    onClick={() => handleDelete(link.id)}
                    title="Eliminar enlace"
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
          {links.length === 0 ? (
            <p className="text-center">Añade enlaces para ver cómo se verán en tu perfil</p>
          ) : (
            <div className="links-preview">
              {links.filter(link => link.active).map((link) => (
                <a 
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-preview-item"
                >
                  {link.title}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinksManager; 