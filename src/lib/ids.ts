import { customAlphabet, nanoid } from "nanoid";

export const newId = () => nanoid(21);

/** Short, URL-safe, unambiguous code for /b/{code}. */
export const newShortCode = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 6);

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
