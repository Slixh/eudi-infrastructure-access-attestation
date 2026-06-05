export interface Grant {
  id: string
  label: string
  resourceId: string
  status: 'PENDING' | 'ACTIVE' | 'REVOKED'
  createdAt: string
  pidFirstName:  string | null
  pidFamilyName: string | null
  pidBirthdate:  string | null
}

export interface GrantInviteData {
  grant: Grant
  token: string
  deepLink: string
}

export interface CreateGrantDto {
  label:             string
  resourceEntityIds: string[]
  pidFirstName?:     string
  pidFamilyName?:    string
  pidBirthdate?:     string
}
