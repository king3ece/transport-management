import { useState } from 'react'

import { api } from '../api/client'
import type { Route } from '../api/types'
import { Alert, Badge, EmptyRow, Field, Modal, PageHeader, Spinner, Table } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { currency } from '../lib/format'
import { useResource } from '../lib/useResource'

interface FormState {
  code: string
  origin: string
  destination: string
  distance_km: number
  duration_min: number
  passenger_price: number
  freight_price_per_kg: number
  is_active: boolean
}

const EMPTY: FormState = {
  code: '',
  origin: '',
  destination: '',
  distance_km: 0,
  duration_min: 0,
  passenger_price: 0,
  freight_price_per_kg: 0,
  is_active: true,
}

export default function RoutesPage() {
  const { hasRole } = useAuth()
  const canEdit = hasRole('admin', 'dispatcher')
  const [search, setSearch] = useState('')
  const { data, error, loading, reload } = useResource<Route[]>('/api/routes', { search })
  const [editing, setEditing] = useState<Route | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setFormError(null)
    setOpen(true)
  }

  const openEdit = (route: Route) => {
    setEditing(route)
    const { id: _id, ...rest } = route
    setForm(rest)
    setFormError(null)
    setOpen(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    try {
      if (editing) await api.patch(`/api/routes/${editing.id}`, form)
      else await api.post('/api/routes', form)
      setOpen(false)
      reload()
    } catch (cause) {
      setFormError((cause as Error).message)
    }
  }

  const remove = async (route: Route) => {
    if (!confirm(`Supprimer la ligne ${route.code} ?`)) return
    try {
      await api.delete(`/api/routes/${route.id}`)
      reload()
    } catch (cause) {
      alert((cause as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Lignes"
        subtitle="Trajets commerciaux, tarifs voyageurs et fret"
        actions={
          canEdit && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              Nouvelle ligne
            </button>
          )
        }
      />

      <input
        className="input mb-4 max-w-xs"
        placeholder="Rechercher (code, ville)"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {error && <Alert message={error} />}
      {loading ? (
        <Spinner />
      ) : (
        <Table
          headers={['Code', 'Trajet', 'Distance', 'Durée', 'Tarif voyageur', 'Tarif fret /kg', 'État', '']}
        >
          {(data ?? []).length === 0 ? (
            <EmptyRow colSpan={8} message="Aucune ligne." />
          ) : (
            (data ?? []).map((route) => (
              <tr key={route.id}>
                <td className="px-4 py-3 font-mono text-xs">{route.code}</td>
                <td className="px-4 py-3 font-medium">
                  {route.origin} → {route.destination}
                </td>
                <td className="px-4 py-3">{route.distance_km} km</td>
                <td className="px-4 py-3">
                  {Math.floor(route.duration_min / 60)} h {route.duration_min % 60} min
                </td>
                <td className="px-4 py-3">{currency(route.passenger_price)}</td>
                <td className="px-4 py-3">{currency(route.freight_price_per_kg)}</td>
                <td className="px-4 py-3">
                  <Badge
                    value={route.is_active ? 'active' : 'out_of_service'}
                    label={route.is_active ? 'Active' : 'Inactive'}
                  />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {canEdit && (
                    <span className="flex justify-end gap-2">
                      <button type="button" className="btn-ghost" onClick={() => openEdit(route)}>
                        Modifier
                      </button>
                      <button type="button" className="btn-danger" onClick={() => remove(route)}>
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
        title={editing ? `Modifier ${editing.code}` : 'Nouvelle ligne'}
        open={open}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit} className="space-y-4">
          {formError && <Alert message={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" hint="Ex. LOM-KAR">
              <input
                className="input"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                required
              />
            </Field>
            <Field label="Statut">
              <select
                className="input"
                value={form.is_active ? 'yes' : 'no'}
                onChange={(event) => setForm({ ...form, is_active: event.target.value === 'yes' })}
              >
                <option value="yes">Active</option>
                <option value="no">Inactive</option>
              </select>
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
            <Field label="Distance (km)">
              <input
                type="number"
                min={0}
                className="input"
                value={form.distance_km}
                onChange={(event) => setForm({ ...form, distance_km: Number(event.target.value) })}
              />
            </Field>
            <Field label="Durée (minutes)">
              <input
                type="number"
                min={0}
                className="input"
                value={form.duration_min}
                onChange={(event) => setForm({ ...form, duration_min: Number(event.target.value) })}
              />
            </Field>
            <Field label="Tarif voyageur (FCFA)">
              <input
                type="number"
                min={0}
                className="input"
                value={form.passenger_price}
                onChange={(event) => setForm({ ...form, passenger_price: Number(event.target.value) })}
              />
            </Field>
            <Field label="Tarif fret par kg (FCFA)">
              <input
                type="number"
                min={0}
                className="input"
                value={form.freight_price_per_kg}
                onChange={(event) =>
                  setForm({ ...form, freight_price_per_kg: Number(event.target.value) })
                }
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
