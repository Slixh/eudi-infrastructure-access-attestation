import type { Grant, CreateGrantDto } from '~/types/grant'

export const useGrants = () => {
  const config = useRuntimeConfig()

  const { data: grants, refresh } = useFetch<Grant[]>('/grants', {
    baseURL: config.public.apiBase,
  })

  const createGrant = async (dto: CreateGrantDto): Promise<Grant> => {
    // Strip empty optional fields before sending
    const body: Record<string, string> = {
      label:      dto.label,
      resourceId: dto.resourceId,
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

  return { grants, refresh, createGrant }
}
