import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../services/Authcontext.jsx'

export default function LogoutModal({ onClose }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/superadmin/login', { replace: true })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
        <h2 className="text-lg font-bold text-slate-800">Log Out?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Are you sure you want to log out? You will need to sign in again to access
          your assigned terminal.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#00529B] py-2.5 text-sm font-semibold text-[#00529B] transition hover:bg-blue-50"
          >
            Cancel
          </button>

          <button
            onClick={handleLogout}
            className="flex-1 rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-semibold text-white hover:bg-[#7d0809]"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}