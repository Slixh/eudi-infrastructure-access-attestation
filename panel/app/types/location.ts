export interface Location {
  id:         string
  name:       string
  street:     string
  postalCode: string
  city:       string
  country:    string
  notes:      string | null
  createdAt:  string
  updatedAt:  string
  resources?: Resource[]
  _count?:    { resources: number }
}

export interface Resource {
  id:          string
  name:        string
  identifier:  string
  description: string | null
  locationId:  string
  location?:   Location
  createdAt:   string
  _count?:     { grants: number }
}

export interface CreateLocationDto {
  name:       string
  street:     string
  postalCode: string
  city:       string
  country?:   string
  notes?:     string
}

export interface UpdateLocationDto extends Partial<CreateLocationDto> {}

export interface CreateResourceDto {
  name:        string
  identifier:  string
  description?: string
  locationId:  string
}
