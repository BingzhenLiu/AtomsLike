const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "media-src data: blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

/** Injects the locked-down CSP so a generated document cannot reach the network. */
export function hardenGeneratedHtml(html: string): string {
  const withoutExistingCsp = html.replace(
    /<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi,
    "",
  );
  const securityMeta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  if (/<head(?:\s|>)[^>]*>/i.test(withoutExistingCsp)) {
    return withoutExistingCsp.replace(/<head([^>]*)>/i, `<head$1>${securityMeta}`);
  }
  return withoutExistingCsp.replace(/<html([^>]*)>/i, `<html$1><head>${securityMeta}</head>`);
}
