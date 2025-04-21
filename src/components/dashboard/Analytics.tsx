import React, { useState, useEffect } from 'react';

interface AnalyticsProps {
  userData: any;
}

// Ignoramos userData por ahora, pero lo mantenemos en la interfaz para consistencia
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Analytics: React.FC<AnalyticsProps> = ({ userData }) => {
  return (
    <div>
      <h2 className="mb-4">Analíticas</h2>
      <p>Componente para visualizar analíticas. Próximamente disponible.</p>
    </div>
  );
};

export default Analytics; 