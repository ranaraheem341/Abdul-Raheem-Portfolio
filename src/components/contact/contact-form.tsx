"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { fieldLimits, inquiryTypes, validateInquiry, type ContactField, type FieldErrors } from "@/lib/contact/validation";
import styles from "./contact.module.css";

const fields: { name: ContactField; label: string; placeholder: string; autoComplete?: string }[] = [
  { name: "name", label: "Full name", placeholder: "Your full name", autoComplete: "name" },
  { name: "email", label: "Email address", placeholder: "you@example.com", autoComplete: "email" },
  { name: "inquiryType", label: "Inquiry type", placeholder: "Choose an inquiry type" },
  { name: "subject", label: "Subject", placeholder: "What would you like to discuss?" },
  { name: "message", label: "Message", placeholder: "Tell me about the opportunity, your goals, and any useful project details." },
];

export function ContactForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (pending) return;
    // Focus only after React has rendered the feedback and error descriptions.
    if (feedback) statusRef.current?.focus();
    else {
      const first = fields.find(({ name }) => errors[name]);
      if (first) (formRef.current?.elements.namedItem(first.name) as HTMLElement | null)?.focus();
    }
  }, [errors, feedback, pending]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const input = Object.fromEntries(new FormData(form));
    const checked = validateInquiry(input);
    setFeedback(null);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    submitting.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...checked.data, website: input.website }),
        signal: AbortSignal.timeout(20000),
      });
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || !("message" in result) || typeof result.message !== "string") throw new Error("Unexpected response");
      if ("errors" in result && result.errors && typeof result.errors === "object") {
        const safeErrors: FieldErrors = {};
        for (const { name } of fields) {
          const value = (result.errors as Record<string, unknown>)[name];
          if (typeof value === "string") safeErrors[name] = value;
        }
        setErrors(safeErrors);
      }
      const ok = response.status === 200;
      setFeedback({ message: result.message, ok });
      if (ok) form.reset();
    } catch {
      setFeedback({ message: "Submission could not be confirmed. Your message is still in the form. Please try again later and avoid repeated attempts.", ok: false });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form ref={formRef} action="/api/contact" method="post" onSubmit={submit} noValidate className={styles.form} aria-labelledby="contact-form-title" aria-describedby="contact-form-note">
      <div>
        <h3 id="contact-form-title" className={styles.subtitle}>Start a conversation</h3>
        <p id="contact-form-note" className={styles.note}>All fields are required. Please leave out passwords, credentials, and confidential information. Submission is available once email delivery is configured.</p>
      </div>
      <div className={styles.fields} aria-busy={pending}>
        {fields.map(({ name, label, placeholder, autoComplete }) => {
          const props = {
            id: `contact-${name}`, name, required: true, disabled: pending,
            "aria-invalid": !!errors[name],
            "aria-describedby": errors[name] ? `contact-${name}-error` : undefined,
            className: styles.input,
          };
          return (
            <div key={name} className={`${styles.field} ${name === "message" || name === "subject" || name === "inquiryType" ? styles.wide : ""}`}>
              <label htmlFor={props.id}>{label} <span aria-hidden="true">*</span></label>
              {name === "inquiryType" ? (
                <select {...props} defaultValue="">
                  <option value="" disabled>{placeholder}</option>
                  {inquiryTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              ) : name === "message" ? <textarea {...props} rows={7} maxLength={fieldLimits[name]} placeholder={placeholder} /> : (
                <input {...props} type={name === "email" ? "email" : "text"} autoComplete={autoComplete} maxLength={fieldLimits[name]} placeholder={placeholder} />
              )}
              {errors[name] && <p id={`contact-${name}-error`} className={styles.error}>{errors[name]}</p>}
            </div>
          );
        })}
      </div>
      <div className={styles.trap} aria-hidden="true" inert>
        <label htmlFor="contact-website">Leave this field empty</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" maxLength={200} />
      </div>
      <div className={styles.submitRow}>
        <Button type="submit" disabled={pending}>{pending ? "Sending inquiry…" : "Send inquiry"}<span aria-hidden="true">↗</span></Button>
        <span className={styles.note}>For projects, roles, and professional questions.</span>
      </div>
      <p ref={statusRef} role="status" aria-live="polite" aria-atomic="true" tabIndex={-1} className={`${styles.status} ${feedback && !feedback.ok ? styles.error : ""}`}>
        {pending ? "Submitting your inquiry…" : feedback?.message}
      </p>
      <noscript><p className={styles.error}>JavaScript is required to submit this form. No inquiry has been sent.</p></noscript>
    </form>
  );
}
