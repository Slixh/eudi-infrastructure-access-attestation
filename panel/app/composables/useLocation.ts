import type { Location } from '~/types/location'

export const useLocation = (id: string) => {
  const config = useRuntimeConfig()
  return useFetch<Location>(`/locations/${id}`, {
    baseURL: config.public.apiBase,
  })
}
