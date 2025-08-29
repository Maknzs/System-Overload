import "./Modal.css";

export default function Modal({ show, children, onClose, dismissOnClick = false }) {
  if (!show) return null;

  const handleDismiss = () => {
    if (dismissOnClick && onClose) onClose();
  };

  return (
    <div className="modal-backdrop">
      {dismissOnClick && (
        <button
          type="button"
          className="modal-dismiss"
          aria-label="Close modal"
          onClick={handleDismiss}
        />
      )}
      <div className="modal-content" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
