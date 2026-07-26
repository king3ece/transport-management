import { useState } from 'react'

import { api } from '../api/client'
import type { Driver, DriverStatus } from '../api/types'
import { Alert, Badge, EmptyRow, Field, Modal, PageHeader, Spinner, Table } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { LABELS, dateOnly } from '../lib/format'
import { useResource } from '../lib/useResource'

interface FormState {
  full_name: string
  phone: string
  license_number: string
  license_expiry: string
  status: DriverStatus
  hire_date: string
}

const EMPTY: FormState = {
  full_name: '',
  phone: '',
  license_number: '',
  license_expiry: '',
  status: 'available',
  hire_date: '',
}

export default function Drivers() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin', 'dispatcher')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | DriverStatus>('')
  const { data, error, loading, reload } = useResource<Driver[]>('/api/drivers', {
    search,
    status: statusFilter,
  })
  const [editing, setEditing] = useState<Driver | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormError(null)
    setOpen(true)
  }

  const openEdit = (driver: Driver) => {
    setEditing(driver)
    setForm({
      full_name: driver.full_name,
      phone: driver.phone,
      license_number: driver.license_number,
      license_expiry: driver.license_expiry,
      status: driver.status,
      hire_date: driver.hire_date ?? '',
    })
    setFormError(null)
    setOpen(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const payload = { ...form, hire_date: form.hire_date || null }
    try {
      if (editing) await api.patch(`/api/drivers/${editing.id}`, payload)
      else await api.post('/api/drivers', payload)
      setOpen(false)
      reload()
    } catch (cause) {
      setFormError((cause as Error).message)
    }
  }

  const remove = async (driver: Driver) => {
    if (!confirm(`Supprimer le chauffeur ${driver.full_name} ?`)) return
    try {
      await api.delete(`/api/drivers/${driver.id}`)
      reload()
    } catch (cause) {
      alert((cause as Error).message)
    }
  }

  const expiringSoon = (value: string) =>
    new Date(value).getTime() - Date.now() < 60 * 24 * 3600 * 1000

  return (
    <div>
      <PageHeader
        title="Chauffeurs"
        subtitle="Effectif, permis et disponibilité"
        actions={
          canEdit && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              Nouveau chauffeur
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Rechercher (nom, téléphone)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="input max-w-48"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as '' | DriverStatus)}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS.driverStatus).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <Alert message={error} />}
      {loading ? (
        <Spinner />
      ) : (
        <Table headers={['Nom', 'Téléphone', 'Permis', 'Expiration', 'Embauche', 'Statut', '']}>
          {(data ?? []).length === 0 ? (
            <EmptyRow colSpan={7} message="Aucun chauffeur." />
          ) : (
            (data ?? []).map((driver) => (
              <tr key={driver.id}>
                <td className="px-4 py-3 font-medium">{driver.full_name}</td>
                <td className="px-4 py-3">{driver.phone}</td>
                <td className="px-4 py-3 font-mono text-xs">{driver.license_number}</td>
                <td
                  className={`px-4 py-3 ${expiringSoon(driver.license_expiry) ? 'font-medium text-amber-600' : ''}`}
                >
                  {dateOnly(driver.license_expiry)}
                </td>
                <td className="px-4 py-3">{dateOnly(driver.hire_date)}</td>
                <td className="px-4 py-3">
                  <Badge value={driver.status} label={LABELS.driverStatus[driver.status]} />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {canEdit && (
                    <span className="flex justify-end gap-2">
                      <button type="button" className="btn-ghost" onClick={() => openEdit(driver)}>
                        Modifier
                      </button>
                      <button type="button" className="btn-danger" onClick={() => remove(driver)}>
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
        title={editing ? `Modifier ${editing.full_name}` : 'Nouveau chauffeur'}
        open={open}
        onClose={() => setOpen(false)}
      >
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
            <Field label="Téléphone">
              <input
                className="input"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                required
              />
            </Field>
            <Field label="Numéro de permis">
              <input
                className="input"
                value={form.license_number}
                onChange={(event) => setForm({ ...form, license_number: event.target.value })}
                required
              />
            </Field>
            <Field label="Expiration du permis">
              <input
                type="date"
                className="input"
                value={form.license_expiry}
                onChange={(event) => setForm({ ...form, license_expiry: event.target.value })}
                required
              />
            </Field>
            <Field label="Date d'embauche">
              <input
                type="date"
                className="input"
                value={form.hire_date}
                onChange={(event) => setForm({ ...form, hire_date: event.target.value })}
              />
            </Field>
            <Field label="Statut">
              <select
                className="input"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as DriverStatus })}
              >
                {Object.entries(LABELS.driverStatus).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
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
