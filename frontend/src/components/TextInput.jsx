export default function TextInput({ label, className = "", ...props }) {
  return (
    <label className="block mb-3">
      {label && <div className="text-sm mb-1 font-medium">{label}</div>}
      <input
        {...props}
        className={`border rounded px-3 py-2 w-full focus:outline-none focus:ring focus:ring-blue-400 ${className}`}
      />
    </label>
  );
}
