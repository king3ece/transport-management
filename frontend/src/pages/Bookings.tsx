import { useEffect, useState } from 'react'

import { api } from '../api/client'
import type { Booking, BookingStatus, Customer, PaymentStatus, Trip } from '../api/types'
import { Alert, Badge, EmptyRow, Field, Modal, PageHeader, Spinner, Table } from '../components/ui'
import { LABELS, currency, dateTime } from '../lib/format'
import { useResource } from '../lib/useResource'

interface FormState {
  trip_id: number | ''
  passenger_name: string
  passenger_phone: string
  customer_id: number | ''
  seat_number: number | ''
  payment_status: PaymentStatus
}

const EMPTY: FormState = {
  trip_id: '',
  passenger_name: '',
  passenger_phone: '',
  customer_id: '',
  seat_number: '',
  payment_status: 'unpaid',
}

export default function Bookings() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | BookingStatus>('')
  const { data, error, loading, reload } = useResource<Booking[]>('/api/bookings', {
    search,
    status: statusFilter,
  })
  const { data: trips } = useResource<Trip[]>('/api/trips', { status: 'scheduled' })
  const { data: customers } = useResource<Customer[]>('/api/customers')
  const [form, setForm] = useState<FormState>(EMPTY)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [takenSeats, setTakenSeats] = useState<number[]>([])

  const selectedTrip = (trips ?? []).find((trip) => trip.id === Number(form.trip_id))

  useEffect(() => {
    if (!form.trip_id) {
      setTakenSeats([])
      return
    }
    api
      .get<number[]>(`/api/bookings/trips/${form.trip_id}/seats`)
      .then(setTakenSeats)
      .catch(() => setTakenSeats([]))
  }, [form.trip_id])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    try {
      await api.post('/api/bookings', {
        trip_id: Number(form.trip_id),
        passenger_name: form.passenger_name,
        passenger_phone: form.passenger_phone,
        customer_id: form.customer_id === '' ? null : Number(form.customer_id),
        seat_number: form.seat_number === '' ? null : Number(form.seat_number),
        payment_status: form.payment_status,
      })
      setOpen(false)
      setForm(EMPTY)
      reload()
    } catch (cause) {
      setFormError((cause as Error).message)
    }
  }

  const patch = async (booking: Booking, body: Partial<Booking>) => {
    try {
      await api.patch(`/api/bookings/${booking.id}`, body)
      reload()
    } catch (cause) {
      alert((cause as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Réservations"
        subtitle="Billetterie voyageurs, sièges et encaissements"
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
            Nouvelle réservation
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Rechercher (passager, référence)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="input max-w-48"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as '' | BookingStatus)}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS.bookingStatus).map(([value, label]) => (
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
        <Table
          headers={['Référence', 'Passager', 'Voyage', 'Départ', 'Siège', 'Montant', 'Statut', 'Paiement', '']}
        >
          {(data ?? []).length === 0 ? (
            <EmptyRow colSpan={9} message="Aucune réservation." />
          ) : (
            (data ?? []).map((booking) => (
              <tr key={booking.id}>
                <td className="px-4 py-3 font-mono text-xs">{booking.reference}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{booking.passenger_name}</p>
                  <p className="text-xs text-slate-500">{booking.passenger_phone}</p>
                </td>
                <td className="px-4 py-3">
                  {booking.trip?.route
                    ? `${booking.trip.route.origin} → ${booking.trip.route.destination}`
                    : '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {booking.trip ? dateTime(booking.trip.departure_at) : '—'}
                </td>
                <td className="px-4 py-3">{booking.seat_number}</td>
                <td className="px-4 py-3">{currency(booking.price)}</td>
                <td className="px-4 py-3">
                  <Badge value={booking.status} label={LABELS.bookingStatus[booking.status]} />
                </td>
                <td className="px-4 py-3">
                  <Badge
                    value={booking.payment_status}
                    label={LABELS.paymentStatus[booking.payment_status]}
                  />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <span className="flex justify-end gap-2">
                    {booking.payment_status === 'unpaid' && booking.status !== 'cancelled' && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => patch(booking, { payment_status: 'paid' })}
                      >
                        Encaisser
                      </button>
                    )}
                    {booking.status === 'confirmed' && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => patch(booking, { status: 'boarded' })}
                      >
                        Embarquer
                      </button>
                    )}
                    {booking.status !== 'cancelled' && (
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => patch(booking, { status: 'cancelled' })}
                      >
                        Annuler
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))
          )}
        </Table>
      )}

      <Modal title="Nouvelle réservation" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          {formError && <Alert message={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Voyage">
              <select
                className="input"
                value={form.trip_id}
                onChange={(event) => setForm({ ...form, trip_id: Number(event.target.value), seat_number: '' })}
                required
              >
                <option value="">Sélectionner…</option>
                {(trips ?? [])
                  .filter((trip) => trip.kind !== 'freight')
                  .map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.reference} · {trip.route?.origin} → {trip.route?.destination} ·{' '}
                      {dateTime(trip.departure_at)} ({trip.seats_available} places)
                    </option>
                  ))}
              </select>
            </Field>
            <Field
              label="Siège"
              hint={
                selectedTrip
                  ? `Sièges pris : ${takenSeats.join(', ') || 'aucun'} — laisser vide pour attribution automatique`
                  : undefined
              }
            >
              <input
                type="number"
                min={1}
                max={selectedTrip?.vehicle?.seat_capacity ?? undefined}
                className="input"
                value={form.seat_number}
                onChange={(event) =>
                  setForm({
                    ...form,
                    seat_number: event.target.value === '' ? '' : Number(event.target.value),
                  })
                }
              />
            </Field>
            <Field label="Nom du passager">
              <input
                className="input"
                value={form.passenger_name}
                onChange={(event) => setForm({ ...form, passenger_name: event.target.value })}
                required
              />
            </Field>
            <Field label="Téléphone">
              <input
                className="input"
                value={form.passenger_phone}
                onChange={(event) => setForm({ ...form, passenger_phone: event.target.value })}
              />
            </Field>
            <Field label="Client rattaché (optionnel)">
              <select
                className="input"
                value={form.customer_id}
                onChange={(event) =>
                  setForm({
                    ...form,
                    customer_id: event.target.value === '' ? '' : Number(event.target.value),
                  })
                }
              >
                <option value="">Aucun</option>
                {(customers ?? []).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Paiement">
              <select
                className="input"
                value={form.payment_status}
                onChange={(event) =>
                  setForm({ ...form, payment_status: event.target.value as PaymentStatus })
                }
              >
                <option value="unpaid">Impayé</option>
                <option value="paid">Payé</option>
              </select>
            </Field>
          </div>
          {selectedTrip?.route && (
            <p className="text-sm text-slate-500">
              Tarif appliqué : <strong>{currency(selectedTrip.route.passenger_price)}</strong>
            </p>
          )}
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
