import React from 'react';
import { FiHome, FiShoppingBag, FiMail } from 'react-icons/fi'; // Ejemplo de iconos
import './FloatingTabBar.css';

interface FloatingTabBarProps {
  activeTab: string;
  onTabChange: (tabName: string) => void;
  // Nuevas props para colores
  backgroundColor?: string;
  activeItemColor?: string;
  activeItemBackgroundColor?: string;
  inactiveItemColor?: string;
  // activeIndicatorColor?: string; // Eliminada por ahora
}

const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  activeTab,
  onTabChange,
  backgroundColor = 'rgba(255, 255, 255, 0.85)', // Valor por defecto
  activeItemColor = '#007AFF', // Azul iOS por defecto
  activeItemBackgroundColor = 'rgba(0, 122, 255, 0.12)',
  inactiveItemColor = '#8A8A8E', // Gris iOS por defecto
  // activeIndicatorColor, // Eliminada
}) => {
  const tabs = [
    { name: 'home', label: 'Inicio', icon: <FiHome /> },
    { name: 'shop', label: 'Tienda', icon: <FiShoppingBag /> },
    { name: 'contact', label: 'Contacto', icon: <FiMail /> },
  ];

  // Quitar refs y useEffect para el indicador de slide
  // const tabItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // useEffect(() => {
  //   tabItemRefs.current = tabItemRefs.current.slice(0, tabs.length);
  // }, [tabs.length]);
  // const sliderIndicatorRef = useRef<HTMLDivElement | null>(null);

  const styleVariables = {
    '--tab-bar-bg': backgroundColor,
    '--tab-item-active-color': activeItemColor,
    '--tab-item-active-bg': activeItemBackgroundColor,
    '--tab-item-inactive-color': inactiveItemColor,
    // '--tab-active-indicator-color': activeIndicatorColor || activeItemColor, // Usar activeItemColor como fallback si se mantuviera
  } as React.CSSProperties;

  // Quitar useEffect para la animación del indicador
  // useEffect(() => { ... lógica del indicador ... }, [activeTab, tabs]);

  return (
    <div className="floating-tab-bar" style={styleVariables}>
      {/* Elemento del indicador eliminado */}
      {tabs.map((tab, index) => (
        <button
          key={tab.name}
          // ref ya no es necesario para el indicador
          className={`tab-item ${activeTab === tab.name ? 'active' : ''}`}
          onClick={() => onTabChange(tab.name)}
          aria-label={tab.label}
        >
          <div className="tab-icon">{tab.icon}</div>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default FloatingTabBar; 