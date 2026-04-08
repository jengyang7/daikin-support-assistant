export function shouldSuppressSources(content: string): boolean {
  const normalized = content
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return (
    normalized.includes("i couldn't find that in the daikin documentation i have access to") ||
    normalized.includes("i could not find that in the daikin documentation i have access to") ||
    normalized.includes("this appears to be a request for information unrelated to daikin hvac")
  );
}
