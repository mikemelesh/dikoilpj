import type { Role } from "@/types";

// =============================================================================
// Типы ресурсов и действий
// =============================================================================

export type Resource = 
  | 'orders'
  | 'clients'
  | 'technicians'
  | 'services'
  | 'promotions'
  | 'materials'
  | 'analytics'
  | 'knowledge_base'
  | 'reviews'
  | 'articles'
  | 'profile'
  | 'public';

export type Action = 'read' | 'create' | 'update' | 'delete' | '*' | 'own.*' | 'status' | 'request';

export type Permission = `${Resource}.${Action}`;

// =============================================================================
// Матрица разрешений (RBAC)
// =============================================================================

const permissions: Record<Role, Permission[] | '*'> = {
  // Полный доступ ко всему
  admin: '*',
  
  // Менеджер: управление заказами, клиентами, услугами, акциями
  manager: [
    'orders.*',
    'clients.*',
    'technicians.read',
    'services.*',
    'promotions.*',
    'materials.*',
    'analytics.*',
    'knowledge_base.*',
    'reviews.read',
    'articles.*',
  ],
  
  // Техник: просмотр заказов, обновление статуса, запрос материалов
  technician: [
    'orders.read',
    'orders.own.*',
    'orders.status',
    'materials.request',
    'knowledge_base.read',
    'profile.update',
    'profile.read',
  ],
  
  // Клиент: свои заказы, отзывы, профиль
  client: [
    'orders.own.*',
    'profile.update',
    'profile.read',
    'reviews.create',
    'reviews.read',
    'services.read',
    'promotions.read',
    'public.*',
  ],
  
  // Гость: только публичные ресурсы
  guest: [
    'public.*',
    'services.read',
    'promotions.read',
    'articles.read',
  ],
};

// =============================================================================
// Функции проверки прав
// =============================================================================

/**
 * Проверка, имеет ли роль доступ к ресурсу с действием
 */
export function canAccess(
  role: Role,
  resource: Resource,
  action: Action
): boolean {
  const rolePermissions = permissions[role];
  
  // Admin имеет полный доступ
  if (rolePermissions === '*') {
    return true;
  }
  
  // Формируем возможные паттерны разрешений
  const patternsToCheck: string[] = [
    `${resource}.${action}`,      // точное совпадение (orders.read)
    `${resource}.*`,              // все действия ресурса (orders.*)
    `${resource}.own.*`,          // свои ресурсы (orders.own.*)
  ];
  
  // Проверяем каждое разрешение
  for (const permission of rolePermissions) {
    // Если есть точное совпадение
    if (patternsToCheck.includes(permission)) {
      return true;
    }
    
    // Проверка на wildcard для всех действий
    if (permission === '*') {
      return true;
    }
  }
  
  return false;
}

/**
 * Проверка доступа к нескольким ресурсам/действиям
 */
export function canAccessAny(
  role: Role,
  checks: Array<{ resource: Resource; action: Action }>
): boolean {
  return checks.some(({ resource, action }) => canAccess(role, resource, action));
}

/**
 * Проверка доступа к ресурсу с любым действием
 */
export function canAccessResource(role: Role, resource: Resource): boolean {
  return canAccess(role, resource, 'read') || 
         canAccess(role, resource, '*') ||
         canAccess(role, resource, 'own.*');
}

/**
 * Проверка доступа к действию на всех ресурсах
 */
export function canPerformAction(role: Role, action: Action): boolean {
  const resources: Resource[] = [
    'orders', 'clients', 'technicians', 'services',
    'promotions', 'materials', 'analytics', 'knowledge_base',
    'reviews', 'articles', 'profile', 'public'
  ];
  
  return resources.some(resource => canAccess(role, resource, action));
}

/**
 * Получить все доступные ресурсы для роли
 */
export function getAccessibleResources(role: Role): Resource[] {
  const rolePermissions = permissions[role];
  
  if (rolePermissions === '*') {
    return [
      'orders', 'clients', 'technicians', 'services',
      'promotions', 'materials', 'analytics', 'knowledge_base',
      'reviews', 'articles', 'profile', 'public'
    ];
  }
  
  const resources = new Set<Resource>();
  
  for (const permission of rolePermissions) {
    const [resource] = permission.split('.') as [Resource];
    if (resource) {
      resources.add(resource);
    }
  }
  
  return Array.from(resources);
}

/**
 * Проверка, является ли роль администратором
 */
export function isAdmin(role: Role | null): boolean {
  return role === 'admin';
}

/**
 * Проверка, является ли роль менеджером или администратором
 */
export function isManagerOrAdmin(role: Role | null): boolean {
  return role === 'manager' || role === 'admin';
}

/**
 * Проверка, является ли роль техником или выше
 */
export function isTechnicianOrHigher(role: Role | null): boolean {
  return role === 'technician' || role === 'manager' || role === 'admin';
}

// Экспортируем матрицу для возможного использования в UI
export { permissions };
