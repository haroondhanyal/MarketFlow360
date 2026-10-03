"use client";
import { InputHTMLAttributes, useState } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function PasswordField({ label, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return <span className="password-control"><input {...props} type={visible ? "text" : "password"} /><button type="button" className="password-toggle" aria-label={visible ? `Hide ${label}` : `Show ${label}`} aria-pressed={visible} onClick={() => setVisible(value => !value)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></span>;
}
