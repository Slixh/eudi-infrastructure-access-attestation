import type { GrantInviteData } from '~/types/grant'

export const useGrantInvite = (id: string) => {
  const config = useRuntimeConfig()

  return useFetch<GrantInviteData>(`/grants/${id}/invite`, {
    baseURL: config.public.apiBase,
  })
}
