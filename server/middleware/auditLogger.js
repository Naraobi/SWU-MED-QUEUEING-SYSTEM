const { recordAudit } = require("../services/auditLogService");

/*
|--------------------------------------------------------------------------
| AUDIT TRAIL MIDDLEWARE
|--------------------------------------------------------------------------
|
| Records a row in audit_logs whenever a known create / update / delete
| route answers successfully. It is registered globally and only reacts
| to a small allowlist of admin-managed mutation routes, so unrelated
| traffic (queue tickets, patient kiosks, ...) is never logged.
|
| Identity comes from the same session the app already trusts: the
| frontend sends X-Actor-* headers carrying the signed-in profile. The
| mutation routes themselves are not token-gated (the app's existing
| trust model), so this is the only way to attribute a change without a
| broader auth refactor.
|
*/

function headerValue(req, name) {
  const value = req.headers[name];

  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function entityNameFor(entityType, body) {
  if (!body || typeof body !== "object") return null;

  switch (entityType) {
    case "user":
      return (
        [body.first_name || body.firstName, body.last_name || body.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        body.email ||
        body.name ||
        null
      );

    case "department":
      return body.name || body.department_name || body.departmentName || null;

    case "counter":
      return (
        body.counter_number ||
        body.counterNumber ||
        body.name ||
        body.label ||
        null
      );

    case "role":
      return body.role_name || body.roleName || body.role || null;

    case "position":
      return body.name || body.position_name || body.positionName || null;

    case "kiosk":
      return body.name || body.kiosk_name || body.kioskName || null;

    default:
      return null;
  }
}

function detailsFor(entityType, body) {
  if (!body || typeof body !== "object") return null;

  const parts = [];

  switch (entityType) {
    case "user":
      if (body.role) parts.push(`Role: ${body.role}`);
      if (body.department) parts.push(`Department: ${body.department}`);
      if (body.status) parts.push(`Status: ${body.status}`);
      break;

    case "department":
      if (body.prefix) parts.push(`Prefix: ${body.prefix}`);
      if (body.status) parts.push(`Status: ${body.status}`);
      break;

    case "counter":
      if (body.prefix) parts.push(`Prefix: ${body.prefix}`);
      if (body.department_id) parts.push(`Department: ${body.department_id}`);
      if (body.status) parts.push(`Status: ${body.status}`);
      break;

    case "role":
      if (body.role) parts.push(`Type: ${body.role}`);
      if (Array.isArray(body.permissions)) {
        parts.push(`${body.permissions.length} permission(s)`);
      }
      break;

    case "position":
      if (Array.isArray(body.tabs)) parts.push(`${body.tabs.length} tab(s)`);
      if (body.status) parts.push(`Status: ${body.status}`);
      break;

    case "kiosk":
      if (body.status) parts.push(`Status: ${body.status}`);
      break;

    default:
      break;
  }

  return parts.length ? parts.join(" | ") : null;
}

function staffDetails(body) {
  if (!body || typeof body !== "object") return null;

  return body.staff_id ? `Staff: ${body.staff_id}` : null;
}

const MUTATION_ROUTES = [
  // Users
  { method: "POST", pattern: /^\/api\/users\/?$/i, entityType: "user", action: "created" },
  { method: "PUT", pattern: /^\/api\/users\/([^/]+)\/?$/i, entityType: "user", action: "updated", entityIdFrom: 1 },
  { method: "DELETE", pattern: /^\/api\/users\/([^/]+)\/?$/i, entityType: "user", action: "deleted", entityIdFrom: 1 },

  // Departments
  { method: "POST", pattern: /^\/api\/departments\/?$/i, entityType: "department", action: "created" },
  { method: "PUT", pattern: /^\/api\/departments\/([^/]+)\/?$/i, entityType: "department", action: "updated", entityIdFrom: 1 },
  { method: "DELETE", pattern: /^\/api\/departments\/([^/]+)\/?$/i, entityType: "department", action: "deleted", entityIdFrom: 1 },

  // Terminals (counters) including assignment
  { method: "POST", pattern: /^\/api\/counters\/?$/i, entityType: "counter", action: "created" },
  { method: "PUT", pattern: /^\/api\/counters\/([^/]+)\/?$/i, entityType: "counter", action: "updated", entityIdFrom: 1 },
  { method: "DELETE", pattern: /^\/api\/counters\/([^/]+)\/?$/i, entityType: "counter", action: "deleted", entityIdFrom: 1 },
  { method: "POST", pattern: /^\/api\/counters\/([^/]+)\/assign\/?$/i, entityType: "counter", action: "assigned", entityIdFrom: 1, details: staffDetails },
  { method: "POST", pattern: /^\/api\/counters\/([^/]+)\/release\/?$/i, entityType: "counter", action: "released", entityIdFrom: 1, details: staffDetails },

  // Roles
  { method: "POST", pattern: /^\/api\/roles\/?$/i, entityType: "role", action: "created" },
  { method: "PUT", pattern: /^\/api\/roles\/([^/]+)\/?$/i, entityType: "role", action: "updated", entityIdFrom: 1 },
  { method: "DELETE", pattern: /^\/api\/roles\/([^/]+)\/?$/i, entityType: "role", action: "deleted", entityIdFrom: 1 },

  // Positions
  { method: "POST", pattern: /^\/api\/positions\/?$/i, entityType: "position", action: "created" },
  { method: "PUT", pattern: /^\/api\/positions\/([^/]+)\/?$/i, entityType: "position", action: "updated", entityIdFrom: 1 },
  { method: "DELETE", pattern: /^\/api\/positions\/([^/]+)\/?$/i, entityType: "position", action: "deleted", entityIdFrom: 1 },

  // Kiosks
  { method: "POST", pattern: /^\/api\/kiosks\/?$/i, entityType: "kiosk", action: "created" },
  { method: "PUT", pattern: /^\/api\/kiosks\/([^/]+)\/?$/i, entityType: "kiosk", action: "updated", entityIdFrom: 1 },
  { method: "DELETE", pattern: /^\/api\/kiosks\/([^/]+)\/?$/i, entityType: "kiosk", action: "deleted", entityIdFrom: 1 },
];

function matchRoute(method, path) {
  return MUTATION_ROUTES.find(
    (route) => route.method === method && route.pattern.test(path)
  );
}

function pathParam(route, path) {
  if (!route.entityIdFrom) return null;

  const match = path.match(route.pattern);

  if (!match || !match[route.entityIdFrom]) return null;

  try {
    return decodeURIComponent(match[route.entityIdFrom]);
  } catch {
    return match[route.entityIdFrom];
  }
}

function auditTrail(req, res, next) {
  const method = String(req.method || "").toUpperCase();

  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return next();
  }

  const path = String(req.originalUrl || req.url || "").split("?")[0];

  res.on("finish", () => {
    try {
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      const route = matchRoute(method, path);

      if (!route) return;

      const body =
        req.body && typeof req.body === "object" ? req.body : {};

      const entityId =
        pathParam(route, path) ||
        body.department_id ||
        body.user_id ||
        body.role_id ||
        body.position_id ||
        body.counter_id ||
        body.kiosk_id ||
        null;

      recordAudit({
        actorId: headerValue(req, "x-actor-id"),
        actorName: headerValue(req, "x-actor-name"),
        actorRole: headerValue(req, "x-actor-role"),
        actorEmail: headerValue(req, "x-actor-email"),
        action: route.action,
        entityType: route.entityType,
        entityId,
        entityName: entityNameFor(route.entityType, body),
        details: route.details
          ? route.details(body)
          : detailsFor(route.entityType, body),
        departmentId:
          headerValue(req, "x-actor-department-id") ||
          body.department_id ||
          null,
      });
    } catch (error) {
      console.error("AUDIT TRAIL ERROR:", error.message);
    }
  });

  return next();
}

module.exports = {
  auditTrail,
};
