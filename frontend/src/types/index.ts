// =============================================================================
// Роли и статусы
// =============================================================================

export type Role = 'guest' | 'client' | 'technician' | 'manager' | 'admin'
export type OrderStatus = 'new' | 'confirmed' | 'in_progress' | 'review' | 'completed' | 'cancelled' | 'archived'
export type Priority = 'normal' | 'urgent' | 'critical'
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type MaterialRequestStatus = 'pending' | 'approved' | 'rejected' | 'issued'

// =============================================================================
// Пользователи
// =============================================================================

export interface User {
  id: string
  email: string
  role: Role
  first_name?: string
  last_name?: string
  phone?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
  loyalty_points?: number
}

export interface Client {
  id: number
  user_id: string
  user?: User
  clinic_name?: string
  address?: string
  discount_percent: number
  loyalty_tier: LoyaltyTier
  total_orders: number
}

export interface Technician {
  id: number
  user_id: string
  user?: User
  first_name?: string  // Для API техников
  last_name?: string   // Для API техников
  specialization?: string
  experience_years: number
  rating: number
  completed_orders: number
  portfolio_description?: string
  is_available: boolean
}

// =============================================================================
// Услуги и категории
// =============================================================================

export interface ServiceCategory {
  id: number
  name: string
  description?: string
  icon_url?: string
  sort_order?: number
  is_active?: boolean
}

export interface Service {
  id: number
  category_id: number
  category?: ServiceCategory
  name: string
  description?: string
  base_price: number
  unit: string
  duration_days: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// =============================================================================
// Заказы
// =============================================================================

export interface OrderItem {
  id: number
  order_id?: string
  service_id: number
  service?: Service
  quantity: number
  unit_price: number
  total_price: number
  specifications?: Record<string, string>
}

export interface OrderFile {
  id: number
  order_id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  created_at: string
  uploaded_by?: string
}

export interface StatusHistory {
  id: number
  order_id: string
  old_status: OrderStatus
  new_status: OrderStatus
  comment?: string
  changed_by: string
  changed_by_user?: User
  created_at: string
}

export interface Order {
  id: string
  order_number: string
  client_id: number
  client?: Client
  technician_id?: number
  technician?: Technician
  manager_id?: string
  manager?: User
  status: OrderStatus
  priority: Priority
  total_price: number
  discount_amount: number
  final_price: number
  notes?: string
  deadline?: string
  items?: OrderItem[]
  files?: OrderFile[]
  status_history?: StatusHistory[]
  created_at: string
  updated_at: string
  completed_at?: string
}

// =============================================================================
// Материалы
// =============================================================================

export interface Material {
  id: number
  name: string
  description?: string
  unit: string
  quantity: number
  min_quantity: number
  price_per_unit: number
  supplier?: string
  created_at: string
  updated_at: string
}

export interface MaterialRequest {
  id: number
  technician_id: number
  technician?: Technician
  material_id: number
  material?: Material
  quantity_requested: number
  status: MaterialRequestStatus
  comment?: string
  created_at: string
  resolved_by?: string
  resolved_at?: string
}

// =============================================================================
// Отзывы, статьи, акции
// =============================================================================

export interface Review {
  id: number
  client_id: number
  client_name?: string
  order_id?: string
  order_number?: string
  rating: number
  text?: string
  is_moderated: boolean
  is_published: boolean
  created_at: string
}

export interface Article {
  id: number
  title: string
  slug: string
  content: string
  category?: string
  author_id: string
  author_name?: string
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface Promotion {
  id: number
  title: string
  description?: string
  discount_percent: number
  start_date: string
  end_date: string
  is_active: boolean
  applies_to: 'all' | 'service' | 'category'
  target_id?: number
}

// =============================================================================
// База знаний
// =============================================================================

export interface KnowledgeBase {
  id: number
  title: string
  content: string
  category?: string
  tags?: string[]
  created_by: string
  author_name?: string
  is_published: boolean
  created_at: string
  updated_at: string
}

// =============================================================================
// Аналитика
// =============================================================================

export interface OrderAnalytics {
  total: number
  by_status: Record<string, number>
  by_priority: Record<string, number>
  avg_completion_days?: number
}

export interface RevenueByPeriod {
  date: string
  amount: number
}

export interface RevenueByCategory {
  category_id: number
  category_name: string
  total: number
}

export interface RevenueAnalytics {
  total: number
  by_period: RevenueByPeriod[]
  by_service_category: RevenueByCategory[]
}

export interface TechnicianAnalyticsItem {
  technician_id: number
  technician_name: string
  completed: number
  avg_days?: number
  rating: number
  on_time_percent: number
}

export interface TechnicianAnalytics {
  items: TechnicianAnalyticsItem[]
  total: number
}

// =============================================================================
// Администрирование
// =============================================================================

export interface ActionLog {
  id: number
  user_id?: string
  user_email?: string
  action_type: string
  entity_type: string
  entity_id?: string
  description?: string
  ip_address?: string
  created_at: string
}

export interface BackupInfo {
  filename: string
  size: number
  created_at: string
}

// =============================================================================
// Общие интерфейсы
// =============================================================================

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  first_name: string
  last_name: string
  phone?: string
}

