
import {
  BarChart3,
  Building2,
  Check,
  ClipboardList,
  History,
  LayoutDashboard,
  ListOrdered,
  Monitor,
  MonitorSmartphone,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';

/* =========================================================
   FEATURE ACCESS SECTIONS

   Each item is matched against the features prop by key or
   label. If no matching feature is found, its fallback
   definition is used.

   Fallback keys should also exist in the parent's feature
   definitions for permission saving to work correctly.
========================================================= */

const SECTIONS = [
  {
    id: 'superadmin',
    title: 'SUPERADMIN',
    items: [
      {
        aliases: ['dashboard'],
        fallback: {
          key: 'dashboard',
          label: 'Dashboard',
          caption: 'Overview and system summary',
          icon: LayoutDashboard,
        },
      },
      {
        aliases: [
          'user management',
          'users',
          'user_management',
        ],
        fallback: {
          key: 'user_management',
          label: 'User Management',
          caption: 'Manage user accounts',
          icon: Users,
        },
      },
      {
        aliases: [
          'department management',
          'departments',
          'department_management',
        ],
        fallback: {
          key: 'department_management',
          label: 'Department Management',
          caption: 'Manage departments',
          icon: Building2,
        },
      },
      {
        aliases: [
          'kiosk management',
          'kiosk',
          'kiosks',
          'kiosk_management',
        ],
        fallback: {
          key: 'kiosk_management',
          label: 'Kiosk Management',
          caption: 'Manage kiosk devices',
          icon: MonitorSmartphone,
        },
      },
      {
        unlocked: true,
        aliases: [
          'role management',
          'roles',
          'role_management',
        ],
        fallback: {
          key: 'role_management',
          label: 'Role Management',
          caption: 'Manage roles and access',
          icon: ShieldCheck,
        },
      },
      {
        aliases: [
          'position management',
          'positions',
          'position_management',
        ],
        fallback: {
          key: 'positions',
          label: 'Position Management',
          caption: 'Manage staff positions',
          icon: UserCog,
        },
      },
      {
        aliases: [
          'queue management',
          'queue',
          'queues',
          'queue_management',
        ],
        fallback: {
          key: 'queue_management',
          label: 'Queue Management',
          caption: 'Manage queues',
          icon: ListOrdered,
        },
      },
      {
        aliases: [
          'reports and analytics',
          'reports & analytics',
          'reports',
          'analytics',
          'reports_analytics',
        ],
        fallback: {
          key: 'reports_analytics',
          label: 'Reports and Analytics',
          caption: 'View reports and insights',
          icon: BarChart3,
        },
      },
      {
        aliases: ['settings'],
        fallback: {
          key: 'settings',
          label: 'Settings',
          caption: 'System preferences',
          icon: Settings,
        },
      },
    ],
  },
  {
    id: 'admin',
    title: 'ADMIN',
    items: [
      {
        aliases: ['dashboard'],
        fallback: {
          key: 'dashboard',
          label: 'Dashboard',
          caption: 'Overview and system summary',
          icon: LayoutDashboard,
        },
      },
      {
        aliases: [
          'staff management',
          'staff',
          'staff_management',
        ],
        fallback: {
          key: 'staff_management',
          label: 'Staff Management',
          caption: 'Manage staff members',
          icon: UserCog,
        },
      },
      {
        aliases: [
          'queue management',
          'queue',
          'queues',
          'queue_management',
        ],
        fallback: {
          key: 'queue_management',
          label: 'Queue Management',
          caption: 'Manage queues',
          icon: ListOrdered,
        },
      },
      {
        aliases: [
          'terminal management',
          'terminal',
          'terminals',
          'terminal_management',
        ],
        fallback: {
          key: 'terminal_management',
          label: 'Terminal Management',
          caption: 'Manage service terminals',
          icon: Monitor,
        },
      },
      {
        aliases: [
          'reports and analytics',
          'reports & analytics',
          'reports',
          'analytics',
          'reports_analytics',
        ],
        fallback: {
          key: 'reports_analytics',
          label: 'Reports and Analytics',
          caption: 'View reports and insights',
          icon: BarChart3,
        },
      },
      {
        aliases: ['settings'],
        fallback: {
          key: 'settings',
          label: 'Settings',
          caption: 'System preferences',
          icon: Settings,
        },
      },
    ],
  },
  {
    id: 'staff',
    title: 'STAFF',
    items: [
      {
        aliases: [
          "today's queue",
          'todays queue',
          'today queue',
          'todays_queue',
          'today_queue',
        ],
        fallback: {
          key: 'todays_queue',
          label: "Today's Queue",
          caption: "View and serve today's queue",
          icon: ClipboardList,
        },
      },
      {
        aliases: [
          'queue history',
          'history',
          'queue_history',
        ],
        fallback: {
          key: 'queue_history',
          label: 'Queue History',
          caption: 'Review past queue records',
          icon: History,
        },
      },
      {
        aliases: ['settings'],
        fallback: {
          key: 'settings',
          label: 'Settings',
          caption: 'System preferences',
          icon: Settings,
        },
      },
    ],
  },
];

/* =========================================================
   NORMALIZATION
========================================================= */

const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/* =========================================================
   FEATURE RESOLUTION
========================================================= */

function resolveFeature(features, item) {
  const featureList = Array.isArray(features)
    ? features
    : [];

  const aliases = item.aliases.map(normalize);

  const match = featureList.find((feature) => {
    const key = normalize(feature.key);
    const label = normalize(feature.label);

    return aliases.includes(key) || aliases.includes(label);
  });

  return match || item.fallback;
}

/* =========================================================
   LEGACY PERMISSIONS -> SCOPED PERMISSIONS

   Older roles may contain plain keys such as "settings".
   Convert those keys into section-scoped permissions when
   opening the edit modal.
========================================================= */

export function scopePermissions(
  roleName,
  permissions,
  features
) {
  const list = Array.isArray(permissions)
    ? permissions
    : [];

  const scoped = list
    .filter((entry) => String(entry).includes(':'))
    .map(String);

  const legacy = list
    .filter((entry) => !String(entry).includes(':'))
    .map(normalize);

  if (legacy.length === 0) {
    return Array.from(new Set(scoped));
  }

  const resolveAll = (section) =>
    section.items.map((item) =>
      resolveFeature(features, item)
    );

  const hitsFor = (section) =>
    resolveAll(section).filter((feature) =>
      legacy.includes(normalize(feature.key))
    );

  const matchingSection = SECTIONS.find(
    (section) => section.id === normalize(roleName)
  );

  const section =
    matchingSection ||
    [...SECTIONS].sort(
      (a, b) => hitsFor(b).length - hitsFor(a).length
    )[0];

  const migrated = hitsFor(section).map(
    (feature) => `${section.id}:${feature.key}`
  );

  return Array.from(
    new Set([...scoped, ...migrated])
  );
}

/* =========================================================
   ADD / EDIT ROLE MODAL
========================================================= */

export default function AddRoleModal({
  mode = 'add',
  open = false,
  draft,
  setDraft,
  onToggle,
  onSelectAll,
  onClearAll,
  onClose,
  onSave,
  saving = false,
  features = [],
  availablePermissions = [],
  effectivePermissions,
}) {
  if (!open) {
    return null;
  }

  const edit = mode === 'edit';

  /*
   * The parent uses:
   *   role      = authorization classification
   *   role_name = custom role designation
   *
   * Do not use role_name for permission calculations.
   */

  const roleClassification = draft?.role || 'staff';

  const roleName = draft?.role_name ?? '';

  const permissions = Array.isArray(draft?.permissions)
    ? draft.permissions
    : [];

  const granted =
    typeof effectivePermissions === 'function'
      ? effectivePermissions(
          roleClassification,
          permissions
        )
      : [];

  /* =======================================================
     BUILD FEATURE SECTIONS
  ======================================================= */

  const sections = SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    features: section.items.map((item) => {
      const feature = resolveFeature(features, item);

      return {
        ...feature,
        baseKey: feature.key,
        locked: item.unlocked
          ? false
          : Boolean(feature.locked),
        key: `${section.id}:${feature.key}`,
      };
    }),
  }));

  const allBoxes = sections.flatMap(
    (section) => section.features
  );

  /* =======================================================
     ACTIVE SECTION

     Only one section may contain selections at a time.
     When no permissions are selected, all sections remain
     available for the user to choose from.
  ======================================================= */

  const activeSection =
    sections.find((section) =>
      section.features.some((feature) =>
        permissions.includes(feature.key)
      )
    ) || null;

  const scopeBoxes = activeSection
    ? activeSection.features
    : allBoxes;

  const selectableKeys = (
    activeSection
      ? activeSection.features
      : []
  )
    .filter((feature) => !feature.locked)
    .map((feature) => feature.key);

  /* =======================================================
     PERMISSION HELPERS
  ======================================================= */

  const isChecked = (key) =>
    permissions.includes(key) ||
    granted.includes(key);

  const allSelected =
    selectableKeys.length > 0 &&
    selectableKeys.every(isChecked);

  const enabledCount = scopeBoxes.filter(
    (feature) => isChecked(feature.key)
  ).length;

  /* =======================================================
     PERMISSION ACTIONS

     The local handlers are the primary behavior. The
     optional parent callbacks are retained for compatibility.
  ======================================================= */

  const handleToggle = (key) => {
    if (typeof onToggle === 'function') {
      onToggle(key);
      return;
    }

    setDraft((current) => {
      const currentPermissions = Array.isArray(
        current.permissions
      )
        ? current.permissions
        : [];

      const updated = currentPermissions.includes(key)
        ? currentPermissions.filter(
            (permission) => permission !== key
          )
        : [...currentPermissions, key];

      return {
        ...current,
        permissions: updated,
      };
    });
  };

  const handleSelectAll = () => {
    if (typeof onSelectAll === 'function') {
      onSelectAll(selectableKeys);
      return;
    }

    setDraft((current) => ({
      ...current,
      permissions: Array.from(
        new Set([
          ...(Array.isArray(current.permissions)
            ? current.permissions
            : []),
          ...selectableKeys,
        ])
      ),
    }));
  };

  const handleClearAll = () => {
    if (typeof onClearAll === 'function') {
      onClearAll(selectableKeys);
      return;
    }

    setDraft((current) => ({
      ...current,
      permissions: (
        Array.isArray(current.permissions)
          ? current.permissions
          : []
      ).filter(
        (key) => !selectableKeys.includes(key)
      ),
    }));
  };

  /* =======================================================
     FIELD UPDATES
  ======================================================= */

  const updateField = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  /* =======================================================
     VALIDATION
  ======================================================= */

  const hasRoleName = Boolean(
    String(roleName).trim()
  );

  const hasPermissions =
    permissions.length > 0;

  const canSave =
    !saving &&
    hasRoleName &&
    hasPermissions &&
    typeof onSave === 'function';

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-role-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="add-role-modal-title"
              className="text-base font-bold text-[#1F2937]"
            >
              {edit ? 'Edit Role' : 'Add Role'}
            </h2>

            <p className="mt-0.5 text-xs text-[#4B5563]">
              {edit
                ? 'Update role details and system feature access.'
                : 'Create a role and choose what it can access.'}
            </p>

            <p className="mt-0.5 text-xs text-[#9CA3AF]">
              Fields marked * are required.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-md p-1.5 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#1F2937] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* =================================================
            FORM BODY
        ================================================= */}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* ===============================================
              ROLE NAME + STATUS
          =============================================== */}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Role Name */}

            <div>
              <label
                htmlFor="role-name"
                className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
              >
                Role Name{' '}
                <span className="text-[#9D0A0E]">*</span>
              </label>

              <input
                id="role-name"
                type="text"
               value={draft.role_name}
                onChange={(event) =>
                  updateField(
                    'role_name',
                    event.target.value
                  )
                }
                placeholder="e.g. Billing Officer"
                disabled={saving}
                autoComplete="off"
                className="h-10 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10 disabled:cursor-not-allowed disabled:bg-[#F8F9FA]"
              />
            </div>

            {/* Status */}

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-[#1F2937]">
                Status{' '}
                <span className="text-[#9D0A0E]">*</span>
              </span>

              <div className="flex h-10 items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    updateField('status', 'Active')
                  }
                  aria-pressed={
                    draft.status === 'Active'
                  }
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    draft.status === 'Active'
                      ? 'border-[#9D0A0E] bg-[#FBF1F1] text-[#9D0A0E]'
                      : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#9CA3AF]'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Active
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    updateField('status', 'Inactive')
                  }
                  aria-pressed={
                    draft.status === 'Inactive'
                  }
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    draft.status === 'Inactive'
                      ? 'border-[#9D0A0E] bg-[#FBF1F1] text-[#9D0A0E]'
                      : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#9CA3AF]'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Inactive
                </button>
              </div>
            </div>
          </div>

          {/* ===============================================
              DESCRIPTION
          =============================================== */}

          <div className="mt-4">
            <label
              htmlFor="role-description"
              className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
            >
              Description
            </label>

            <textarea
              id="role-description"
              rows={3}
              value={draft.description ?? ''}
              onChange={(event) =>
                updateField(
                  'description',
                  event.target.value
                )
              }
              disabled={saving}
              placeholder="Describe the purpose of this role"
              className="w-full resize-none rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10 disabled:cursor-not-allowed disabled:bg-[#F8F9FA]"
            />
          </div>

          {/* ===============================================
              FEATURE ACCESS
          =============================================== */}

          <div className="mt-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-[#1F2937]">
                  Feature Access{' '}
                  <span className="text-[#9D0A0E]">*</span>
                </span>

                <span className="mt-0.5 block text-xs text-[#9CA3AF]">
                  Choose which system features this role can access.
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-[#9CA3AF]">
                  {enabledCount} of {scopeBoxes.length} features enabled
                </span>

                <button
                  type="button"
                  onClick={
                    allSelected
                      ? handleClearAll
                      : handleSelectAll
                  }
                  disabled={
                    saving ||
                    !activeSection ||
                    selectableKeys.length === 0
                  }
                  className="text-xs font-semibold text-[#9D0A0E] transition hover:text-[#7D080B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {allSelected
                    ? 'Clear all'
                    : 'Select all'}
                </button>
              </div>
            </div>

            {/* Grouped Feature Sections */}

            {sections.map((section) => {
              const blocked = Boolean(
                activeSection &&
                  activeSection.id !== section.id
              );

              return (
                <div
                  key={section.id}
                  className="mt-4"
                >
                  {/* Section Title */}

                  <span className="block text-xs font-semibold uppercase tracking-wide text-[#1F2937]">
                    {section.title}
                  </span>

                  {/* Feature Grid */}

                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {section.features.map((feature) => {
                      const Icon =
                        feature.icon || ShieldCheck;

                      const locked = Boolean(
                        feature.locked
                      );

                      const checked = isChecked(
                        feature.key
                      );

                      const disabled =
                        locked || blocked || saving;

                      return (
                        <button
                          key={feature.key}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (!disabled) {
                              handleToggle(feature.key);
                            }
                          }}
                          aria-pressed={checked}
                          title={
                            locked
                              ? 'This feature is reserved for the Superadmin role.'
                              : blocked
                                ? `Clear your ${activeSection.title} selections to choose from this section.`
                                : undefined
                          }
                          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                            locked
                              ? 'cursor-not-allowed border-transparent bg-[#F8F9FA]'
                              : blocked
                                ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F8F9FA] opacity-50'
                                : checked
                                  ? 'border-[#9D0A0E] bg-white'
                                  : 'border-[#E5E7EB] bg-white hover:border-[#9CA3AF]'
                          } ${
                            saving
                              ? 'cursor-not-allowed opacity-70'
                              : ''
                          }`}
                        >
                          {/* Icon */}

                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                              checked
                                ? 'bg-[#FBF1F1] text-[#9D0A0E]'
                                : 'bg-[#F1F3F5] text-[#9CA3AF]'
                            }`}
                          >
                            <Icon size={13} />
                          </span>

                          {/* Feature Text */}

                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-xs font-semibold ${
                                locked
                                  ? 'text-[#9CA3AF]'
                                  : checked
                                    ? 'text-[#1F2937]'
                                    : 'text-[#4B5563]'
                              }`}
                            >
                              {feature.label}
                            </span>

                            <span className="block truncate text-xs text-[#9CA3AF]">
                              {feature.caption}
                            </span>
                          </span>

                          {/* Checkbox Indicator */}

                          <span
                            aria-hidden="true"
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              checked
                                ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white'
                                : 'border-[#D1D5DB] bg-white text-transparent'
                            }`}
                          >
                            <Check
                              size={9}
                              strokeWidth={3}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="swu-press h-9 rounded-lg bg-[#9D0A0E] px-4 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            {saving
              ? 'Saving...'
              : edit
                ? 'Update Role'
                : 'Save Role'}
          </button>
        </div>
      </div>
    </div>
  );
}