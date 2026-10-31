export interface Thumbs {
  large: string
  original: string
  small: string
}

export interface WallpaperData {
  id: string
  url: string
  short_url: string
  uploader?: {
    username: string
    group: string
    avatar: {
      '200px': string
      '128px': string
      '32px': string
      '20px': string
    }
  }
  views: number
  favorites: number
  source: string
  purity: string
  category: string
  dimension_x: number
  dimension_y: number
  resolution: string
  ratio: string
  file_size: number
  file_type: string
  created_at: string
  colors: string[]
  path: string
  thumbs: Thumbs
  tags?: Array<{
    id: number
    name: string
    alias: string
    category_id: number
    category: string
    purity: string
    created_at: string
  }>
}

export interface SearchMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  query?: string | null
  seed?: string | null
}

export interface SearchResponse {
  data: WallpaperData[]
  meta: SearchMeta
}

export interface SearchParams {
  categories?: string
  purity?: string
  sorting?: string
  page?: number
  order?: string
  ratios?: string
  atleast?: string
  resolutions?: string
  colors?: string
  q?: string
}

export interface DownloadItem {
  id: string
  url: string
  file_name: string
  resolution: string
  received_bytes: number
  total_bytes: number
  speed_bytes: number
  state: 'waiting' | 'downloading' | 'done' | 'error' | 'cancelled'
  file_path?: string
  thumbnail?: string
}
