import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '../../../firebase/config'; // Ajustar ruta y añadir storage
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Añadir importaciones de Storage
import { compressProfileImage } from '../../../utils/imageCompression'; // Importar tu función de compresión
import { FiUserPlus, FiTrash2, FiImage } from 'react-icons/fi'; // Añadir FiImage
import './ProfessionalsManager.css'; // Crear este archivo después

// Interfaz para un profesional
interface Professional {
  id: string;
  name: string;
  imageUrl?: string; // Campo opcional para la URL de la imagen
  // Podríamos añadir más campos en el futuro: email, rol, servicios asignados, etc.
}

interface ProfessionalsManagerProps {
  userId: string; // ID del usuario dueño del negocio/dashboard
}

const ProfessionalsManager: React.FC<ProfessionalsManagerProps> = ({ userId }) => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [newProfessionalName, setNewProfessionalName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null); // Estado para el archivo de imagen
  const [imagePreview, setImagePreview] = useState<string | null>(null); // Estado para la previsualización
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false); // Estado para el botón de añadir

  // Referencia a la subcolección de profesionales
  const professionalsCollectionRef = collection(db, 'users', userId, 'professionals');

  // Efecto para cargar los profesionales
  useEffect(() => {
    setLoading(true);
    const q = query(professionalsCollectionRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedProfessionals: Professional[] = [];
      snapshot.forEach((doc) => {
        fetchedProfessionals.push({ id: doc.id, ...doc.data() } as Professional);
      });
      setProfessionals(fetchedProfessionals);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching professionals: ", err);
      setError("Error al cargar el equipo.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]); // Dependencia userId para asegurar la referencia correcta

  // Manejador para el cambio de archivo de imagen
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        setError(null); // Limpiar errores previos
        console.log("Starting image compression for:", file.name); // Log inicio
        // Asumimos ahora que devuelve un objeto con la propiedad 'file' que es un Blob
        const compressionResult = await compressProfileImage(file);
        console.log("Compression result received:", compressionResult); // Log resultado completo

        // Verificar si el resultado tiene la propiedad 'file' y si es un Blob
        if (compressionResult && compressionResult.file instanceof Blob) {
          const compressedBlob = compressionResult.file;
          console.log("Compressed Blob extracted. Size:", compressedBlob.size, "Type:", compressedBlob.type);

          // Crear un objeto File a partir del Blob para el estado y la subida
          // Usamos el nombre original del archivo y el tipo del Blob comprimido
          const fileToUse = new File([compressedBlob], file.name, { type: compressedBlob.type });

          setImageFile(fileToUse); // Usar el objeto File creado

          // Crear previsualización
          const reader = new FileReader();
          reader.onloadend = () => {
            setImagePreview(reader.result as string);
            console.log("Preview generated for compressed image."); // Log previsualización
          };
          reader.readAsDataURL(fileToUse); // Leer el objeto File

        } else {
          // Si el resultado no tiene la propiedad 'file' o no es un Blob
          console.error("Error: Compression result is missing 'file' property or it's not a Blob.", compressionResult);
          setError("Error inesperado al procesar la imagen comprimida (formato incorrecto).");
          setImageFile(null);
          setImagePreview(null);
        }
      } catch (error) {
        // Capturar errores durante la compresión o el procesamiento posterior
        console.error("Error during image compression or processing: ", error);
        if (error instanceof Error) {
            setError(`Error al procesar la imagen: ${error.message}`);
        } else {
            setError("Error al procesar la imagen. Inténtalo de nuevo.");
        }
        setImageFile(null);
        setImagePreview(null);
      }
    } else {
        setImageFile(null);
        setImagePreview(null);
    }
  };

  // Función para subir la imagen (simplificada por ahora)
  const uploadProfessionalImage = async (file: File): Promise<string> => {
      // Lógica de subida a Firebase Storage irá aquí
      // Devolverá la URL de descarga
      const storageRef = ref(storage, `users/${userId}/professionals/${Date.now()}_${file.name}`);
      try {
          console.log("Subiendo imagen a Storage...", file.name);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          console.log("Image uploaded successfully. URL:", downloadURL);
          return downloadURL;
      } catch (error) {
          console.error("Error uploading image to Firebase Storage: ", error);
          setError("Error al subir la imagen. Por favor, inténtalo de nuevo.");
          // Propagar el error para que handleAddProfessional pueda manejarlo
          throw new Error("Image upload failed");
      }
  };

  // Manejador para añadir un nuevo profesional
  const handleAddProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfessionalName.trim()) return;

    setIsAdding(true);
    setError(null);
    let imageUrl: string | undefined = undefined;

    try {
      // 1. Subir imagen si existe
      if (imageFile) {
          try {
              imageUrl = await uploadProfessionalImage(imageFile);
          } catch (uploadError) {
              console.error("Error uploading image: ", uploadError);
              setError("Error al subir la imagen del profesional.");
              setIsAdding(false);
              return; // Detener el proceso si la subida falla
          }
      }

      // 2. Añadir documento a Firestore
      const professionalData: { name: string; imageUrl?: string } = {
          name: newProfessionalName.trim(),
      };
      if (imageUrl) {
          professionalData.imageUrl = imageUrl;
      }

      const docRef = await addDoc(professionalsCollectionRef, professionalData);
      console.log("Professional added with ID: ", docRef.id);
      setNewProfessionalName(''); // Limpiar input de nombre
      setImageFile(null); // Limpiar archivo de imagen
      setImagePreview(null); // Limpiar previsualización

    } catch (err) {
      console.error("Error adding professional: ", err);
      setError("Error al añadir miembro al equipo.");
    } finally {
      setIsAdding(false);
    }
  };
  
    // Manejador para eliminar un profesional (opcional por ahora)
    const handleDeleteProfessional = async (professionalId: string) => {
      if (!window.confirm("¿Seguro que quieres eliminar a este miembro del equipo?")) return;
      
      try {
         const professionalDocRef = doc(db, 'users', userId, 'professionals', professionalId);
         // TODO: Eliminar imagen de Storage si existe antes de borrar el documento
         await deleteDoc(professionalDocRef);
         console.log("Professional deleted:", professionalId);
      } catch (err) {
         console.error("Error deleting professional: ", err);
         setError("Error al eliminar miembro del equipo.");
      }
    };

  return (
    <div className="professionals-manager-container">
      <h2 className="professionals-manager-title">Gestionar Equipo</h2>

      {/* Formulario para añadir */} 
      <form onSubmit={handleAddProfessional} className="add-professional-form">
        <input 
          type="text"
          value={newProfessionalName}
          onChange={(e) => setNewProfessionalName(e.target.value)}
          placeholder="Nombre del nuevo miembro"
          className="add-professional-input"
          disabled={isAdding}
        />
        {/* Input para la imagen */}
         <div className="image-upload-container">
           <label htmlFor="professional-image-upload" className="image-upload-label">
             <FiImage /> {imagePreview ? 'Cambiar Imagen' : 'Añadir Imagen'}
           </label>
           <input
             id="professional-image-upload"
             type="file"
             accept="image/png, image/jpeg, image/webp"
             onChange={handleImageChange}
             style={{ display: 'none' }} // Ocultar el input por defecto
             disabled={isAdding}
           />
           {imagePreview && (
             <img src={imagePreview} alt="Previsualización" className="image-preview" />
           )}
         </div>

        <button type="submit" className="add-professional-button" disabled={!newProfessionalName.trim() || isAdding}>
          <FiUserPlus /> {isAdding ? 'Añadiendo...' : 'Añadir'}
        </button>
      </form>

      {error && <p className="professionals-error">{error}</p>}

      {/* Lista de profesionales */} 
      <div className="professionals-list">
        {loading ? (
          <p>Cargando equipo...</p>
        ) : professionals.length === 0 ? (
          <p className="no-professionals-message">Aún no has añadido a nadie a tu equipo.</p>
        ) : (
          <ul>
            {professionals.map((prof) => (
              <li key={prof.id} className="professional-item">
                {/* Mostrar imagen si existe */}
                {prof.imageUrl ? (
                   <img src={prof.imageUrl} alt={prof.name} className="professional-image" />
                 ) : (
                   <div className="professional-image-placeholder"><FiUserPlus/></div> // Placeholder si no hay imagen
                 )}
                <span>{prof.name}</span>
                {/* Botón eliminar opcional */}
                 <button 
                   onClick={() => handleDeleteProfessional(prof.id)} 
                   className="delete-professional-button"
                   title="Eliminar miembro"
                 >
                   <FiTrash2 />
                 </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ProfessionalsManager; 