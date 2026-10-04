import { createContext, useCallback, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { asset } from './asset';

interface Preview {
  src: string;
  /** Texto opcional bajo la imagen (por ejemplo, el texto de reglas). */
  caption?: string;
  x: number;
  y: number;
}

interface ZoomApi {
  zoom: (src: string | null) => void;
  show: (p: Preview) => void;
  move: (x: number, y: number) => void;
  hide: () => void;
}

const ZoomContext = createContext<ZoomApi>({ zoom: () => {}, show: () => {}, move: () => {}, hide: () => {} });

const PREVIEW_MAX_H = 440;
const PREVIEW_MAX_W = 560;
const GAP = 18;

export function ZoomProvider({ children }: { children: ReactNode }) {
  const [src, setSrc] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const tipBox = useRef<HTMLDivElement>(null);

  // Tooltips de texto: cualquier elemento con `data-tip`. Van en posición fija para no quedar recortados.
  useEffect(() => {
    const over = (e: globalThis.MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-tip]');
      setTip(el ? { text: el.getAttribute('data-tip')!, rect: el.getBoundingClientRect() } : null);
    };
    const clear = () => setTip(null);
    document.addEventListener('mouseover', over);
    document.addEventListener('scroll', clear, true);
    document.addEventListener('mousedown', clear);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('scroll', clear, true);
      document.removeEventListener('mousedown', clear);
    };
  }, []);

  useEffect(() => {
    const el = tipBox.current;
    if (!el || !tip) return;
    const { width, height } = el.getBoundingClientRect();
    const r = tip.rect;
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = r.top - height - 8;
    if (top < 8) top = r.bottom + 8;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  });

  const move = useCallback((x: number, y: number) => setPreview((p) => (p ? { ...p, x, y } : p)), []);
  const api: ZoomApi = {
    zoom: (s) => {
      setPreview(null);
      setSrc(s);
    },
    show: (p) => setPreview(p),
    move,
    hide: () => setPreview(null),
  };

  // Coloca la vista previa junto al cursor sin salirse de la pantalla.
  useEffect(() => {
    const el = box.current;
    if (!el || !preview) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = preview.x + GAP;
    if (left + width > vw - 8) left = preview.x - GAP - width;
    let top = preview.y - height / 2;
    top = Math.max(8, Math.min(top, vh - height - 8));
    el.style.left = `${Math.max(8, left)}px`;
    el.style.top = `${top}px`;
  });

  return (
    <ZoomContext.Provider value={api}>
      {children}
      {tip && !preview && (
        <div ref={tipBox} className="text-tip" role="tooltip">
          {tip.text}
        </div>
      )}
      {preview && (
        <div ref={box} className="hover-preview" role="tooltip">
          <img src={asset(preview.src)} alt="" style={{ maxHeight: `min(${PREVIEW_MAX_H}px, ${preview.caption ? 58 : 85}vh)`, maxWidth: PREVIEW_MAX_W }} />
          {preview.caption && <p>{preview.caption}</p>}
        </div>
      )}
      {src && (
        <div className="zoom-overlay" onClick={() => setSrc(null)}>
          <img src={asset(src)} alt="" />
        </div>
      )}
    </ZoomContext.Provider>
  );
}

/** Props para mostrar la carta ampliada al pasar el ratón por cualquier elemento. */
export function useHoverCard(src: string | undefined, caption?: string) {
  const api = useContext(ZoomContext);
  if (!src) return {};
  return {
    onMouseEnter: (e: MouseEvent) => api.show({ src, ...(caption ? { caption } : {}), x: e.clientX, y: e.clientY }),
    onMouseMove: (e: MouseEvent) => api.move(e.clientX, e.clientY),
    onMouseLeave: () => api.hide(),
  };
}

/** Imagen de carta: se amplía al pasar el ratón; clic derecho la abre a pantalla completa. */
export function CardImg({ src, alt, className = '', onClick, caption }: { src: string; alt: string; className?: string; onClick?: () => void; caption?: string }) {
  const api = useContext(ZoomContext);
  const hover = useHoverCard(src, caption);
  return (
    <img
      className={`card-img ${className} ${onClick ? 'clickable' : ''}`}
      src={asset(src)}
      alt={alt}
      aria-label={caption ?? alt}
      draggable={false}
      {...hover}
      onClick={() => {
        api.hide();
        if (onClick) onClick();
        else api.zoom(src);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        api.zoom(src);
      }}
    />
  );
}
