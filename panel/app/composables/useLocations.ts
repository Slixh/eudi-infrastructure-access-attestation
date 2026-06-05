import type { Location, CreateLocationDto, UpdateLocationDto } from '~/types/location'

export const useLocations = () => {
  const config = useRuntimeConfig()

  const { data: locations, refresh } = useFetch<Location[]>('/locations', {
    baseURL: config.public.apiBase,
  })

  const createLocation = (dto: CreateLocationDto): Promise<Location> =>
    $fetch('/locations', { baseURL: config.public.apiBase, method: 'POST', body: dto })

  const updateLocation = (id: string, dto: UpdateLocationDto): Promise<Location> =>
    $fetch(`/locations/${id}`, { baseURL: config.public.apiBase, method: 'PATCH', body: dto })

  const deleteLocation = (id: string): Promise<void> =>
    $fetch(`/locations/${id}`, { baseURL: config.public.apiBase, method: 'DELETE' })

  return { locations, refresh, createLocation, updateLocation, deleteLocation }
}
