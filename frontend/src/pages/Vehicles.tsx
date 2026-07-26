import { useState } from 'react'

import { api } from '../api/client'
import type { Vehicle, VehicleKind, VehicleStatus } from '../api/types'
import { Alert, Badge, EmptyRow, Field, Modal, PageHeader, Spinner, Table } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { LABELS } from '../lib/format'
import { useResource } from '../lib/useResource'

interface FormState {
  registration: string
  brand: string
  model: string
  kind: VehicleKind
  seat_capacity: number
  cargo_capacity_kg: number
  year: number
  odometer_km: number
  status: VehicleStatus
}

const EMPTY: FormState = {
  registration: '',
  brand: '',
  model: '',
  kind: 'bus',
  seat_capacity: 30,
  cargo_capacity_kg: 500,
  year: new Date().getFullYear(),
  odometer_km: 0,
  status: 'active',
}

export default function Vehicles() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin', 'dispatcher')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | VehicleStatus>('')
  const { data, error, loading, reload } = useResource<Vehicle[]>('/api/vehicles', {
    search,
    status: statusFilter,
  })
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormError(null)
    setOpen(true)
  }

  const openEdit = (vehicle: Vehicle) => {
    setEditing(vehicle)
    setForm({ ...vehicle, year: vehicle.year ?? new Date().getFullYear() })
    setFormError(null)
    setOpen(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    try {
      if (editing) await api.patch(`/api/vehicles/${editing.id}`, form)
      else await api.post('/api/vehicles', form)
      setOpen(false)
      reload()
    } catch (cause) {
      setFormError((cause as Error).message)
    }
  }

  const remove = async (vehicle: Vehicle) => {
    if (!confirm(`Supprimer le véhicule ${vehicle.registration} ?`)) return
    try {
      await api.delete(`/api/vehicles/${vehicle.id}`)
      reload()
    } catch (cause) {
      alert((cause as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Véhicules"
        subtitle="Flotte, capacités et disponibilité"
        actions={
          canEdit && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              Nouveau véhicule
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Rechercher (immatriculation, marque…)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="input max-w-48"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as '' | VehicleStatus)}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS.vehicleStatus).map(([value, label]) => (
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
        <Table headers={['Immatriculation', 'Véhicule', 'Type', 'Places', 'Fret (kg)', 'Km', 'Statut', '']}>
          {(data ?? []).length === 0 ? (
            <EmptyRow colSpan={8} message="Aucun véhicule." />
          ) : (
            (data ?? []).map((vehicle) => (
              <tr key={vehicle.id}>
                <td className="px-4 py-3 font-mono text-xs">{vehicle.registration}</td>
                <td className="px-4 py-3">
                  {vehicle.brand} {vehicle.model}
                  {vehicle.year ? <span className="text-slate-400"> · {vehicle.year}</span> : null}
                </td>
                <td className="px-4 py-3">{LABELS.vehicleKind[vehicle.kind]}</td>
                <td className="px-4 py-3">{vehicle.seat_capacity}</td>
                <td className="px-4 py-3">{vehicle.cargo_capacity_kg}</td>
                <td className="px-4 py-3">{vehicle.odometer_km.toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3">
                  <Badge value={vehicle.status} label={LABELS.vehicleStatus[vehicle.status]} />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {canEdit && (
                    <span className="flex justify-end gap-2">
                      <button type="button" className="btn-ghost" onClick={() => openEdit(vehicle)}>
                        Modifier
                      </button>
                      <button type="button" className="btn-danger" onClick={() => remove(vehicle)}>
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
        title={editing ? `Modifier ${editing.registration}` : 'Nouveau véhicule'}
        open={open}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit} className="space-y-4">
          {formError && <Alert message={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Immatriculation">
              <input
                className="input"
                value={form.registration}
                onChange={(event) => setForm({ ...form, registration: event.target.value })}
                required
              />
            </Field>
            <Field label="Type">
              <select
                className="input"
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value as VehicleKind })}
              >
                {Object.entries(LABELS.vehicleKind).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Marque">
              <input
                className="input"
                value={form.brand}
                onChange={(event) => setForm({ ...form, brand: event.target.value })}
                required
              />
            </Field>
            <Field label="Modèle">
              <input
                className="input"
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
                required
              />
            </Field>
            <Field label="Places assises">
              <input
                type="number"
                min={0}
                className="input"
                value={form.seat_capacity}
                onChange={(event) => setForm({ ...form, seat_capacity: Number(event.target.value) })}
              />
            </Field>
            <Field label="Capacité de fret (kg)">
              <input
                type="number"
                min={0}
                className="input"
                value={form.cargo_capacity_kg}
                onChange={(event) => setForm({ ...form, cargo_capacity_kg: Number(event.target.value) })}
              />
            </Field>
            <Field label="Année">
              <input
                type="number"
                className="input"
                value={form.year}
                onChange={(event) => setForm({ ...form, year: Number(event.target.value) })}
              />
            </Field>
            <Field label="Kilométrage">
              <input
                type="number"
                min={0}
                className="input"
                value={form.odometer_km}
                onChange={(event) => setForm({ ...form, odometer_km: Number(event.target.value) })}
              />
            </Field>
            <Field label="Statut">
              <select
                className="input"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as VehicleStatus })}
              >
                {Object.entries(LABELS.vehicleStatus).map(([value, label]) => (
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
