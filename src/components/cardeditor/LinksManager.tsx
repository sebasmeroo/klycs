import React from 'react';
import './CardEditor.css';
import { FiLink, FiPlus, FiCheck, FiEdit, FiTrash2, FiX, FiExternalLink } from 'react-icons/fi';

interface CardLink {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

interface LinksManagerProps {
  links: CardLink[];
  linkTitle: string;
  linkUrl: string;
  editingLinkId: string | null;
  showLinkForm: boolean;
  setLinkTitle: (title: string) => void;
  setLinkUrl: (url: string) => void;
  openAddLinkForm: () => void;
  handleSaveLink: (e: React.FormEvent) => void;
  handleEditLink: (link: CardLink) => void;
  handleDeleteLink: (linkId: string) => void;
  toggleLinkActive: (linkId: string) => void;
  cancelLinkEdit: () => void;
}

const LinksManager: React.FC<LinksManagerProps> = ({
  links,
  linkTitle,
  linkUrl,
  editingLinkId,
  showLinkForm,
  setLinkTitle,
  setLinkUrl,
  openAddLinkForm,
  handleSaveLink,
  handleEditLink,
  handleDeleteLink,
  toggleLinkActive,
  cancelLinkEdit
}) => {
  return (
    <div className="links-section">
      <div className="links-header">
        <h3 className="links-title">
          <FiLink />
          Enlaces
        </h3>
        <button 
          type="button" 
          className="add-link-button"
          onClick={openAddLinkForm}
        >
          <FiPlus />
          <span>Añadir enlace</span>
        </button>
      </div>

      {showLinkForm && (
        <form className="link-form" onSubmit={handleSaveLink}>
          <div className="form-group">
            <label htmlFor="linkTitle" className="form-label">
              <FiEdit size={14} />
              Título del enlace
            </label>
            <input
              type="text"
              id="linkTitle"
              className="form-control"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="Ej: Mi sitio web"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="linkUrl" className="form-label">
              <FiExternalLink size={14} />
              URL
            </label>
            <input
              type="url"
              id="linkUrl"
              className="form-control"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://ejemplo.com"
              required
            />
          </div>
          <div className="link-form-buttons">
            <button 
              type="button" 
              className="cancel-button"
              onClick={cancelLinkEdit}
            >
              <FiX />
              Cancelar
            </button>
            <button type="submit" className="save-button">
              <FiCheck />
              {editingLinkId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      <div className="links-list-container">
        {links.length > 0 ? (
          <div className="links-list">
            {links.map(link => (
              <div 
                key={link.id} 
                className={`link-item ${!link.active ? 'link-inactive' : ''}`}
              >
                <div className="link-info">
                  <div className="link-title">{link.title}</div>
                  <div className="link-url">
                    <FiExternalLink size={12} />
                    {link.url}
                  </div>
                </div>
                <div className="link-actions">
                  <button
                    type="button"
                    className="toggle-link-button"
                    onClick={() => toggleLinkActive(link.id)}
                    title={link.active ? 'Desactivar enlace' : 'Activar enlace'}
                  >
                    {link.active ? <FiCheck /> : <FiX />}
                  </button>
                  <button
                    type="button"
                    className="edit-link-button"
                    onClick={() => handleEditLink(link)}
                    title="Editar enlace"
                  >
                    <FiEdit />
                  </button>
                  <button
                    type="button"
                    className="delete-link-button"
                    onClick={() => handleDeleteLink(link.id)}
                    title="Eliminar enlace"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-links-message">
            <FiLink size={32} style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <p>No hay enlaces. Añade algunos para que aparezcan en tu tarjeta.</p>
            <button 
              type="button" 
              className="add-first-link-button"
              onClick={openAddLinkForm}
            >
              <FiPlus />
              Añadir primer enlace
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinksManager; 