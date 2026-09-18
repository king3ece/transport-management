export const currency = (value: number): string =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`

export const dateTime = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '—'

export const dateOnly = (value: string | null): string =>
  value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value)) : '—'

export const toDateTimeInput = (value: string): string => {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const LABELS = {
  role: {
    admin: 'Administrateur',
    dispatcher: 'Régulateur',
    driver: 'Chauffeur',
    client: 'Client',
  },
  vehicleKind: { bus: 'Autocar', minibus: 'Minibus', van: 'Fourgon', truck: 'Camion' },
  vehicleStatus: { active: 'En service', maintenance: 'En maintenance', out_of_service: 'Hors service' },
  driverStatus: { available: 'Disponible', on_trip: 'En voyage', off_duty: 'Hors service' },
  tripKind: { passenger: 'Voyageurs', freight: 'Fret', mixed: 'Mixte' },
  tripStatus: {
    scheduled: 'Planifié',
    in_progress: 'En cours',
    completed: 'Terminé',
    cancelled: 'Annulé',
  },
  bookingStatus: {
    pending: 'En attente',
    confirmed: 'Confirmée',
    boarded: 'Embarqué',
    cancelled: 'Annulée',
  },
  paymentStatus: { unpaid: 'Impayé', paid: 'Payé', refunded: 'Remboursé' },
  shipmentStatus: {
    registered: 'Enregistré',
    in_transit: 'En transit',
    arrived: 'Arrivé',
    delivered: 'Livré',
    cancelled: 'Annulé',
  },
  maintenanceKind: { preventive: 'Préventive', corrective: 'Corrective', inspection: 'Contrôle technique' },
  customerKind: { individual: 'Particulier', company: 'Entreprise' },
} as const

export const TONE: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate'> = {
  active: 'green',
  available: 'green',
  paid: 'green',
  completed: 'green',
  delivered: 'green',
  confirmed: 'green',
  in_progress: 'blue',
  on_trip: 'blue',
  in_transit: 'blue',
  boarded: 'blue',
  scheduled: 'slate',
  registered: 'slate',
  pending: 'amber',
  unpaid: 'amber',
  maintenance: 'amber',
  arrived: 'amber',
  refunded: 'amber',
  off_duty: 'red',
  out_of_service: 'red',
  cancelled: 'red',
}
