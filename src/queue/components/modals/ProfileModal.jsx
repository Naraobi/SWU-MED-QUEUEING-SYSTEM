import { useEffect, useState } from 'react'
import { Briefcase, Building2, Mail, Monitor, Pencil, RefreshCw, ShieldCheck, User, X } from 'lucide-react'
import { useAuth } from '../../services/Authcontext.jsx'
import { extractDominantColor } from '../../theme/colors'

/*
 * Profile pictures are stored separately from the system logo.
 *
 * IMPORTANT:
 * Do NOT use logoUrl / onLogoChange for the user's profile picture.
 *
 * The system logo remains controlled by AppearanceContext /
 * StaffPreferencesContext.
 */

const PROFILE_AVATAR_PREFIX = 'swumed_profile_avatar_'

function getProfileAvatarKey(user) {
  const identity =
    user?.uid ||
    user?.id ||
    user?.user_id ||
    user?.firebase_uid ||
    user?.email ||
    `${user?.first_name || 'user'}_${user?.last_name || 'profile'}`

  return `${PROFILE_AVATAR_PREFIX}${String(identity)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')}`
}

export function getStoredProfileAvatar(user) {
  if (!user || typeof window === 'undefined') {
    return ''
  }

  try {
    return window.localStorage.getItem(getProfileAvatarKey(user)) || ''
  } catch (error) {
    console.error('Failed to load profile picture:', error)
    return ''
  }
}

function saveStoredProfileAvatar(user, avatar) {
  if (!user || typeof window === 'undefined') {
    return
  }

  try {
    const key = getProfileAvatarKey(user)

    if (avatar) {
      window.localStorage.setItem(key, avatar)
    } else {
      window.localStorage.removeItem(key)
    }

    /*
     * Notify AdminHeaderBar / Staff Topbar immediately.
     */
    window.dispatchEvent(
      new CustomEvent('swumed-profile-avatar-changed', {
        detail: {
          key,
          avatar: avatar || '',
        },
      })
    )
  } catch (error) {
    console.error('Failed to save profile picture:', error)
  }
}

