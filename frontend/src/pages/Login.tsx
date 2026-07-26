import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Alert, Field } from '../components/ui'

const DEMO_ACCOUNTS = [
  { label: 'Administrateur', email: 'admin@transport.tg', password: 'Admin1234' },
  { label: 'Régulateur', email: 'dispatch@transport.tg', password: 'Dispatch1234' },
  { label: 'Client', email: 'client@transport.tg', password: 'Client1234' },
]

export default function Login() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('admin@transport.tg')
  const [password, setPassword] = useState('Admin1234')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">TransGestion</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestion des voyageurs, du fret et de la flotte
          </p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          {error && <Alert message={error} />}
          <Field label="Email">
            <input
              type="email"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field label="Mot de passe">
            <input
              type="password"
              className="input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <p className="mb-2 font-medium text-slate-600">Comptes de démonstration</p>
            <ul className="space-y-1">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    className="text-brand-600 hover:underline"
                    onClick={() => {
                      setEmail(account.email)
                      setPassword(account.password)
                    }}
                  >
                    {account.label} — {account.email}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link to="/suivi" className="text-brand-600 hover:underline">
            Suivre un colis sans compte
          </Link>
        </p>
      </div>
    </div>
  )
}
