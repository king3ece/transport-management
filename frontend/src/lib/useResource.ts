import { useCallback, useEffect, useState } from 'react'

import { api } from '../api/client'

type Query = Record<string, string | number | boolean | undefined | null>

export function useResource<T>(path: string, query?: Query) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const serializedQuery = JSON.stringify(query ?? {})

  const reload = useCallback(() => {
    setLoading(true)
    api
      .get<T>(path, JSON.parse(serializedQuery) as Query)
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [path, serializedQuery])

  useEffect(reload, [reload])

  return { data, error, loading, reload, setError }
}
