type Field = { label: string; max: number; required?: boolean; type?: "date" | "url" | "multiline" };
export const recordSections: Record<RecordKind, { label: string; fields: Record<string, Field> }> = {
  projects: { label: "Projects", fields: {
    title: { label: "Project title", max: 200, required: true },
    description: { label: "Description", max: 5000, type: "multiline", required: true },
    technologies: { label: "Technology tags (one per line, up to 20)", max: 1219, type: "multiline" },
    project_url: { label: "Project URL (optional HTTPS)", max: 2048, type: "url" },
    source_url: { label: "Source URL (optional HTTPS)", max: 2048, type: "url" },
  } },
  experience: { label: "Work Experience", fields: {
    role: { label: "Role", max: 160, required: true }, company: { label: "Company", max: 160, required: true },
    start_date: { label: "Start date", max: 10, type: "date", required: true }, end_date: { label: "End date (empty if current)", max: 10, type: "date" },
    highlights: { label: "Highlights (one per line, up to 20)", max: 10019, type: "multiline" },
  } },
  skills: { label: "Skills", fields: { name: { label: "Skill", max: 120, required: true }, category: { label: "Category", max: 120, required: true } } },
  education: { label: "Education", fields: {
    institution: { label: "Institution", max: 200, required: true }, qualification: { label: "Qualification", max: 200, required: true },
    start_date: { label: "Start date", max: 10, type: "date" }, end_date: { label: "End date", max: 10, type: "date" },
    description: { label: "Description", max: 3000, type: "multiline" },
  } },
  certifications: { label: "Certifications", fields: {
    name: { label: "Certification", max: 200, required: true }, issuer: { label: "Issuer", max: 200, required: true },
    issued_on: { label: "Issued on", max: 10, type: "date" }, expires_on: { label: "Expires on", max: 10, type: "date" },
    credential_url: { label: "Credential URL (HTTPS)", max: 2048, type: "url" },
  } },
};
export type RecordKind = "projects" | "experience" | "skills" | "education" | "certifications";
export type RecordPayload = Record<string, string | string[] | number | null>;
export type RecordDraft = { kind: RecordKind; id: string; payload: RecordPayload; revision: number; published_revision: number | null; archived: boolean };
export type RecordState = { record: RecordDraft; errors: Record<string, string>; message: string; ok: boolean; deleted?: boolean };
export function isRecordKind(value: unknown): value is RecordKind {
  return typeof value === "string" && Object.hasOwn(recordSections, value);
}
export function emptyRecord(kind: RecordKind, id: string): RecordDraft {
  return { kind, id, payload: Object.fromEntries([...Object.keys(recordSections[kind].fields).map(key => [key, ["highlights", "technologies"].includes(key) ? [] : ""]), ["sort_order", 0]]), revision: 0, published_revision: null, archived: false };
}
export function oneText(form: FormData, key: string) {
  const values = form.getAll(key);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : null;
}
export const validId = (id: string | null): id is string => id !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function validateRecord(kind: RecordKind, form: FormData) {
  const payload: RecordPayload = {};
  const errors: Record<string, string> = {};
  for (const [key, field] of Object.entries(recordSections[kind].fields)) {
    const raw = oneText(form, key);
    const text = raw?.trim() ?? "";
    payload[key] = text;
    if (raw === null || raw.length > field.max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw) || (field.required && !text)) {
      errors[key] = `Provide ${field.required ? "required " : ""}text of at most ${field.max} characters.`;
    }
    if (field.type === "date") {
      payload[key] = text || null;
      if (text && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || text < "0001-01-01" || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text)) errors[key] = "Enter a valid calendar date.";
    }
    if (key === "highlights" || key === "technologies") {
      const lines = text ? text.split(/\r?\n/).map(line => line.trim()).filter(Boolean) : [];
      payload[key] = lines;
      const limit = key === "technologies" ? 60 : 500;
      if (lines.length > 20 || lines.some(line => line.length > limit) || new Set(lines.map(line => line.toLowerCase())).size !== lines.length) errors[key] = `Use up to 20 unique entries, each at most ${limit} characters.`;
    }
    if (field.type === "url") {
      payload[key] = text || null;
      if (text) try {
        const url = new URL(text);
        if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.port || /\s|\\/.test(text)) throw Error();
        payload[key] = url.href;
      } catch { errors[key] = "Enter an HTTPS URL without credentials or a custom port."; }
    }
  }
  const start = payload.start_date ?? payload.issued_on;
  const end = payload.end_date ?? payload.expires_on;
  if (typeof start === "string" && typeof end === "string" && end < start) errors[kind === "certifications" ? "expires_on" : "end_date"] = "End date must not precede start date.";
  const order = oneText(form, "sort_order");
  if (order === null || !/^(0|[1-9]\d{0,5})$/.test(order)) errors.sort_order = "Use a whole number from 0 to 999999.";
  payload.sort_order = order !== null && /^(0|[1-9]\d{0,5})$/.test(order) ? Number(order) : 0;
  return { payload, errors };
}
