import { useEffect, useRef, useState } from "react";
import "./Modal.css";

const MODAL_EXIT_MS = 300; // Keep in sync with --dur-modal-close in theme.css

export default function Modal({
  show,
  children,
  onClose,
  dismissOnClick = false,
  className,
}) {
  const [isMounted, setIsMounted] = useState(show);
  const [isClosing, setIsClosing] = useState(false);
  const exitTimerRef = useRef(null);

  useEffect(() => {
    if (show) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setIsMounted(true);
      setIsClosing(false);
      return;
    }

    if (!isMounted) return;

    setIsClosing(true);
    exitTimerRef.current = setTimeout(() => {
      setIsMounted(false);
      setIsClosing(false);
      exitTimerRef.current = null;
    }, MODAL_EXIT_MS);

    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [show, isMounted]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  if (!isMounted) return null;

  const backdropClass = [
    "modal-backdrop",
    className,
    isClosing ? "modal--closing" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const contentClass = [
    "modal-content",
    isClosing ? "modal-content--closing" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={backdropClass}
      onClick={dismissOnClick && onClose ? onClose : undefined}
    >
      <div className={contentClass} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
