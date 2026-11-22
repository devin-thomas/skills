// What an unknown thrown value says, for messages and reports. Strict TypeScript types a caught
// value as `unknown`; these read it without assuming it is an Error.

/** The Node error code ("ENOENT", "ECONNREFUSED"), when the value carries one. */
export const codeOf = (error: unknown): string | undefined => {
  const code = error instanceof Error ? (error as Error & { code?: unknown }).code : undefined;
  return typeof code === 'string' ? code : undefined;
};

/** The message of an Error, or the value as text. */
export const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The stack of an Error, or the value as text. */
export const stackOf = (error: unknown): string => (error instanceof Error ? (error.stack ?? error.message) : String(error));
