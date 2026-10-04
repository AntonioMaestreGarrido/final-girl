/** Figura estilo meeple dibujada en SVG (sustituye a las figuras físicas). */
export function Meeple({ color, outline = '#222', big = false }: { color: string; outline?: string; big?: boolean }) {
  return (
    <svg viewBox="0 0 24 28" className={big ? 'meeple big' : 'meeple'} aria-hidden="true">
      <path
        d="M12 1.5a4.6 4.6 0 0 1 4.6 4.6c0 1.6-.8 3-2 3.8 3.9.6 7.6 2.3 7.9 4.6.2 1.5-1.3 2.4-4 2.6l3 8.4c.2.6-.2 1.1-.8 1.1h-5.3L12 20.4l-3.4 6.2H3.3c-.6 0-1-.5-.8-1.1l3-8.4c-2.7-.2-4.2-1.1-4-2.6.3-2.3 4-4 7.9-4.6a4.6 4.6 0 0 1 2.6-8.4Z"
        fill={color}
        stroke={outline}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
