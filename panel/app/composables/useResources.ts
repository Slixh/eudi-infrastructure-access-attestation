import type { Resource, CreateResourceDto } from '~/types/location'

export const useResources = () => {
  const config = useRuntimeConfig()

  const createResource = (dto: CreateResourceDto): Promise<Resource> =>
    $fetch('/resources', { baseURL: config.public.apiBase, method: 'POST', body: dto })

  const deleteResource = (id: string): Promise<void> =>
    $fetch(`/resources/${id}`, { baseURL: config.public.apiBase, method: 'DELETE' })

  return { createResource, deleteResource }
}
