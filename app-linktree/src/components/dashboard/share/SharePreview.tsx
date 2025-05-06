import React, { useMemo, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import './SharePreview.css'; // Importar el CSS del componente
import { FiCopy } from 'react-icons/fi'; // Icono para el nuevo botón

interface SharePreviewProps {
  cardTitle?: string;
  imageURL?: string;
  shareUrl: string;
}

const PNG_SIZES = [
  { label: 'Pequeño (300px)', value: 300 },
  { label: 'Mediano (600px)', value: 600 },
  { label: 'Grande (1200px)', value: 1200 },
  { label: 'Muy Grande (2400px)', value: 2400 },
];

// Valor fijo para la copia al portapapeles para asegurar buena calidad
const COPY_QR_IMAGE_SIZE = 1080;

const SharePreview: React.FC<SharePreviewProps> = ({ cardTitle, imageURL, shareUrl }) => {
  const [selectedPngSize, setSelectedPngSize] = useState<number>(PNG_SIZES[1].value);
  const [qrFgColor, setQrFgColor] = useState<string>('#000000'); // QR color por defecto: negro
  const [qrBgColor, setQrBgColor] = useState<string>('#ffffff'); // QR fondo por defecto: blanco
  const [transparentPngBg, setTransparentPngBg] = useState<boolean>(false);
  const [copyQrStatus, setCopyQrStatus] = useState<'Copiar Imagen' | '¡Copiado!' | 'Error'>('Copiar Imagen');

  const visibleQrCanvasId = useMemo(() => `visibleQr-${Math.random().toString(36).substring(2, 15)}`, [shareUrl, qrFgColor, qrBgColor]);
  // Canvas para descarga PNG (usa selectedPngSize)
  const downloadPngCanvasId = useMemo(() => `pngDownloadQr-${Math.random().toString(36).substring(2, 15)}`, [shareUrl, selectedPngSize, qrFgColor, qrBgColor, transparentPngBg]);
  // Nuevo canvas oculto dedicado para la copia, con tamaño fijo
  const copyQrCanvasId = useMemo(() => `copyQrCanvas-${Math.random().toString(36).substring(2, 15)}`, [shareUrl, qrFgColor, qrBgColor, transparentPngBg]);
  const downloadSvgElementId = useMemo(() => `svgDownloadQr-${Math.random().toString(36).substring(2, 15)}`, [shareUrl, qrFgColor, qrBgColor]);

  const commonDownloadLogic = (dataUrl: string, extension: string) => {
    let downloadLink = document.createElement('a');
    downloadLink.href = dataUrl;
    const safeCardTitle = cardTitle ? cardTitle.replace(/\s+/g, '_') : 'klycs-card';
    downloadLink.download = `${safeCardTitle}_qr.${extension}`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleDownloadPNG = () => {
    if (!shareUrl) return;
    const canvas = document.getElementById(downloadPngCanvasId) as HTMLCanvasElement | null;
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      commonDownloadLogic(pngUrl, 'png');
    } else {
      console.error("PNG QR Canvas no encontrado para descarga.");
    }
  };

  const handleDownloadSVG = () => {
    if (!shareUrl) return;
    const svgElementContainer = document.getElementById(downloadSvgElementId);
    const svgElement = svgElementContainer?.getElementsByTagName('svg')[0] as SVGElement | null;

    if (svgElement) {
      // Clonar el SVG para no modificar el original oculto
      const clonedSvgElement = svgElement.cloneNode(true) as SVGElement;

      // Si se quiere fondo transparente para SVG y el bgColor actual no lo es por defecto,
      // o si el color de fondo es blanco y se quiere explícitamente 'none'.
      // QRCodeSVG con bgColor='transparent' o similar debería funcionar.
      // Si el bgColor es blanco y queremos transparencia total, eliminamos el rect de fondo si existe.
      if (transparentPngBg && qrBgColor.toLowerCase() === '#ffffff') {
         // Esta es una heurística, puede ser necesario ajustar
         const rects = clonedSvgElement.getElementsByTagName('rect');
         if (rects.length > 0 && rects[0].getAttribute('fill') === '#ffffff') {
            // No eliminarlo, sino hacerlo transparente si es el fondo
            // O mejor, confiar en que bgColor='transparent' en la instancia de QRCodeSVG para descarga funciona.
            // Para SVG, la mejor manera de tener fondo transparente es NO tener un rect de fondo.
            // La librería qrcode.react debería manejar esto si bgColor es 'transparent'
         }
      }
      // Asegurarse de que el SVG tenga el namespace correcto, a veces se pierde en la serialización
      if (!clonedSvgElement.getAttribute('xmlns')) {
        clonedSvgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(clonedSvgElement);
      
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      commonDownloadLogic(svgUrl, 'svg');
      URL.revokeObjectURL(svgUrl); 
    } else {
      console.error("SVG QR Element no encontrado para descarga.");
    }
  };
  
  const handleCopyQRImage = async () => {
    if (!shareUrl) { 
        setCopyQrStatus('Error'); 
        setTimeout(() => setCopyQrStatus('Copiar Imagen'), 2500);
        return; 
    }
    // Usar el canvas dedicado para la copia
    const canvas = document.getElementById(copyQrCanvasId) as HTMLCanvasElement | null;
    
    if (canvas) {
        // Comprobar soporte de la API del portapapeles para 'image/png'
        // Esta comprobación es un poco más compleja y depende del navegador.
        // Por ahora, se asume soportado si navigator.clipboard.write existe.
        if (!navigator.clipboard || !navigator.clipboard.write) {
            console.error('La API del portapapeles para escribir no es soportada.');
            setCopyQrStatus('Error');
            setTimeout(() => setCopyQrStatus('Copiar Imagen'), 2500);
            return;
        }

        try {
            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        setCopyQrStatus('¡Copiado!');
                    } catch (err) {
                        console.error('Error al escribir imagen en el portapapeles:', err);
                        setCopyQrStatus('Error');
                    }
                } else {
                    console.error('El blob del canvas para copiar es null.');
                    setCopyQrStatus('Error');
                }
                setTimeout(() => setCopyQrStatus('Copiar Imagen'), 2500);
            }, 'image/png');
        } catch (error) {
            console.error('Error al convertir canvas a blob para copiar:', error);
            setCopyQrStatus('Error');
            setTimeout(() => setCopyQrStatus('Copiar Imagen'), 2500);
        }
    } else {
        console.error("Canvas del QR para copiar no encontrado.");
        setCopyQrStatus('Error');
        setTimeout(() => setCopyQrStatus('Copiar Imagen'), 2500);
    }
  };

  const hiddenCanvasesStyle: React.CSSProperties = {
    display: 'none',
    visibility: 'hidden',
    position: 'absolute',
    left: '-9999px' 
  };

  const colorPickerContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between', // Espacio entre los dos pickers
    gap: '15px',
    margin: '15px 0',
    alignItems: 'center' // Alinear items verticalmente
  };
  const colorPickerWrapperStyle: React.CSSProperties = { // Envoltorio para label + input
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start', // Alinear label a la izquierda
    gap: '5px'
  };
  const colorInputStyle: React.CSSProperties = {
    width: '100%', // Input ocupa todo el ancho del wrapper
    height: '35px',
    border: '1px solid #ccc',
    padding: '0',
    cursor: 'pointer',
    borderRadius: '4px'
  };
  const checkboxContainerStyle: React.CSSProperties = {
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'flex-start', // Alinear a la izquierda
    gap: '8px', 
    marginBottom: '20px', 
    marginTop: '5px'
  }

  if (!shareUrl && !imageURL && !cardTitle) {
    return (
        <div className="share-section" style={{height: '100%', display:'flex', flexDirection:'column', justifyContent:'center'}}>
            <h3 style={{textAlign: 'center', width:'100%'}}>Vista Previa de la Tarjeta</h3>
            <div className="no-preview-text-placeholder"> {/* Clase CSS para el placeholder */}
                <p>Selecciona una tarjeta para ver la vista previa completa.</p>
            </div>
        </div>
    );
  }

  return (
    <div className="share-section">
      <h3>Vista Previa de la Tarjeta</h3>
        <div className="share-preview-card">
          {imageURL ? (
            <img src={imageURL} alt={cardTitle || 'Vista previa'} className="share-preview-image" />
          ) : (
            <div className="share-preview-image-placeholder">
              <span>Sin Imagen</span>
            </div>
          )}
          <h4 className="share-preview-title">
            {cardTitle || 'Tarjeta sin Título'}
          </h4>
          
          {shareUrl && (
            <>
              <div className="share-preview-qr-visible">
                <QRCodeCanvas 
                  id={visibleQrCanvasId}
                  value={shareUrl}
                  size={150} // QR visible un poco más grande
                  bgColor={qrBgColor}
                  fgColor={qrFgColor}
                  level={"H"}
                  includeMargin={false}
                />
              </div>

              {/* Controles de Personalización del QR */}
              <div className="qr-customization-controls">
                <div className="qr-color-picker-container">
                    <div className="qr-color-picker-wrapper">
                        <label htmlFor="qrFgColorInput">Color QR:</label>
                        <input type="color" id="qrFgColorInput" value={qrFgColor} onChange={(e) => setQrFgColor(e.target.value)} className="qr-color-input"/>
                    </div>
                    <div className="qr-color-picker-wrapper">
                        <label htmlFor="qrBgColorInput">Fondo QR:</label>
                        <input type="color" id="qrBgColorInput" value={qrBgColor} onChange={(e) => setQrBgColor(e.target.value)} className="qr-color-input" />
                    </div>
                </div>
                <div className="qr-transparent-bg-container">
                    <input 
                        type="checkbox" 
                        id="transparentPngBgCheckbox" 
                        checked={transparentPngBg} 
                        onChange={(e) => setTransparentPngBg(e.target.checked)} 
                    />
                    <label htmlFor="transparentPngBgCheckbox">Fondo Transparente (PNG)</label>
                </div>
              </div>

              {/* Controles de Descarga y Copia */}
              <div className="qr-download-controls">
                <div className="qr-size-selector">
                  <label htmlFor="png-size-select">Tamaño PNG:</label>
                  <select 
                    id="png-size-select"
                    value={selectedPngSize}
                    onChange={(e) => setSelectedPngSize(Number(e.target.value))}
                  >
                    {PNG_SIZES.map(size => (
                      <option key={size.value} value={size.value}>{size.label}</option>
                    ))}
                  </select>
                </div>
                <button 
                  className="qr-download-button png-button" 
                  onClick={handleDownloadPNG}
                  disabled={!shareUrl} 
                >
                  Descargar QR (PNG)
                </button>
                <button 
                  className="qr-download-button svg-button" 
                  onClick={handleDownloadSVG}
                  disabled={!shareUrl} 
                >
                  Descargar QR (SVG)
                </button>
                <button 
                  className={`qr-download-button copy-qr-button ${copyQrStatus === '¡Copiado!' ? 'copied' : copyQrStatus === 'Error' ? 'error-copy' : ''}`}
                  onClick={handleCopyQRImage}
                  disabled={!shareUrl || copyQrStatus !== 'Copiar Imagen'}
                >
                  <FiCopy style={{ marginRight: '8px' }} /> 
                  {copyQrStatus}
                </button>
              </div>
            </>
          )}
        </div>

      {/* Canvases ocultos para descarga */}
      {shareUrl && (
        <div className="hidden-canvases">
          {/* Canvas para descarga PNG con tamaño seleccionable */}
          <QRCodeCanvas 
            id={downloadPngCanvasId} 
            value={shareUrl} 
            size={selectedPngSize} 
            level={"H"} 
            bgColor={transparentPngBg ? 'transparent' : qrBgColor} 
            fgColor={qrFgColor}
          />
          {/* Canvas oculto dedicado para copia al portapapeles con tamaño fijo */}
          <QRCodeCanvas 
            id={copyQrCanvasId} 
            value={shareUrl} 
            size={COPY_QR_IMAGE_SIZE} 
            level={"H"} 
            bgColor={transparentPngBg ? 'transparent' : qrBgColor} // Respetar transparencia para la copia también
            fgColor={qrFgColor}
          />
          {/* Contenedor para SVG oculto */}
          <div id={downloadSvgElementId}>
            <QRCodeSVG 
              value={shareUrl} 
              size={256} /* Este tamaño es para el SVG oculto, el escalado es vectorial */
              level={"H"} 
              bgColor={transparentPngBg ? 'transparent' : qrBgColor} // QRCodeSVG podría manejar 'transparent'
              fgColor={qrFgColor}
              includeMargin={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SharePreview; 