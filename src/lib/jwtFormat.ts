/** Rough check for compact JWS (three base64url segments). */
export function looksLikeJwt(token: string): boolean {
  return token.split('.').length === 3 && token.length > 40;
}
