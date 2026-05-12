import { createHash } from "crypto";

export async function hash(password: string): Promise<string> {
  return createHash("sha256").update(password + "reformai_salt").digest("hex");
}

export async function verify(password: string, passwordHash: string): Promise<boolean> {
  const computed = createHash("sha256").update(password + "reformai_salt").digest("hex");
  return computed === passwordHash;
}
