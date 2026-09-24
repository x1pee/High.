const DISPLAY_VERSION = /^\d+(?:\.\d+){1,3}(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/;

export function isDisplayVersion(value) {
  return typeof value === "string" && DISPLAY_VERSION.test(value);
}

export function applyDisplayVersion(source, version) {
  if (!isDisplayVersion(version)) throw new Error("Invalid display version");
  return source.replaceAll("__APP_VERSION__", version);
}

export function parseReleaseHistory(markdown, limit = 8) {
  const headings = [...markdown.matchAll(/^#\s+Версия\s+(\S+).*$/gm)];
  return headings.slice(0, limit).map((match, index) => {
    const start = match.index + match[0].length;
    const end = headings[index + 1]?.index ?? markdown.length;
    const notes = markdown
      .slice(start, end)
      .split(/\r?\n/)
      .filter((line) => /^-\s+/.test(line))
      .map((line) => line.replace(/^-\s+/, "").trim())
      .filter(Boolean)
      .join(" ");
    return { version: match[1].trim(), notes };
  });
}
