import React, { useState, useRef, ChangeEvent } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../../firebase/config'; // Ajusta la ruta según tu estructura
import { v4 as uuidv4 } from 'uuid';
import { FiPlus, FiTrash2, FiUploadCloud, FiLoader } from 'react-icons/fi';
import { CoverMediaItem } from '../types'; // Asumiendo que CoverMediaItem está en types.ts al nivel de CardEditorContainer
import './CoverSliderEditor.css';

const MAX_ITEMS = 9;
const ACCEPTED_MIME_TYPES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
};
const ALL_ACCEPTED_FILES = Object.values(ACCEPTED_MIME_TYPES).flat().map(ext => `.${ext}`).join(',');
const MAX_FILE_SIZE_MB = 10; // Por ejemplo, 10MB para videos cortos e imágenes

interface CoverSliderEditorProps {
  currentItems: CoverMediaItem[];
  onUpdateItems: (newItems: CoverMediaItem[]) => void;
  cardId: string;
  userId: string;
}

interface UploadTask {
  id: string; // ID del slot o un ID temporal
  file: File;
  progress: number;
  error?: string;
  url?: string; // URL una vez subido
}

const CoverSliderEditor: React.FC<CoverSliderEditorProps> = ({
  currentItems,
  onUpdateItems,
  cardId,
  userId,
}) => {
  const [items, setItems] = useState<CoverMediaItem[]>(currentItems);
  const [uploadTasks, setUploadTasks] = useState<Record<string, UploadTask>>({}); // Para rastrear subidas activas por slotId
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null); // Para saber a qué slot se está subiendo

  const getMediaTypeFromFile = (file: File): 'image' | 'video' | 'gif' | 'unknown' => {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type === 'image/gif') return 'gif';
    if (file.type.startsWith('image/')) return 'image';
    return 'unknown';
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>, slotId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert(`El archivo es demasiado grande. Máximo ${MAX_FILE_SIZE_MB}MB.`);
        if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
        return;
    }

    const fileType = getMediaTypeFromFile(file);
    if (fileType === 'unknown') {
        alert('Tipo de archivo no soportado.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    const newUploadTaskId = uuidv4();
    const newTask: UploadTask = { id: newUploadTaskId, file, progress: 0 };
    setUploadTasks(prev => ({ ...prev, [slotId]: newTask }));

    const storagePath = `users/${userId}/cards/${cardId}/coverSlider/${file.name}_${uuidv4()}`;
    const storageRef = ref(storage, storagePath);
    const uploadProcess = uploadBytesResumable(storageRef, file);

    uploadProcess.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadTasks(prev => ({ ...prev, [slotId]: { ...prev[slotId], progress } }));
      },
      (error) => {
        console.error('Error subiendo archivo:', error);
        setUploadTasks(prev => ({ ...prev, [slotId]: { ...prev[slotId], error: error.message, progress: 0 } }));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadProcess.snapshot.ref);
          const newItem: CoverMediaItem = {
            id: uuidv4(), // ID único para el CoverMediaItem
            url: downloadURL,
            type: fileType,
            altText: file.name,
          };
          
          setItems(prevItems => {
            const slotIndex = parseInt(slotId.replace('slot-', ''));
            const newItemsArray = [...prevItems];
            // Si ya hay un item en el slot (reemplazo) o se añade uno nuevo
            if (slotIndex < newItemsArray.length) {
              // Antes de reemplazar, si el item antiguo tenía una URL, intentar borrarlo de Storage
              const oldItem = newItemsArray[slotIndex];
              if (oldItem?.url) {
                try {
                    const oldFileRef = ref(storage, oldItem.url);
                    deleteObject(oldFileRef).catch(err => console.warn("No se pudo borrar el archivo antiguo:", err));
                } catch (e) {
                    console.warn("Error al intentar obtener referencia del archivo antiguo para borrarlo:", e)
                }
              }
              newItemsArray[slotIndex] = newItem;
            } else {
              // Asegurarse de que no excedemos MAX_ITEMS, aunque la UI debería prevenirlo
              newItemsArray.push(newItem); 
            }
            onUpdateItems(newItemsArray.slice(0, MAX_ITEMS));
            return newItemsArray.slice(0, MAX_ITEMS);
          });
          setUploadTasks(prev => {
            const updatedTasks = { ...prev };
            delete updatedTasks[slotId];
            return updatedTasks;
          });
          if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input

        } catch (error) {
          console.error('Error obteniendo URL de descarga:', error);
          setUploadTasks(prev => ({ ...prev, [slotId]: { ...prev[slotId], error: 'Error obteniendo URL', progress: 0 } }));
        }
      }
    );
  };

  const handleRemoveItem = async (itemToRemove: CoverMediaItem, index: number) => {
    if (!confirm('¿Seguro que quieres eliminar este elemento?')) return;

    try {
      const fileRef = ref(storage, itemToRemove.url);
      await deleteObject(fileRef);
    } catch (error) {
      // Si el error es 'storage/object-not-found', puede que ya no exista o la URL sea inválida.
      // Podemos permitir que la eliminación del item en la UI proceda.
      const firebaseError = error as any; // Tipado para acceder a code
      if (firebaseError.code !== 'storage/object-not-found') {
          console.error('Error eliminando archivo de Storage:', error);
          alert('Error al eliminar el archivo del almacenamiento. El elemento no se quitó de la lista.');
          return;
      }
      console.warn('El archivo no se encontró en Storage, pero se procederá a quitar de la lista:', itemToRemove.url);
    }

    const newItemsArray = items.filter((_, i) => i !== index);
    setItems(newItemsArray);
    onUpdateItems(newItemsArray);
  };

  const openFilePicker = (slotId: string) => {
    if (uploadTasks[slotId] && uploadTasks[slotId].progress > 0 && uploadTasks[slotId].progress < 100) {
      alert('Hay una subida en progreso para este slot.');
      return;
    }
    setEditingSlotId(slotId);
    fileInputRef.current?.click();
  };

  // Sincronizar estado interno si las props cambian desde fuera
  React.useEffect(() => {
    setItems(currentItems);
  }, [currentItems]);

  const renderSlot = (index: number) => {
    const slotId = `slot-${index}`;
    const item = items[index];
    const task = uploadTasks[slotId];

    const canClickSlot = (!item || (items.length < MAX_ITEMS && index === items.length)) && 
                         !(task && task.progress > 0 && task.progress < 100);

    return (
      <div 
        key={slotId} 
        className={`cover-slider-editor-slot ${task && task.progress < 100 ? 'is-loading' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!item && items.length <= index && index < MAX_ITEMS && 
              !(task && task.progress > 0 && task.progress < 100)) {
            openFilePicker(slotId);
          }
        }}
      >
        {item ? (
          <>
            {item.type === 'video' ? (
              <video src={item.url} autoPlay loop muted playsInline />
            ) : (
              <img src={item.url} alt={item.altText || 'Media item'} />
            )}
            <div className="media-controls">
              <button onClick={(e) => { e.stopPropagation(); handleRemoveItem(item, index); }} title="Eliminar">
                <FiTrash2 />
              </button>
              <button onClick={(e) => { 
                e.stopPropagation(); 
                if (!(task && task.progress > 0 && task.progress < 100)) {
                  openFilePicker(slotId); 
                }
              }} title="Reemplazar">
                <FiPlus /> 
              </button>
            </div>
          </>
        ) : task && task.progress < 100 ? (
          <>
            <FiLoader className="placeholder-icon spin-icon" />
            <p className="placeholder-text">Subiendo... {task.progress.toFixed(0)}%</p>
            {task.progress > 0 && (
                <div className="upload-progress-bar">
                    <div style={{ width: `${task.progress}%` }}></div>
                </div>
            )}
          </>
        ) : items.length < MAX_ITEMS && index === items.length ? (
          <div 
            onClick={(e) => { 
              e.preventDefault();
              e.stopPropagation();
              if (!(task && task.progress > 0 && task.progress < 100)) {
                openFilePicker(slotId);
              }
            }} 
            style={{cursor: 'pointer', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent:'center', alignItems:'center'}}
          >
            <FiPlus className="placeholder-icon" />
            <p className="placeholder-text">Añadir (Máx. {MAX_ITEMS})</p>
          </div>
        ) : (
          <div style={{width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent:'center', alignItems:'center', cursor: 'default'}}>
             <FiUploadCloud className="placeholder-icon" style={{opacity: 0.5}}/>
             <p className="placeholder-text" style={{opacity: 0.5}}>Vacío</p>
          </div>
        )}
        {task && task.error && <p style={{color: 'red', fontSize: '0.8em'}}>{task.error}</p>}
      </div>
    );
  };

  return (
    <div className="cover-slider-editor">
      <h3>Editar Carrusel de Portada</h3>
      <p className="info-text">
        Puedes subir hasta {MAX_ITEMS} imágenes, GIFs o videos cortos (MP4, WebM).
        Tamaño máximo por archivo: {MAX_FILE_SIZE_MB}MB.
      </p>
      <div className="cover-slider-editor-grid">
        {Array.from({ length: MAX_ITEMS }).map((_, index) => renderSlot(index))}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept={ALL_ACCEPTED_FILES}
        onChange={(e) => editingSlotId && handleFileSelected(e, editingSlotId)}
      />
      {/* No se necesita un área de subida separada si cada slot actúa como un trigger */}
    </div>
  );
};

export default CoverSliderEditor; 