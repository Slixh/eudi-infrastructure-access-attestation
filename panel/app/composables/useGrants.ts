import type { Grant, CreateGrantDto } from '~/types/grant'

export const useGrants = () => {
  const config = useRuntimeConfig()

  const { data: grants, refresh } = useFetch<Grant[]>('/grants', {
    baseURL: config.public.apiBase,
  })

  const createGrant = async (dto: CreateGrantDto): Promise<Grant> => {
    const body: Record<string, unknown> = {
      label:             dto.label,
      resourceEntityIds: dto.resourceEntityIds,
    }
    if (dto.pidFirstName?.trim())  body.pidFirstName  = dto.pidFirstName.trim()
    if (dto.pidFamilyName?.trim()) body.pidFamilyName = dto.pidFamilyName.trim()
    if (dto.pidBirthdate?.trim())  body.pidBirthdate  = dto.pidBirthdate.trim()

    return $fetch<Grant>('/grants', {
      baseURL: config.public.apiBase,
      method:  'POST',
      body,
    })
  }

  const revokeGrant = (id: string): Promise<Grant> =>
    $fetch<Grant>(`/grants/${id}/revoke`, { baseURL: config.public.apiBase, method: 'DELETE' })

  return { grants, refresh, createGrant, revokeGrant }
}
