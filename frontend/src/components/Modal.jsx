import "./Modal.css";

export default function Modal({ show, children, onClose, dismissOnClick = false }) {
  if (!show) return null;
  const handleBackdropClick = () => {
    if (dismissOnClick && onClose) onClose();
  };
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className="modal-content">{children}</div>
    </div>
  );
}
