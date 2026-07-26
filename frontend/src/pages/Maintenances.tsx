import { useState } from 'react'

import { api } from '../api/client'
import type { Maintenance, MaintenanceKind, Vehicle } from '../api/types'
import { Alert, EmptyRow, Field, Modal, PageHeader, Spinner, Table } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { LABELS, currency, dateOnly } from '../lib/format'
import { useResource } from '../lib/useResource'

interface FormState {
  vehicle_id: number | ''
  kind: MaintenanceKind
  performed_on: string
  description: string
  cost: number
  odometer_km: number | ''
  next_due_on: string
}

const EMPTY: FormState = {
  vehicle_id: '',
  kind: 'preventive',
  performed_on: new Date().toISOString().slice(0, 10),
  description: '',
  cost: 0,
  odometer_km: '',
  next_due_on: '',
}

export default function Maintenances() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin', 'dispatcher')
  const [vehicleFilter, setVehicleFilter] = useState<'' | number>('')
  const { data, error, loading, reload } = useResource<Maintenance[]>('/api/maintenances', {
    vehicle_id: vehicleFilter,
  })
  const { data: vehicles } = useResource<Vehicle[]>('/api/vehicles')
  const [form, setForm] = useState<FormState>(EMPTY)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    try {
      await api.post('/api/maintenances', {
        ...form,
        vehicle_id: Number(form.vehicle_id),
        odometer_km: form.odometer_km === '' ? null : Number(form.odometer_km),
        next_due_on: form.next_due_on || null,
      })
      setOpen(false)
      setForm(EMPTY)
      reload()
    } catch (cause) {
      setFormError((cause as Error).message)
    }
  }

  const remove = async (record: Maintenance) => {
    if (!confirm('Supprimer cette intervention ?')) return
    try {
      await api.delete(`/api/maintenances/${record.id}`)
      reload()
    } catch (cause) {
      alert((cause as Error).message)
    }
  }

  const totalCost = (data ?? []).reduce((sum, record) => sum + record.cost, 0)

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle={`Interventions sur la flotte · total ${currency(totalCost)}`}
        actions={
          canEdit && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setForm(EMPTY)
                setFormError(null)
                setOpen(true)
              }}
            >
              Nouvelle intervention
            </button>
          )
        }
      />

      <select
        className="input mb-4 max-w-64"
        value={vehicleFilter}
        onChange={(event) => setVehicleFilter(event.target.value === '' ? '' : Number(event.target.value))}
      >
        <option value="">Tous les véhicules</option>
        {(vehicles ?? []).map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>
            {vehicle.registration}
          </option>
        ))}
      </select>

      {error && <Alert message={error} />}
      {loading ? (
        <Spinner />
      ) : (
        <Table headers={['Date', 'Véhicule', 'Type', 'Description', 'Coût', 'Km', 'Prochaine échéance', '']}>
          {(data ?? []).length === 0 ? (
            <EmptyRow colSpan={8} message="Aucune intervention." />
          ) : (
            (data ?? []).map((record) => (
              <tr key={record.id}>
                <td className="px-4 py-3 whitespace-nowrap">{dateOnly(record.performed_on)}</td>
                <td className="px-4 py-3 font-mono text-xs">{record.vehicle?.registration ?? '—'}</td>
                <td className="px-4 py-3">{LABELS.maintenanceKind[record.kind]}</td>
                <td className="px-4 py-3">{record.description || '—'}</td>
                <td className="px-4 py-3">{currency(record.cost)}</td>
                <td className="px-4 py-3">
                  {record.odometer_km ? record.odometer_km.toLocaleString('fr-FR') : '—'}
                </td>
                <td className="px-4 py-3">{dateOnly(record.next_due_on)}</td>
                <td className="px-4 py-3 text-right">
                  {canEdit && (
                    <button type="button" className="btn-danger" onClick={() => remove(record)}>
                      Supprimer
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </Table>
      )}

      <Modal title="Nouvelle intervention" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          {formError && <Alert message={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Véhicule">
              <select
                className="input"
                value={form.vehicle_id}
                onChange={(event) => setForm({ ...form, vehicle_id: Number(event.target.value) })}
                required
              >
                <option value="">Sélectionner…</option>
                {(vehicles ?? []).map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration} · {vehicle.brand} {vehicle.model}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                className="input"
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value as MaintenanceKind })}
              >
                {Object.entries(LABELS.maintenanceKind).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date d'intervention">
              <input
                type="date"
                className="input"
                value={form.performed_on}
                onChange={(event) => setForm({ ...form, performed_on: event.target.value })}
                required
              />
            </Field>
            <Field label="Prochaine échéance">
              <input
                type="date"
                className="input"
                value={form.next_due_on}
                onChange={(event) => setForm({ ...form, next_due_on: event.target.value })}
              />
            </Field>
            <Field label="Coût (FCFA)">
              <input
                type="number"
                min={0}
                className="input"
                value={form.cost}
                onChange={(event) => setForm({ ...form, cost: Number(event.target.value) })}
              />
            </Field>
            <Field label="Kilométrage" hint="Met à jour le compteur du véhicule si supérieur">
              <input
                type="number"
                min={0}
                className="input"
                value={form.odometer_km}
                onChange={(event) =>
                  setForm({
                    ...form,
                    odometer_km: event.target.value === '' ? '' : Number(event.target.value),
                  })
                }
              />
            </Field>
            <Field label="Description">
              <input
                className="input"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
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
