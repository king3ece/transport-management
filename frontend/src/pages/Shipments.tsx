import { useState } from 'react'

import { api } from '../api/client'
import type { Customer, Shipment, ShipmentStatus, Trip } from '../api/types'
import { Alert, Badge, EmptyRow, Field, Modal, PageHeader, Spinner, Table } from '../components/ui'
import { LABELS, currency, dateTime } from '../lib/format'
import { useResource } from '../lib/useResource'

interface FormState {
  sender_id: number | ''
  recipient_name: string
  recipient_phone: string
  origin: string
  destination: string
  description: string
  weight_kg: number
  declared_value: number
  trip_id: number | ''
  payment_status: 'unpaid' | 'paid'
}

const EMPTY: FormState = {
  sender_id: '',
  recipient_name: '',
  recipient_phone: '',
  origin: '',
  destination: '',
  description: '',
  weight_kg: 1,
  declared_value: 0,
  trip_id: '',
  payment_status: 'unpaid',
}

const NEXT_STATUS: Record<ShipmentStatus, ShipmentStatus | null> = {
  registered: 'in_transit',
  in_transit: 'arrived',
  arrived: 'delivered',
  delivered: null,
  cancelled: null,
}

export default function Shipments() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | ShipmentStatus>('')
  const { data, error, loading, reload } = useResource<Shipment[]>('/api/shipments', {
    search,
    status: statusFilter,
  })
  const { data: customers } = useResource<Customer[]>('/api/customers')
  const { data: trips } = useResource<Trip[]>('/api/trips', { status: 'scheduled' })
  const [form, setForm] = useState<FormState>(EMPTY)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Shipment | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    try {
      await api.post('/api/shipments', {
        ...form,
        sender_id: Number(form.sender_id),
        trip_id: form.trip_id === '' ? null : Number(form.trip_id),
      })
      setOpen(false)
      setForm(EMPTY)
      reload()
    } catch (cause) {
      setFormError((cause as Error).message)
    }
  }

  const advance = async (shipment: Shipment) => {
    const next = NEXT_STATUS[shipment.status]
    if (!next) return
    try {
      await api.post(`/api/shipments/${shipment.id}/events`, {
        status: next,
        location: next === 'in_transit' ? shipment.origin : shipment.destination,
        note: `Statut mis à jour : ${LABELS.shipmentStatus[next]}`,
      })
      reload()
    } catch (cause) {
      alert((cause as Error).message)
    }
  }

  const markPaid = async (shipment: Shipment) => {
    try {
      await api.patch(`/api/shipments/${shipment.id}`, { payment_status: 'paid' })
      reload()
    } catch (cause) {
      alert((cause as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Colis &amp; fret"
        subtitle="Enregistrement, affectation à un voyage et suivi"
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
            Nouveau colis
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Rechercher (suivi, destinataire, ville)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="input max-w-48"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as '' | ShipmentStatus)}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS.shipmentStatus).map(([value, label]) => (
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
          headers={['Suivi', 'Expéditeur', 'Destinataire', 'Trajet', 'Poids', 'Montant', 'Statut', 'Paiement', '']}
        >
          {(data ?? []).length === 0 ? (
            <EmptyRow colSpan={9} message="Aucun colis." />
          ) : (
            (data ?? []).map((shipment) => (
              <tr key={shipment.id}>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="font-mono text-xs text-brand-600 hover:underline"
                    onClick={() => setDetail(shipment)}
                  >
                    {shipment.tracking_number}
                  </button>
                </td>
                <td className="px-4 py-3">{shipment.sender?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{shipment.recipient_name}</p>
                  <p className="text-xs text-slate-500">{shipment.recipient_phone}</p>
                </td>
                <td className="px-4 py-3">
                  {shipment.origin} → {shipment.destination}
                </td>
                <td className="px-4 py-3">{shipment.weight_kg} kg</td>
                <td className="px-4 py-3">{currency(shipment.price)}</td>
                <td className="px-4 py-3">
                  <Badge value={shipment.status} label={LABELS.shipmentStatus[shipment.status]} />
                </td>
                <td className="px-4 py-3">
                  <Badge
                    value={shipment.payment_status}
                    label={LABELS.paymentStatus[shipment.payment_status]}
                  />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <span className="flex justify-end gap-2">
                    {shipment.payment_status === 'unpaid' && (
                      <button type="button" className="btn-ghost" onClick={() => markPaid(shipment)}>
                        Encaisser
                      </button>
                    )}
                    {NEXT_STATUS[shipment.status] && (
                      <button type="button" className="btn-ghost" onClick={() => advance(shipment)}>
                        {LABELS.shipmentStatus[NEXT_STATUS[shipment.status]!]}
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))
          )}
        </Table>
      )}

      <Modal title="Nouveau colis" open={open} onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          {formError && <Alert message={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expéditeur">
              <select
                className="input"
                value={form.sender_id}
                onChange={(event) => setForm({ ...form, sender_id: Number(event.target.value) })}
                required
              >
                <option value="">Sélectionner…</option>
                {(customers ?? []).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Voyage (optionnel)" hint="La capacité de fret est contrôlée">
              <select
                className="input"
                value={form.trip_id}
                onChange={(event) =>
                  setForm({
                    ...form,
                    trip_id: event.target.value === '' ? '' : Number(event.target.value),
                  })
                }
              >
                <option value="">Non affecté</option>
                {(trips ?? []).map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.reference} · {trip.route?.origin} → {trip.route?.destination} ·{' '}
                    {dateTime(trip.departure_at)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Destinataire">
              <input
                className="input"
                value={form.recipient_name}
                onChange={(event) => setForm({ ...form, recipient_name: event.target.value })}
                required
              />
            </Field>
            <Field label="Téléphone destinataire">
              <input
                className="input"
                value={form.recipient_phone}
                onChange={(event) => setForm({ ...form, recipient_phone: event.target.value })}
              />
            </Field>
            <Field label="Origine">
              <input
                className="input"
                value={form.origin}
                onChange={(event) => setForm({ ...form, origin: event.target.value })}
                required
              />
            </Field>
            <Field label="Destination">
              <input
                className="input"
                value={form.destination}
                onChange={(event) => setForm({ ...form, destination: event.target.value })}
                required
              />
            </Field>
            <Field label="Poids (kg)" hint="Le tarif est calculé selon la ligne correspondante">
              <input
                type="number"
                min={0.1}
                step={0.1}
                className="input"
                value={form.weight_kg}
                onChange={(event) => setForm({ ...form, weight_kg: Number(event.target.value) })}
                required
              />
            </Field>
            <Field label="Valeur déclarée (FCFA)">
              <input
                type="number"
                min={0}
                className="input"
                value={form.declared_value}
                onChange={(event) => setForm({ ...form, declared_value: Number(event.target.value) })}
              />
            </Field>
            <Field label="Paiement">
              <select
                className="input"
                value={form.payment_status}
                onChange={(event) =>
                  setForm({ ...form, payment_status: event.target.value as 'unpaid' | 'paid' })
                }
              >
                <option value="unpaid">Impayé</option>
                <option value="paid">Payé</option>
              </select>
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

      <Modal
        title={detail ? `Colis ${detail.tracking_number}` : ''}
        open={detail !== null}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-600">
              {detail.origin} → {detail.destination} · {detail.weight_kg} kg · {currency(detail.price)}
            </p>
            {detail.description && <p className="text-slate-600">{detail.description}</p>}
            <ol className="space-y-3 border-l border-slate-200 pl-4">
              {detail.events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
                  <p className="font-medium text-slate-800">{LABELS.shipmentStatus[event.status]}</p>
                  <p className="text-slate-500">
                    {dateTime(event.occurred_at)} · {event.location || '—'}
                  </p>
                  {event.note && <p className="text-slate-500">{event.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Modal>
    </div>
  )
}
