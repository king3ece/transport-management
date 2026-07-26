import { useState } from 'react'

import { api } from '../api/client'
import type { Role, User } from '../api/types'
import { Alert, Badge, EmptyRow, Field, Modal, PageHeader, Spinner, Table } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { LABELS, dateOnly } from '../lib/format'
import { useResource } from '../lib/useResource'

interface FormState {
  email: string
  full_name: string
  role: Role
  password: string
}

const EMPTY: FormState = { email: '', full_name: '', role: 'client', password: '' }

export default function Users() {
  const { hasRole } = useAuth()
  const { data, error, loading, reload } = useResource<User[]>('/api/users')
  const [form, setForm] = useState<FormState>(EMPTY)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!hasRole('admin')) {
    return <Alert message="Accès réservé aux administrateurs." />
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    try {
      await api.post('/api/users', form)
      setOpen(false)
      setForm(EMPTY)
      reload()
    } catch (cause) {
      setFormError((cause as Error).message)
    }
  }

  const toggleActive = async (user: User) => {
    try {
      await api.patch(`/api/users/${user.id}`, { is_active: !user.is_active })
      reload()
    } catch (cause) {
      alert((cause as Error).message)
    }
  }

  const remove = async (user: User) => {
    if (!confirm(`Supprimer le compte ${user.email} ?`)) return
    try {
      await api.delete(`/api/users/${user.id}`)
      reload()
    } catch (cause) {
      alert((cause as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle="Comptes et rôles d'accès"
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setForm(EMPTY)
              setFormError(null)
              setOpen(true)
            }}
          >
            Nouvel utilisateur
          </button>
        }
      />

      {error && <Alert message={error} />}
      {loading ? (
        <Spinner />
      ) : (
        <Table headers={['Nom', 'Email', 'Rôle', 'État', 'Créé le', '']}>
          {(data ?? []).length === 0 ? (
            <EmptyRow colSpan={6} message="Aucun utilisateur." />
          ) : (
            (data ?? []).map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium">{user.full_name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{LABELS.role[user.role]}</td>
                <td className="px-4 py-3">
                  <Badge
                    value={user.is_active ? 'active' : 'out_of_service'}
                    label={user.is_active ? 'Actif' : 'Désactivé'}
                  />
                </td>
                <td className="px-4 py-3">{dateOnly(user.created_at)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <span className="flex justify-end gap-2">
                    <button type="button" className="btn-ghost" onClick={() => toggleActive(user)}>
                      {user.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button type="button" className="btn-danger" onClick={() => remove(user)}>
                      Supprimer
                    </button>
                  </span>
                </td>
              </tr>
            ))
          )}
        </Table>
      )}

      <Modal title="Nouvel utilisateur" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          {formError && <Alert message={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom complet">
              <input
                className="input"
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                required
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </Field>
            <Field label="Rôle">
              <select
                className="input"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
              >
                {Object.entries(LABELS.role).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mot de passe" hint="8 caractères minimum">
              <input
                type="password"
                className="input"
                minLength={8}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              Créer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
