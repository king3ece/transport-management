import { useState } from 'react'

import { api } from '../api/client'
import type { Customer, CustomerKind } from '../api/types'
import { Alert, EmptyRow, Field, Modal, PageHeader, Spinner, Table } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { LABELS, dateOnly } from '../lib/format'
import { useResource } from '../lib/useResource'

interface FormState {
  name: string
  kind: CustomerKind
  phone: string
  email: string
  address: string
}

const EMPTY: FormState = { name: '', kind: 'individual', phone: '', email: '', address: '' }

export default function Customers() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin', 'dispatcher')
  const [search, setSearch] = useState('')
  const { data, error, loading, reload } = useResource<Customer[]>('/api/customers', { search })
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormError(null)
    setOpen(true)
  }

  const openEdit = (customer: Customer) => {
    setEditing(customer)
    setForm({
      name: customer.name,
      kind: customer.kind,
      phone: customer.phone,
      email: customer.email ?? '',
      address: customer.address ?? '',
    })
    setFormError(null)
    setOpen(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const payload = { ...form, email: form.email || null, address: form.address || null }
    try {
      if (editing) await api.patch(`/api/customers/${editing.id}`, payload)
      else await api.post('/api/customers', payload)
      setOpen(false)
      reload()
    } catch (cause) {
      setFormError((cause as Error).message)
    }
  }

  const remove = async (customer: Customer) => {
    if (!confirm(`Supprimer le client ${customer.name} ?`)) return
    try {
      await api.delete(`/api/customers/${customer.id}`)
      reload()
    } catch (cause) {
      alert((cause as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Particuliers et entreprises expéditrices"
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            Nouveau client
          </button>
        }
      />

      <input
        className="input mb-4 max-w-xs"
        placeholder="Rechercher (nom, téléphone, email)"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {error && <Alert message={error} />}
      {loading ? (
        <Spinner />
      ) : (
        <Table headers={['Nom', 'Type', 'Téléphone', 'Email', 'Adresse', 'Créé le', '']}>
          {(data ?? []).length === 0 ? (
            <EmptyRow colSpan={7} message="Aucun client." />
          ) : (
            (data ?? []).map((customer) => (
              <tr key={customer.id}>
                <td className="px-4 py-3 font-medium">{customer.name}</td>
                <td className="px-4 py-3">{LABELS.customerKind[customer.kind]}</td>
                <td className="px-4 py-3">{customer.phone || '—'}</td>
                <td className="px-4 py-3">{customer.email ?? '—'}</td>
                <td className="px-4 py-3">{customer.address ?? '—'}</td>
                <td className="px-4 py-3">{dateOnly(customer.created_at)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {canEdit && (
                    <span className="flex justify-end gap-2">
                      <button type="button" className="btn-ghost" onClick={() => openEdit(customer)}>
                        Modifier
                      </button>
                      <button type="button" className="btn-danger" onClick={() => remove(customer)}>
                        Supprimer
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </Table>
      )}

      <Modal
        title={editing ? `Modifier ${editing.name}` : 'Nouveau client'}
        open={open}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit} className="space-y-4">
          {formError && <Alert message={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom / raison sociale">
              <input
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </Field>
            <Field label="Type">
              <select
                className="input"
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value as CustomerKind })}
              >
                {Object.entries(LABELS.customerKind).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Téléphone">
              <input
                className="input"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </Field>
            <Field label="Adresse">
              <input
                className="input"
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
