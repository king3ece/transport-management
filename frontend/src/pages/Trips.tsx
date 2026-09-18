import { useState } from 'react'

import { api } from '../api/client'
import type { Driver, Route, Trip, TripKind, TripStatus, Vehicle } from '../api/types'
import { Alert, Badge, EmptyRow, Field, Modal, PageHeader, Spinner, Table } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { LABELS, dateTime, toDateTimeInput } from '../lib/format'
import { useResource } from '../lib/useResource'

interface FormState {
  route_id: number | ''
  vehicle_id: number | ''
  driver_id: number | ''
  kind: TripKind
  departure_at: string
  notes: string
}

const EMPTY: FormState = {
  route_id: '',
  vehicle_id: '',
  driver_id: '',
  kind: 'passenger',
  departure_at: '',
  notes: '',
}

export default function Trips() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin', 'dispatcher')
  const [statusFilter, setStatusFilter] = useState<'' | TripStatus>('')
  const { data, error, loading, reload } = useResource<Trip[]>('/api/trips', { status: statusFilter })
  const { data: routes } = useResource<Route[]>('/api/routes', { active_only: true })
  const { data: vehicles } = useResource<Vehicle[]>('/api/vehicles')
  const { data: drivers } = useResource<Driver[]>('/api/drivers')
  const [editing, setEditing] = useState<Trip | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormError(null)
    setOpen(true)
  }

  const openEdit = (trip: Trip) => {
    setEditing(trip)
    setForm({
      route_id: trip.route_id,
      vehicle_id: trip.vehicle_id,
      driver_id: trip.driver_id,
      kind: trip.kind,
      departure_at: toDateTimeInput(trip.departure_at),
      notes: trip.notes ?? '',
    })
    setFormError(null)
    setOpen(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const payload = {
      route_id: Number(form.route_id),
      vehicle_id: Number(form.vehicle_id),
      driver_id: Number(form.driver_id),
      kind: form.kind,
      departure_at: new Date(form.departure_at).toISOString(),
      notes: form.notes || null,
    }
    try {
      if (editing) await api.patch(`/api/trips/${editing.id}`, payload)
      else await api.post('/api/trips', payload)
      setOpen(false)
      reload()
    } catch (cause) {
      setFormError((cause as Error).message)
    }
  }

  const changeStatus = async (trip: Trip, status: TripStatus) => {
    try {
      await api.patch(`/api/trips/${trip.id}`, { status })
      reload()
    } catch (cause) {
      alert((cause as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Voyages"
        subtitle="Planification des départs, affectation véhicule et chauffeur"
        actions={
          canEdit && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              Planifier un voyage
            </button>
          )
        }
      />

      <select
        className="input mb-4 max-w-48"
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value as '' | TripStatus)}
      >
        <option value="">Tous les statuts</option>
        {Object.entries(LABELS.tripStatus).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {error && <Alert message={error} />}
      {loading ? (
        <Spinner />
      ) : (
        <Table
          headers={['Référence', 'Ligne', 'Départ', 'Type', 'Véhicule', 'Chauffeur', 'Places', 'Fret', 'Statut', '']}
        >
          {(data ?? []).length === 0 ? (
            <EmptyRow colSpan={10} message="Aucun voyage." />
          ) : (
            (data ?? []).map((trip) => (
              <tr key={trip.id}>
                <td className="px-4 py-3 font-mono text-xs">{trip.reference}</td>
                <td className="px-4 py-3">
                  {trip.route ? `${trip.route.origin} → ${trip.route.destination}` : '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{dateTime(trip.departure_at)}</td>
                <td className="px-4 py-3">{LABELS.tripKind[trip.kind]}</td>
                <td className="px-4 py-3 font-mono text-xs">{trip.vehicle?.registration ?? '—'}</td>
                <td className="px-4 py-3">{trip.driver?.full_name ?? '—'}</td>
                <td className="px-4 py-3">
                  {trip.seats_taken}/{trip.vehicle?.seat_capacity ?? 0}
                </td>
                <td className="px-4 py-3">
                  {trip.cargo_loaded_kg}/{trip.vehicle?.cargo_capacity_kg ?? 0} kg
                </td>
                <td className="px-4 py-3">
                  <Badge value={trip.status} label={LABELS.tripStatus[trip.status]} />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {canEdit && (
                    <span className="flex justify-end gap-2">
                      {trip.status === 'scheduled' && (
                        <button type="button" className="btn-ghost" onClick={() => changeStatus(trip, 'in_progress')}>
                          Démarrer
                        </button>
                      )}
                      {trip.status === 'in_progress' && (
                        <button type="button" className="btn-ghost" onClick={() => changeStatus(trip, 'completed')}>
                          Terminer
                        </button>
                      )}
                      {(trip.status === 'scheduled' || trip.status === 'in_progress') && (
                        <button type="button" className="btn-danger" onClick={() => changeStatus(trip, 'cancelled')}>
                          Annuler
                        </button>
                      )}
                      <button type="button" className="btn-ghost" onClick={() => openEdit(trip)}>
                        Modifier
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
        title={editing ? `Modifier ${editing.reference}` : 'Planifier un voyage'}
        open={open}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit} className="space-y-4">
          {formError && <Alert message={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ligne">
              <select
                className="input"
                value={form.route_id}
                onChange={(event) => setForm({ ...form, route_id: Number(event.target.value) })}
                required
              >
                <option value="">Sélectionner…</option>
                {(routes ?? []).map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.code} · {route.origin} → {route.destination}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type de voyage">
              <select
                className="input"
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value as TripKind })}
              >
                {Object.entries(LABELS.tripKind).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Véhicule" hint="Seuls les véhicules en service sont acceptés">
              <select
                className="input"
                value={form.vehicle_id}
                onChange={(event) => setForm({ ...form, vehicle_id: Number(event.target.value) })}
                required
              >
                <option value="">Sélectionner…</option>
                {(vehicles ?? []).map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration} · {vehicle.seat_capacity} pl · {vehicle.cargo_capacity_kg} kg
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Chauffeur">
              <select
                className="input"
                value={form.driver_id}
                onChange={(event) => setForm({ ...form, driver_id: Number(event.target.value) })}
                required
              >
                <option value="">Sélectionner…</option>
                {(drivers ?? []).map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.full_name} · {LABELS.driverStatus[driver.status]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Départ">
              <input
                type="datetime-local"
                className="input"
                value={form.departure_at}
                onChange={(event) => setForm({ ...form, departure_at: event.target.value })}
                required
              />
            </Field>
            <Field label="Notes">
              <input
                className="input"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
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
