import React from "react";
import "./TextInput.css";

export default function TextInput({ className = "", error, ...rest }) {
  return (
    <input
      className={`input ${error ? "input--error" : ""} ${className}`}
      {...rest}
    />
  );
}
