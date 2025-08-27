import React from "react";
import "./Modal.css";

export default function Modal({ show, children }) {
  if (!show) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content">{children}</div>
    </div>
  );
}
