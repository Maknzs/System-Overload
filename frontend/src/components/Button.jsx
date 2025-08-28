import "./Button.css";

export default function Button({ children, kind, className = "", ...rest }) {
  const k =
    kind === "ghost"
      ? "btn--ghost"
      : kind === "danger"
      ? "btn--danger"
      : kind === "success"
      ? "btn--success"
      : "";
  return (
    <button className={`btn ${k} ${className}`} {...rest}>
      {children}
    </button>
  );
}
