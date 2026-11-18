export const profileFields = {
  full_name: { label: "Name", max: 120 },
  headline: { label: "Headline", max: 240 },
  biography: { label: "Biography", max: 10000 },
  professional_summary: { label: "Professional summary", max: 3000 },
  linkedin: { label: "LinkedIn", max: 2048 },
  fiverr: { label: "Fiverr", max: 2048 },
  github: { label: "GitHub", max: 2048 },
  upwork: { label: "Upwork", max: 2048 },
  public_email: { label: "Public email", max: 254 },
} as const;
export type ProfileField = keyof typeof profileFields;
export type ProfileValues = Record<ProfileField, string>;
export const emptyProfile: ProfileValues = {
  full_name: "", headline: "", biography: "", professional_summary: "",
  linkedin: "", fiverr: "", github: "", upwork: "", public_email: "",
};
export type EditorState = {
  values: ProfileValues; revision: number; publishedRevision: number | null;
  errors: Partial<Record<ProfileField, string>>; message: string; ok: boolean;
};

export function validateProfile(form: FormData) {
  const values = { ...emptyProfile };
  const errors: EditorState["errors"] = {};
  for (const key of Object.keys(profileFields) as ProfileField[]) {
    const entries = form.getAll(key);
    const raw = entries[0];
    if (entries.length !== 1 || typeof raw !== "string") {
      errors[key] = "Provide one text value.";
      continue;
    }
    values[key] = raw.trim();
    if (raw.length > profileFields[key].max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw)) {
      errors[key] = `Use valid text of at most ${profileFields[key].max} characters.`;
    }
  }
  if (!values.full_name) errors.full_name = "Enter your name.";
  for (const key of ["linkedin", "fiverr", "github", "upwork"] as const) {
    if (!values[key]) continue;
    try {
      const url = new URL(values[key]);
      const domain = { linkedin: "linkedin.com", fiverr: "fiverr.com", github: "github.com", upwork: "upwork.com" }[key];
      if (url.protocol !== "https:" || ![domain, `www.${domain}`].includes(url.hostname) ||
          url.username || url.password || url.port || /\s|\\/.test(values[key])) throw Error();
      values[key] = url.href;
    } catch { errors[key] = `Enter an HTTPS ${profileFields[key].label} URL on its official domain.`; }
  }
  if (values.public_email && !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(values.public_email)) {
    errors.public_email = "Enter a valid public email address.";
  }
  return { values, errors };
}
