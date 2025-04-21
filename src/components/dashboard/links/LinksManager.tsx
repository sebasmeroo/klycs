import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import './Links.css';

interface Link {
  id: string;
  title: string;
  url: string;
  active: boolean;
  autoUrl?: string; // URL generada automáticamente para compartir
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
  const [autoGenerateLinks, setAutoGenerateLinks] = useState(true);

  // Cargar enlaces existentes cuando se monta el componente
  useEffect(() => {
    if (userData && userData.links) {
      // Verificar si hay enlaces sin URL automática y generarlas si la opción está activada
      const updatedLinks = userData.links.map((link: Link) => {
        if (!link.url && autoGenerateLinks && !link.autoUrl) {
          return {
            ...link,
            autoUrl: generateAutoUrl(link.title, userData.username || userData.uid)
          };
        }
        return link;
      });
      
      setLinks(updatedLinks);
      
      // Si hay cambios en los enlaces, guardarlos en Firestore
      if (JSON.stringify(updatedLinks) !== JSON.stringify(userData.links)) {
        saveLinksToFirestore(updatedLinks);
      }
    }
  }, [userData, autoGenerateLinks]);

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
    const safeTitle = title || 'enlace';
    const safeUsername = username || 'usuario';
    
    const slug = safeTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-');
    
    // Usar el dominio de Firebase Hosting en lugar de window.location.origin
    const firebaseHostingDomain = 'https://klycs-58190.firebaseapp.com';
    
    return `${firebaseHostingDomain}/${safeUsername}/${slug}-${Date.now().toString(36)}`;
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
    
    let formattedUrl = url.trim();
    let autoUrl: string | undefined = undefined;
    
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
        return;
      }
    } else {
      setError('Debes proporcionar una URL o activar la generación automática');
      return;
    }
    
    let updatedLinks = [...links];
    
    if (editingId) {
      // Actualizar enlace existente
      updatedLinks = updatedLinks.map(link => 
        link.id === editingId ? { 
          ...link, 
          title, 
          url: formattedUrl || '',
          autoUrl: !formattedUrl ? autoUrl : undefined 
        } : link
      );
      setEditingId(null);
    } else {
      // Añadir nuevo enlace
      const newLink: Link = {
        id: uuidv4(),
        title,
        url: formattedUrl || '',
        active: true,
        autoUrl: !formattedUrl ? autoUrl : undefined
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

  // Regenerar URL automática para un enlace
  const regenerateAutoUrl = (id: string) => {
    const updatedLinks = links.map(link => {
      if (link.id === id) {
        return {
          ...link,
          autoUrl: generateAutoUrl(link.title, userData.username || userData.uid)
        };
      }
      return link;
    });
    
    setLinks(updatedLinks);
    saveLinksToFirestore(updatedLinks);
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

  return (
    <div className="links-container">
      <div className="links-header">
        <h2>Gestionar Enlaces</h2>
        <div className="form-check">
          <input
            type="checkbox"
            id="autoGenerateLinks"
            className="form-check-input"
            checked={autoGenerateLinks}
            onChange={() => setAutoGenerateLinks(!autoGenerateLinks)}
          />
          <label htmlFor="autoGenerateLinks" className="form-check-label">
            Generar enlaces automáticamente para tarjetas sin URL
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
      
      {/* Formulario para añadir o editar enlaces */}
      <form onSubmit={handleSubmit} className="link-card link-form mb-4">
        <h3 className="mb-3">{editingId ? 'Editar Enlace' : 'Añadir Nuevo Enlace'}</h3>
        
        <div className="link-input-group">
          <label htmlFor="linkTitle">Título</label>
          <input
            type="text"
            id="linkTitle"
            className="link-input form-control"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre de tu enlace"
            required
          />
        </div>
        
        <div className="link-input-group">
          <label htmlFor="linkUrl">URL {autoGenerateLinks && '(opcional)'}</label>
          <input
            type="text"
            id="linkUrl"
            className="link-input form-control"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={autoGenerateLinks ? "Dejar en blanco para generar automáticamente" : "https://tuenlace.com"}
            required={!autoGenerateLinks}
          />
          {autoGenerateLinks && !url && (
            <small className="text-muted">
              Se generará un enlace automáticamente si dejas este campo vacío
            </small>
          )}
        </div>
        
        <div className="link-button-group">
          <button 
            type="submit" 
            className="link-add-btn" 
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
          <div className="links-list">
            {links.map((link) => (
              <div 
                key={link.id}
                className={`link-card ${!link.active ? 'link-inactive' : ''} ${draggedLinkId === link.id ? 'link-dragging' : ''}`}
                draggable
                onDragStart={() => handleDragStart(link.id)}
                onDragOver={(e) => handleDragOver(e, link.id)}
                onDragEnd={handleDragEnd}
              >
                <div className="link-card-header">
                  <h4>{link.title}</h4>
                  <div>
                    <button
                      className="link-edit-btn"
                      onClick={() => handleEdit(link)}
                    >
                      Editar
                    </button>
                    <button
                      className="link-delete-btn"
                      onClick={() => handleDelete(link.id)}
                    >
                      Eliminar
                    </button>
                    <button
                      className="link-share-btn"
                      onClick={() => copyLinkToClipboard(link.url || link.autoUrl || '')}
                    >
                      Compartir
                    </button>
                  </div>
                </div>
                
                {/* Mostrar URL o URL automática */}
                {link.url ? (
                  <p>URL: <a href={link.url} target="_blank" rel="noopener noreferrer">{link.url}</a></p>
                ) : link.autoUrl ? (
                  <div className="link-auto-share">
                    <p className="link-auto-share-text">
                      URL generada automáticamente: <a href={link.autoUrl} target="_blank" rel="noopener noreferrer">{link.autoUrl}</a>
                    </p>
                    <button 
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => regenerateAutoUrl(link.id)}
                    >
                      Regenerar URL
                    </button>
                  </div>
                ) : (
                  <p className="link-no-url">Este enlace no tiene URL</p>
                )}
                
                <label className="form-check-label mt-2">
                  <input
                    type="checkbox"
                    checked={link.active}
                    onChange={() => toggleActive(link.id)}
                    className="form-check-input me-2"
                  />
                  Enlace activo
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LinksManager; 