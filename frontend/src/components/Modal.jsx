import { useEffect, useRef } from 'react';

export default function Modal({ title, onClose, children, style }) {
  const ref = useRef();

  useEffect(() => {
    // Auto-focus first input when modal opens
    const el = ref.current?.querySelector('input:not([type="hidden"]), select, textarea');
    if (el) setTimeout(() => el.focus(), 0);

    // Close on Escape
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" ref={ref} style={style}>
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  );
}
