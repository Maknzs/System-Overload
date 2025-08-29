import "./Modal.css";

export default function Modal({
  show,
  children,
  onClose,
  dismissOnClick = false,
}) {
  if (!show) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={dismissOnClick && onClose ? onClose : undefined}
    >
      <div className="modal-content" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
