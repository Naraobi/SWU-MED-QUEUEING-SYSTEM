/*
|--------------------------------------------------------------------------
| AUDIT ACTOR HEADERS
|--------------------------------------------------------------------------
|
| The mutation endpoints are not token-gated, so the audit trail is
| attributed from the session the app already persisted on login
| (Authcontext saves the profile under "swumed_user"). These headers are
| attached to every create / update / delete request so the server can
| record who made the change.
|
*/

const STORAGE_KEY = "swumed_user";

export function getAuditActorHeaders() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return {};

    const user = JSON.parse(raw);

    if (!user || typeof user !== "object") return {};

    const name =
      [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.name ||
      user.position_name ||
      "";

    const headers = {};

    if (user.user_id) headers["X-Actor-Id"] = String(user.user_id);
    if (name) headers["X-Actor-Name"] = name;
    if (user.role) headers["X-Actor-Role"] = String(user.role);
    if (user.email) headers["X-Actor-Email"] = String(user.email);
    if (user.department_id) {
      headers["X-Actor-Department-Id"] = String(user.department_id);
    }

    return headers;
  } catch {
    return {};
  }
}
