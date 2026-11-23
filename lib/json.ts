/** A parsed JSON object whose fields have not been validated yet. */
export type JsonObject = Record<string, unknown>;
export const isJsonObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
