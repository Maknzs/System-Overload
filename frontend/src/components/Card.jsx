export default function Card({ name, onClick, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`border rounded px-3 py-2 m-1 ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      }`}
      title={name}
    >
      {name}
    </button>
  );
}
