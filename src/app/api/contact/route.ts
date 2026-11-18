import { handleContact } from "@/lib/contact/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleContact(request);
}
