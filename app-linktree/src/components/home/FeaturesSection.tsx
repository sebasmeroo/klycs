import React from 'react';
import './FeaturesSection.css';
import { FiLink, FiShoppingCart, FiCalendar, FiSettings } from 'react-icons/fi';
import { motion } from 'framer-motion'; // Importar motion

// Definir la estructura de una característica
interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: FiLink,
    title: 'Enlaces Centralizados',
    description: 'Agrupa todos tus perfiles sociales, webs y links importantes en un único lugar accesible.',
  },
  {
    icon: FiShoppingCart,
    title: 'Venta de Productos',
    description: 'Integra y vende tus productos digitales o servicios directamente desde tu perfil Klycs.',
  },
  {
    icon: FiCalendar,
    title: 'Sistema de Reservas',
    description: 'Permite que tus clientes agenden citas o reserven servicios fácilmente a través de tu enlace.',
  },
  {
    icon: FiSettings,
    title: 'Administración Sencilla',
    description: 'Gestiona todo tu contenido, productos y reservas desde un panel de control intuitivo.',
  },
];

// Definir variantes para la animación del contenedor y las tarjetas
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2, // Delay entre la animación de cada tarjeta
    },
  },
};

const cardVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 12,
    },
  },
};

const FeaturesSection: React.FC = () => {
  return (
    <motion.section 
      className="features-section"
      initial="hidden"
      whileInView="visible" // Animar cuando entre en la vista
      viewport={{ once: true, amount: 0.3 }} // Animar una vez, cuando 30% sea visible
      variants={containerVariants} // Aplicar variantes al contenedor (para stagger)
    >
      <motion.div 
        className="features-container" 
        // No necesita variantes propias si usamos staggerChildren en el padre
      >
        {features.map((feature, index) => (
          // Aplicar animación a cada tarjeta
          <motion.div 
            key={index} 
            className="feature-card" 
            variants={cardVariants} // Usar las variantes definidas
            // initial, animate, etc., son controlados por el padre con staggerChildren
          >
            <div className="feature-icon-wrapper">
              <feature.icon className="feature-icon" />
            </div>
            <h3 className="feature-title">{feature.title}</h3>
            <p className="feature-description">{feature.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
};

export default FeaturesSection; 