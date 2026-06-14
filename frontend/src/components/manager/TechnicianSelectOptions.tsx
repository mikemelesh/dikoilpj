import type { Technician } from "@/types";
import {
  canAssignTechnician,
  formatTechnicianLoadLabel,
  getTechnicianLoadColorClass,
} from "@/utils/technicianLoad";

const getTechnicianLabel = (tech: Technician) => {
  const name =
    tech.first_name && tech.last_name
      ? `${tech.first_name} ${tech.last_name}`
      : tech.user?.first_name && tech.user?.last_name
        ? `${tech.user.first_name} ${tech.user.last_name}`
        : "Техник";
  const spec = tech.specialization || "Универсал";
  const load = tech.today_load ?? 0;
  return `${name} — ${spec} (${formatTechnicianLoadLabel(load)})`;
};

interface TechnicianSelectOptionsProps {
  technicians?: Technician[];
  /** When re-assigning, allow current technician even at max load. */
  currentTechnicianId?: number | null;
}

export const TechnicianSelectOptions = ({
  technicians,
  currentTechnicianId,
}: TechnicianSelectOptionsProps) => (
  <>
    {technicians?.map((tech) => {
      const load = tech.today_load ?? 0;
      const isCurrent = currentTechnicianId != null && tech.id === currentTechnicianId;
      const disabled = !isCurrent && !canAssignTechnician(load);
      return (
        <option key={tech.id} value={tech.id} disabled={disabled}>
          {getTechnicianLabel(tech)}
          {disabled ? " — загрузка полная" : ""}
        </option>
      );
    })}
  </>
);

export const TechnicianNameWithLoad = ({
  tech,
  className = "",
}: {
  tech: Technician;
  className?: string;
}) => {
  const load = tech.today_load ?? 0;
  const name =
    tech.first_name && tech.last_name
      ? `${tech.first_name} ${tech.last_name}`
      : tech.user?.first_name && tech.user?.last_name
        ? `${tech.user.first_name} ${tech.user.last_name}`
        : "Техник";

  return (
    <span className={`${getTechnicianLoadColorClass(load)} ${className}`.trim()}>
      {name}
      <span className="ml-2 text-xs font-normal text-muted-foreground">
        ({formatTechnicianLoadLabel(load)})
      </span>
    </span>
  );
};
