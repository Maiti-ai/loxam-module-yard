import type {ModuleSummary} from "@/features/yard-locations/types";

export function searchModules(modules: ModuleSummary[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return modules;
  }

  const scored = modules
    .map((module) => {
      const number = module.moduleNumber.toLowerCase();
      let score = 0;
      if (number === needle) score = 100;
      else if (number.startsWith(needle)) score = 80;
      else if (number.includes(needle)) score = 60;

      const haystack = [
        module.moduleTypeCode,
        module.moduleTypeNumber ?? "",
        module.rentedToProject ?? "",
        module.location?.blockCode ?? "",
        module.location?.rowCode ?? "",
        module.location?.positionCode ?? "",
        module.airco?.internalNumber ?? "",
        module.airco?.serialNumber ?? "",
        module.airco?.brand ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (score === 0 && haystack.includes(needle)) {
        score = 20;
      }

      return {module, score};
    })
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.module.moduleNumber.localeCompare(b.module.moduleNumber),
    );

  return scored.map((item) => item.module);
}
