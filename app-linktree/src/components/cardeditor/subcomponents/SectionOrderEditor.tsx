import React from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FiMove, FiMenu } from 'react-icons/fi';
import { CardSectionType } from '../types';
import './SectionOrderEditor.css';

// --- Subcomponente para cada elemento de la lista --- 
interface SortableSectionItemProps {
  id: CardSectionType;
}

function SortableSectionItem({ id }: SortableSectionItemProps) {
  const { 
    attributes, 
    listeners, 
    setNodeRef, 
    transform, 
    transition, 
    isDragging
  } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li 
      ref={setNodeRef} 
      style={style} 
      className={`section-order-item ${isDragging ? 'dragging' : ''}`}
    >
      <span className="section-name">
        {id.charAt(0).toUpperCase() + id.slice(1)}
      </span>
      <button 
        className="drag-handle" 
        {...attributes} 
        {...listeners}
        title="Arrastrar para reordenar"
      >
        <FiMenu />
      </button>
    </li>
  );
}

// --- Componente Principal --- 
interface SectionOrderEditorProps {
  sectionOrder: CardSectionType[];
  onOrderChange: (newOrder: CardSectionType[]) => void; 
}

const SectionOrderEditor: React.FC<SectionOrderEditorProps> = ({ sectionOrder, onOrderChange }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = sectionOrder.findIndex((item) => item === active.id);
      const newIndex = sectionOrder.findIndex((item) => item === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sectionOrder, oldIndex, newIndex);
        onOrderChange(newOrder);
      }
    }
  }

  return (
    <div className="layout-section form-section">
      <h3 className="section-title"><FiMove /> Orden de las Secciones</h3>
      <p className="form-text mb-4">
        Arrastra los elementos para cambiar el orden en que aparecen en tu tarjeta pública.
      </p>
      
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={sectionOrder}
          strategy={verticalListSortingStrategy}
        >
          <ul className="section-order-list">
            {sectionOrder.map(sectionType => (
              <SortableSectionItem key={sectionType} id={sectionType} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default SectionOrderEditor; 