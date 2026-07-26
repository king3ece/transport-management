import { useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../api/client'
import type { Shipment } from '../api/types'
import { Alert, Badge, Field } from '../components/ui'
import { LABELS, currency, dateTime } from '../lib/format'

export default function Tracking() {
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setShipment(null)
    try {
      setShipment(await api.get<Shipment>(`/api/shipments/track/${trackingNumber.trim().toUpperCase()}`))
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Suivi de colis</h1>
      <p className="mt-1 text-sm text-slate-500">
        Saisissez le numéro de suivi figurant sur votre bordereau (ex. CLS-3001).
      </p>

      <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
        {error && <Alert message={error} />}
        <Field label="Numéro de suivi">
          <input
            className="input"
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
            placeholder="CLS-XXXXXX"
            required
          />
        </Field>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Recherche…' : 'Suivre'}
        </button>
      </form>

      {shipment && (
        <div className="card mt-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-sm text-slate-500">{shipment.tracking_number}</p>
              <p className="text-lg font-semibold text-slate-900">
                {shipment.origin} → {shipment.destination}
              </p>
            </div>
            <Badge value={shipment.status} label={LABELS.shipmentStatus[shipment.status]} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Destinataire</dt>
              <dd className="font-medium">{shipment.recipient_name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Poids</dt>
              <dd className="font-medium">{shipment.weight_kg} kg</dd>
            </div>
            <div>
              <dt className="text-slate-500">Montant</dt>
              <dd className="font-medium">{currency(shipment.price)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Paiement</dt>
              <dd>
                <Badge value={shipment.payment_status} label={LABELS.paymentStatus[shipment.payment_status]} />
              </dd>
            </div>
          </dl>

          <h2 className="mt-6 mb-2 text-sm font-semibold text-slate-700">Historique</h2>
          <ol className="space-y-3 border-l border-slate-200 pl-4">
            {shipment.events.map((event) => (
              <li key={event.id} className="relative text-sm">
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

      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-brand-600 hover:underline">
          Accès personnel de l&apos;entreprise
        </Link>
      </p>
    </div>
  )
}
