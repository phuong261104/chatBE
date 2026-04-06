export function toEntity<T extends Record<string, any>>(doc: Record<string, any> | null, removeKeys: string[] = []): T | null {
  if (!doc) return null;
  const { pk, sk, ...rest } = doc;
  const keysToRemove = new Set([...removeKeys, "pk", "sk", "GSI1PK", "GSI1SK", "GSI2PK", "GSI2SK"]);
  const filtered = Object.fromEntries(
    Object.entries(rest).filter(([key]) => !keysToRemove.has(key))
  );
  return filtered as T;
}

export function toEntityList<T extends Record<string, any>>(
  docs: Record<string, any>[],
  removeKeys: string[] = []
): T[] {
  return docs.map((doc) => toEntity<T>(doc, removeKeys));
}

export function convertToNumber(value: any): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseInt(value, 10);
  return undefined;
}