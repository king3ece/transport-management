import { Link } from 'react-router-dom'

import type { DashboardStats } from '../api/types'
import { Alert, Badge, EmptyRow, PageHeader, Spinner, Table } from '../components/ui'
import { LABELS, currency, dateOnly, dateTime } from '../lib/format'
import { useResource } from '../lib/useResource'

function StatCard({
  label,
  value,
  hint,
  accent = 'text-slate-900',
}: {
  label: string
  value: string
  hint?: string
  accent?: string
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

function RevenueChart({ stats }: { stats: DashboardStats }) {
  const max = Math.max(
    1,
    ...stats.revenue_trend.map((point) => point.passenger_revenue + point.freight_revenue),
  )
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Chiffre d&apos;affaires (6 mois)</h2>
        <div className="flex gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-brand-500" /> Voyageurs
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Fret
          </span>
        </div>
      </div>
      <div className="flex h-56 items-stretch gap-3">
        {stats.revenue_trend.map((point) => {
          const total = point.passenger_revenue + point.freight_revenue
          return (
            <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[10px] text-slate-400">{total > 0 ? currency(total) : ''}</span>
              <div className="flex w-full flex-1 flex-col justify-end overflow-hidden rounded-t-md bg-slate-100">
                <div
                  className="bg-amber-400"
                  style={{ height: `${(point.freight_revenue / max) * 100}%` }}
                  title={`Fret : ${currency(point.freight_revenue)}`}
                />
                <div
                  className="bg-brand-500"
                  style={{ height: `${(point.passenger_revenue / max) * 100}%` }}
                  title={`Voyageurs : ${currency(point.passenger_revenue)}`}
                />
              </div>
              <span className="text-xs text-slate-500">{point.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: stats, error, loading } = useResource<DashboardStats>('/api/dashboard/stats')

  if (loading) return <Spinner />
  if (error) return <Alert message={error} />
  if (!stats) return null

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue consolidée de l'exploitation voyageurs et fret"
        actions={
          <Link to="/trips" className="btn-primary">
            Planifier un voyage
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Recettes du mois"
          value={currency(stats.revenue_passenger_month + stats.revenue_freight_month)}
          hint={`Voyageurs ${currency(stats.revenue_passenger_month)} · Fret ${currency(stats.revenue_freight_month)}`}
        />
        <StatCard
          label="Impayés"
          value={currency(stats.unpaid_amount)}
          accent="text-amber-600"
          hint="Réservations et colis non réglés"
        />
        <StatCard
          label="Voyages aujourd'hui"
          value={String(stats.trips_today)}
          hint={`${stats.trips_in_progress} en cours`}
        />
        <StatCard
          label="Taux de remplissage"
          value={`${stats.fleet_occupancy_rate} %`}
          hint="Prochains départs planifiés"
        />
        <StatCard
          label="Flotte"
          value={`${stats.vehicles_active}/${stats.vehicles_total}`}
          hint={`${stats.vehicles_in_maintenance} en maintenance`}
        />
        <StatCard
          label="Chauffeurs disponibles"
          value={`${stats.drivers_available}/${stats.drivers_total}`}
        />
        <StatCard label="Réservations du jour" value={String(stats.bookings_today)} />
        <StatCard label="Colis en transit" value={String(stats.shipments_in_transit)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart stats={stats} />
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-slate-800">Permis à renouveler</h2>
          {stats.license_expiring_soon.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun permis n&apos;expire dans les 60 jours.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {stats.license_expiring_soon.map((driver) => (
                <li key={driver.id} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">{driver.full_name}</p>
                    <p className="text-xs text-slate-500">{driver.license_number}</p>
                  </div>
                  <span className="text-xs font-medium text-amber-600">
                    {dateOnly(driver.license_expiry)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h2 className="mt-8 mb-3 font-semibold text-slate-800">Prochains départs</h2>
      <Table headers={['Référence', 'Ligne', 'Départ', 'Véhicule', 'Chauffeur', 'Places', 'Fret', 'Statut']}>
        {stats.upcoming_trips.length === 0 ? (
          <EmptyRow colSpan={8} message="Aucun départ planifié." />
        ) : (
          stats.upcoming_trips.map((trip) => (
            <tr key={trip.id}>
              <td className="px-4 py-3 font-mono text-xs">{trip.reference}</td>
              <td className="px-4 py-3">
                {trip.route ? `${trip.route.origin} → ${trip.route.destination}` : '—'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{dateTime(trip.departure_at)}</td>
              <td className="px-4 py-3">{trip.vehicle?.registration ?? '—'}</td>
              <td className="px-4 py-3">{trip.driver?.full_name ?? '—'}</td>
              <td className="px-4 py-3">
                {trip.seats_taken}/{trip.vehicle?.seat_capacity ?? 0}
              </td>
              <td className="px-4 py-3">{trip.cargo_loaded_kg} kg</td>
              <td className="px-4 py-3">
                <Badge value={trip.status} label={LABELS.tripStatus[trip.status]} />
              </td>
            </tr>
          ))
        )}
      </Table>
    </div>
  )
}
