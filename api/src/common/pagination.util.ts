import type { PaginationDto } from './dto/pagination.dto'

export interface PaginatedResult<T> {
  data: T[]
  meta: {
    total:  number
    page:   number
    limit:  number
    pages:  number
  }
}

/**
 * Returns Prisma skip/take args when pagination params are present,
 * undefined otherwise (→ fetch all rows).
 */
export function buildPrismaPage(dto: PaginationDto): { skip?: number; take?: number } {
  if (dto.page == null && dto.limit == null) return {}
  const page  = dto.page  ?? 1
  const limit = dto.limit ?? 20
  return { skip: (page - 1) * limit, take: limit }
}

/**
 * Wraps an already-fetched page in the standard envelope.
 * Pass `total` from a separate prisma.model.count() call.
 */
export function paginate<T>(
  data:  T[],
  total: number,
  dto:   PaginationDto,
): PaginatedResult<T> {
  const page  = dto.page  ?? 1
  const limit = dto.limit ?? 20
  return {
    data,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  }
}

/**
 * True when the caller supplied at least one pagination param.
 */
export function isPaginated(dto: PaginationDto): boolean {
  return dto.page != null || dto.limit != null
}
