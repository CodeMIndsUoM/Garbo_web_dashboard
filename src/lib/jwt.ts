export function decodeJwtPayload(token: string | null) {
  if (!token) return null;
  try {
    // Decode JWT payload on the client to read non-sensitive metadata (role, sub, email).
    // WARNING: This is purely for convenience and display; do not rely on this for authorization.
    // The backend must always validate tokens and enforce access control.
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    // base64url -> base64
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(b64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}
