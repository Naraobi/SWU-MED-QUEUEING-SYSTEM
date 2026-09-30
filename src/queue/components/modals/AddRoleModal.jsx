import {
  Check,
  X,
} from 'lucide-react';

export default function AddRoleModal({
  open,
  draft,
  setDraft,
  onToggle,
  onSelectAll,
  onClearAll,
  onClose,
  onSave,
  saving,
  features,
  availablePermissions,
  effectivePermissions,
}) {
    if (!open) {
  return null;
}
  const granted = effectivePermissions(
    draft.name,
    draft.permissions
  );

  const allSelected =
    availablePermissions.length > 0 &&
    availablePermissions.every((key) =>
      draft.permissions.includes(key)
    );

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
        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="add-role-modal-title"
              className="text-base font-bold text-[#1F2937]"
            >
              Add Role
            </h2>

            <p className="mt-0.5 text-xs text-[#4B5563]">
              Create a role and choose what it can access.
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

        {/* =====================================================
            FORM BODY
        ===================================================== */}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* =================================================
              ROLE NAME + STATUS
          ================================================= */}

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
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Billing Officer"
                disabled={saving}
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
                    setDraft((current) => ({
                      ...current,
                      status: 'Active',
                    }))
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
                    setDraft((current) => ({
                      ...current,
                      status: 'Inactive',
                    }))
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

          {/* =================================================
              DESCRIPTION
          ================================================= */}

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
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              disabled={saving}
              placeholder="Describe the purpose of this role"
              className="w-full resize-none rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10 disabled:cursor-not-allowed disabled:bg-[#F8F9FA]"
            />
          </div>

          {/* =================================================
              FEATURE ACCESS
          ================================================= */}

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
                  {granted.length} of {features.length} features enabled
                </span>

                <button
                  type="button"
                  onClick={
                    allSelected
                      ? onClearAll
                      : onSelectAll
                  }
                  disabled={saving}
                  className="text-xs font-semibold text-[#9D0A0E] transition hover:text-[#7D080B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {allSelected
                    ? 'Clear all'
                    : 'Select all'}
                </button>
              </div>
            </div>

            {/* Feature Grid */}

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {features.map((feature) => {
                const Icon = feature.icon;

                const locked = Boolean(
                  feature.locked
                );

                const checked =
                  granted.includes(feature.key);

                return (
                  <button
                    key={feature.key}
                    type="button"
                    disabled={locked || saving}
                    onClick={() =>
                      !locked &&
                      onToggle(feature.key)
                    }
                    aria-pressed={checked}
                    title={
                      locked
                        ? 'This feature is reserved for the Superadmin role.'
                        : undefined
                    }
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                      locked
                        ? 'cursor-not-allowed border-transparent bg-[#F8F9FA]'
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

                    {/* Text */}

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

                    {/* Checkbox */}

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
        </div>

        {/* =====================================================
            FOOTER
        ===================================================== */}

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
            disabled={
              saving ||
              !draft.name.trim() ||
              draft.permissions.length === 0
            }
            className="swu-press h-9 rounded-lg bg-[#9D0A0E] px-4 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            {saving ? 'Saving...' : 'Save Role'}
          </button>
        </div>
      </div>
    </div>
  );
}