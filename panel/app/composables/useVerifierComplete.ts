export const useVerifierComplete = (state: string) => {
  const config = useRuntimeConfig()

  return useFetch<{ offerUri: string }>('/verifier/complete', {
    baseURL: config.public.apiBase,
    query:   { state },
  })
}
