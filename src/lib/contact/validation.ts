export const inquiryTypes = ["Freelance Project", "Job Opportunity", "Technical Consultation", "General Inquiry"] as const;
export const fieldLimits = { name: 100, email: 254, inquiryType: 30, subject: 160, message: 5000 } as const;
export type ContactField = keyof typeof fieldLimits;
export type FieldErrors = Partial<Record<ContactField, string>>;
export interface Inquiry {
  name: string;
  email: string;
  inquiryType: (typeof inquiryTypes)[number];
  subject: string;
  message: string;
}
export type ValidationResult = { ok: true; data: Inquiry } | { ok: false; errors: FieldErrors };
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
// Intentionally accept only a simple, single mailbox; no display names or lists.
export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value);
}
export function validateInquiry(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: { name: "Enter the required contact details." } };
  const record = input as Record<string, unknown>;
  const errors: FieldErrors = {};
  const values: Record<string, string> = {};
  for (const field of Object.keys(fieldLimits) as ContactField[]) {
    const raw = record[field];
    if (typeof raw !== "string" || !raw.trim()) errors[field] = "This field is required.";
    else if (raw.length > fieldLimits[field]) errors[field] = `Use ${fieldLimits[field]} characters or fewer.`;
    else if (controls.test(raw) || (field !== "message" && /[\r\n\t]/.test(raw))) errors[field] = "Remove unsupported control characters or line breaks.";
    values[field] = typeof raw === "string" ? raw.trim() : "";
  }
  if (!errors.email && !isEmail(values.email)) errors.email = "Enter a valid email address.";
  if (!errors.inquiryType && !inquiryTypes.includes(values.inquiryType as Inquiry["inquiryType"])) errors.inquiryType = "Choose an inquiry type from the list.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data: values as unknown as Inquiry };
}
