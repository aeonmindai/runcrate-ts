export function removeUndefined(
  obj: object,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function toSnakeCase(
  obj: object,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      // Recursively convert nested objects (but not arrays or null)
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[camelToSnake(key)] = toSnakeCase(value as object);
      } else {
        result[camelToSnake(key)] = value;
      }
    }
  }
  return result;
}

/**
 * Response keys to camelCase, recursively. The values of `rawKeys` (snake_case names, e.g. `tags`)
 * are user data whose own keys are kept as sent.
 */
export function toCamelCase(
  obj: unknown,
  rawKeys?: readonly string[],
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item, rawKeys));
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[snakeToCamel(key)] = rawKeys?.includes(key) ? value : toCamelCase(value, rawKeys);
    }
    return result;
  }
  return obj;
}