// Shared by Admin and Staff.
export default function ProfileModal({
  onClose,
  accent = '#9D0A0E',
  logoUrl = '',
  onLogoChange,
  onAccentChange,
  onAvatarChange,
  t = (key) => key,
}) {
  const { user } = useAuth()

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  /*
   * This is now completely separate from logoUrl.
   */
  const [profileAvatar, setProfileAvatar] = useState(() =>
    getStoredProfileAvatar(user)
  )

  /*
   * Used so the selected photo is only committed when Save is clicked.
   */
  const [pendingAvatar, setPendingAvatar] = useState(() =>
    getStoredProfileAvatar(user)
  )

  /*
   * Keep the existing permission behavior:
   * if onLogoChange exists, the account can edit the photo.
   */
  const canEditPhoto = typeof onLogoChange === 'function'

  /*
   * The actual profile photo is editable independently.
   *
   * We still keep canEditPhoto based on the existing parent logic
   * so Admin/Staff permissions do not change.
   */
  const canEditProfilePhoto = canEditPhoto

  useEffect(() => {
    const avatar = getStoredProfileAvatar(user)

    setProfileAvatar(avatar)
    setPendingAvatar(avatar)
    setUploadError('')
  }, [user])

  const fullName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : t('profile.unknownName')

  const initials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : '—'

  const roleValue = String(user?.role?.role ?? user?.role ?? '').trim().toLowerCase()

  const roleLabel =
    roleValue === 'superadmin'
      ? t('profile.roleSuperAdmin')
      : roleValue === 'admin'
      ? t('profile.roleAdmin')
      : roleValue === 'staff'
      ? t('profile.roleStaff')
      : t('profile.roleUnknown')

  const isActive =
    String(user?.status ?? 'Active').trim().toLowerCase() === 'active'

  const fields = [
    {
      icon: User,
      label: t('profile.fullName'),
      value: fullName,
    },
    {
      icon: Mail,
      label: t('profile.email'),
      value: user?.email || '—',
    },
    {
      icon: ShieldCheck,
      label: t('profile.role'),
      value: roleLabel,
    },
    {
      icon: Briefcase,
      label: t('profile.position'),
      value: user?.position_name || user?.position || '—',
    },
    {
      icon: Building2,
      label: t('profile.department'),
      value: user?.department || '—',
    },
    {
      icon: Monitor,
      label: t('profile.kiosk'),
      value: user?.kiosk || '—',
    },
  ]

  /*
   * Select a photo.
   *
   * IMPORTANT:
   * We DO NOT call onLogoChange here anymore.
   *
   * The selected image is only placed into pendingAvatar.
   * It becomes the user's actual profile picture when Save is clicked.
   */
  function handlePhotoChange(event) {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file || !canEditProfilePhoto) return

    setUploadError('')
    setUploading(true)

    if (!file.type.startsWith('image/')) {
      setUploadError(t('profile.photoError'))
      setUploading(false)
      return
    }

    const reader = new FileReader()

    reader.onload = async () => {
      const dataUrl = reader.result

      if (!dataUrl) {
        setUploadError(t('profile.photoError'))
        setUploading(false)
        return
      }

      /*
       * Only preview it for now.
       */
      setPendingAvatar(dataUrl)

      /*
       * Keep your existing accent-color extraction logic.
       *
       * This does NOT change the system logo.
       * It only keeps the existing accent behavior you already had.
       */
      try {
        const dominantColor = await extractDominantColor(dataUrl)

        if (
          dominantColor &&
          typeof onAccentChange === 'function'
        ) {
          onAccentChange(dominantColor)
        }
      } catch (error) {
        console.error(
          'Failed to extract a color from the uploaded photo:',
          error
        )
      } finally {
        setUploading(false)
      }
    }

    reader.onerror = () => {
      setUploadError(t('profile.photoError'))
      setUploading(false)
    }

    reader.readAsDataURL(file)
  }

  /*
   * SAVE PROFILE PICTURE
   */
  function handleSave() {
    if (!canEditProfilePhoto || uploading) {
      return
    }

    try {
      saveStoredProfileAvatar(user, pendingAvatar)

      setProfileAvatar(pendingAvatar)

      /*
       * Update the top-right avatar immediately.
       */
      if (typeof onAvatarChange === 'function') {
        onAvatarChange(pendingAvatar)
      }

      onClose?.()
    } catch (error) {
      console.error('Failed to save profile picture:', error)

      setUploadError(
        error?.message || t('profile.photoError')
      )
    }
  }

  /*
   * Cancel without saving the new photo.
   */
  function handleCancel() {
    setPendingAvatar(profileAvatar)
    setUploadError('')
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleCancel()
        }
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div
          className="relative h-24"
          style={{ backgroundColor: accent }}
        >
          <button
            type="button"
            onClick={handleCancel}
            aria-label={t('profile.close')}
            className="absolute right-3 top-3 rounded-md p-1 text-white/80 transition hover:bg-black/10 hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>

          {canEditProfilePhoto ? (
            <label
              className="group absolute left-1/2 top-full flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-white text-2xl font-bold text-[#1F2937] shadow-sm"
              style={{
                backgroundColor: `${accent}1A`,
              }}
              title={t('profile.changePhoto')}
            >
              {pendingAvatar ? (
                <img
                  src={pendingAvatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}

              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {uploading ? (
                  <RefreshCw
                    size={18}
                    className="animate-spin text-white"
                  />
                ) : (
                  <Pencil
                    size={18}
                    className="text-white"
                  />
                )}
              </span>

              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={handlePhotoChange}
              />
            </label>
          ) : (
            <div
              className="absolute left-1/2 top-full flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-4 border-white text-2xl font-bold text-[#1F2937] shadow-sm"
              style={{
                backgroundColor: `${accent}1A`,
              }}
            >
              {profileAvatar ? (
                <img
                  src={profileAvatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-12 text-center">
          <p className="text-lg font-bold text-[#1F2937]">
            {fullName}
          </p>

          {uploadError && (
            <p className="mt-1 text-xs text-[#9D0A0E]">
              {uploadError}
            </p>
          )}

          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isActive
                  ? 'bg-emerald-500'
                  : 'bg-slate-400'
              }`}
            />

            {t('profile.statusLabel')}{' '}
            {isActive
              ? t('profile.active')
              : t('profile.inactive')}
          </span>

          <div className="mt-5 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
            {fields.map(
              ({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5"
                >
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                    <Icon size={12} />
                    {label}
                  </p>

                  <p
                    className="mt-1 truncate text-sm font-bold text-[#1F2937]"
                    title={value}
                  >
                    {value}
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] px-6 py-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={uploading}
            className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-2 text-xs font-semibold text-[#1F2937] transition hover:bg-[#F1F3F5] disabled:opacity-50"
          >
            {t('profile.close')}
          </button>

          {canEditProfilePhoto && (
            <button
              type="button"
              onClick={handleSave}
              disabled={uploading}
              className="rounded-lg bg-[#9D0A0E] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}