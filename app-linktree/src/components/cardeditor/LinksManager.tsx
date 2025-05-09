import React, { useState } from 'react';
import './CardEditor.css';
import { FiLink, FiPlus, FiCheck, FiEdit, FiTrash2, FiX, FiExternalLink } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';
import { CardLink } from './types';

interface LinksManagerProps {
  cardId: string;
  links: CardLink[];
  onLocalLinksChange: (newLinks: CardLink[]) => void;
  onAddLinkToFirestore: (cardId: string, linkData: Omit<CardLink, 'id' | 'active'> & { active?: boolean }) => Promise<string | null>;
  onUpdateLinkInFirestore: (cardId: string, linkId: string, linkData: Partial<Omit<CardLink, 'id'>>) => Promise<boolean>;
  onDeleteLinkFromFirestore: (cardId: string, linkId: string) => Promise<boolean>;
}

const LinksManager: React.FC<LinksManagerProps> = ({
  cardId,
  links,
  onLocalLinksChange,
  onAddLinkToFirestore,
  onUpdateLinkInFirestore,
  onDeleteLinkFromFirestore,
}) => {
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAddLinkForm = () => {
    setEditingLinkId(null);
    setLinkTitle('');
    setLinkUrl('');
    setShowLinkForm(true);
  };

  const handleEditLink = (link: CardLink) => {
    setEditingLinkId(link.id);
    setLinkTitle(link.title);
    setLinkUrl(link.url);
    setShowLinkForm(true);
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    setIsSubmitting(true);

    if (editingLinkId) {
      const success = await onUpdateLinkInFirestore(cardId, editingLinkId, { title: linkTitle, url: linkUrl });
      if (success) {
        const updatedLinks = links.map(link =>
          link.id === editingLinkId
            ? { ...link, title: linkTitle, url: linkUrl }
            : link
        );
        onLocalLinksChange(updatedLinks);
      }
    } else {
      const newLinkData = { title: linkTitle, url: linkUrl, active: true };
      const newId = await onAddLinkToFirestore(cardId, newLinkData);
      if (newId) {
        const newLinkEntry: CardLink = { id: newId, ...newLinkData };
        onLocalLinksChange([...links, newLinkEntry]);
      }
    }
    
    setIsSubmitting(false);
    cancelLinkEdit();
  };

  const handleDeleteLink = async (linkId: string) => {
    setIsSubmitting(true);
    const success = await onDeleteLinkFromFirestore(cardId, linkId);
    if (success) {
      const updatedLinks = links.filter(link => link.id !== linkId);
      onLocalLinksChange(updatedLinks);
    }
    setIsSubmitting(false);
  };

  const toggleLinkActive = async (link: CardLink) => {
    setIsSubmitting(true);
    const newActiveState = !link.active;
    const success = await onUpdateLinkInFirestore(cardId, link.id, { active: newActiveState });
    if (success) {
      const updatedLinks = links.map(l =>
        l.id === link.id ? { ...l, active: newActiveState } : l
      );
      onLocalLinksChange(updatedLinks);
    }
    setIsSubmitting(false);
  };

  const cancelLinkEdit = () => {
    setLinkTitle('');
    setLinkUrl('');
    setEditingLinkId(null);
    setShowLinkForm(false);
  };

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
          disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
            />
          </div>
          <div className="link-form-buttons">
            <button
              type="button"
              className="cancel-button"
              onClick={cancelLinkEdit}
              disabled={isSubmitting}
            >
              <FiX />
              Cancelar
            </button>
            <button type="submit" className="save-button" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : (editingLinkId ? <><FiCheck /> Actualizar</> : <><FiCheck /> Guardar</>)}
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
                    onClick={() => toggleLinkActive(link)}
                    title={link.active ? 'Desactivar enlace' : 'Activar enlace'}
                    disabled={isSubmitting}
                  >
                    {isSubmitting && editingLinkId === link.id ? '...' : (link.active ? <FiCheck /> : <FiX />) }
                  </button>
                  <button
                    type="button"
                    className="edit-link-button"
                    onClick={() => handleEditLink(link)}
                    title="Editar enlace"
                    disabled={isSubmitting}
                  >
                    <FiEdit />
                  </button>
                  <button
                    type="button"
                    className="delete-link-button"
                    onClick={() => handleDeleteLink(link.id)}
                    title="Eliminar enlace"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && editingLinkId === link.id ? '...' : <FiTrash2 /> }
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
              disabled={isSubmitting}
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