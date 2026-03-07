import { nanoid, customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const generate = customAlphabet(alphabet, 7);

export function generateId(length = 7): string {
  return generate(length);
}
