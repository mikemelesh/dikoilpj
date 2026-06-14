export const MAX_TECHNICIAN_LOAD = 4;

/** Text color class for technician name by today's active order count. */
export function getTechnicianLoadColorClass(load: number): string {
  if (load >= 4) return "text-red-600 font-semibold";
  if (load === 3) return "text-orange-500 font-semibold";
  if (load === 2) return "text-yellow-600 font-semibold";
  if (load === 1) return "text-green-600 font-semibold";
  return "";
}

export function canAssignTechnician(load: number): boolean {
  return load < MAX_TECHNICIAN_LOAD;
}

export function formatTechnicianLoadLabel(load: number): string {
  return `${load}/${MAX_TECHNICIAN_LOAD}`;
}
