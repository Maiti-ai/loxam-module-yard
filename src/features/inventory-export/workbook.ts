import "server-only";

import ExcelJS from "exceljs";
import {listModuleSummaries} from "@/features/modules/queries";
import {formatDimensions, formatLevelCode, formatYardLocation} from "@/lib/format";

export type InventoryRow = {
  moduleNumber: string;
  moduleType: string;
  dimensions: string;
  status: string;
  rentedToProject: string;
  block: string;
  row: string;
  position: string;
  level: string;
  location: string;
};

export async function getInventoryRows(locale = "nl"): Promise<InventoryRow[]> {
  const modules = await listModuleSummaries();

  return modules.map((module) => ({
    moduleNumber: module.moduleNumber,
    moduleType: module.moduleTypeCode,
    dimensions: formatDimensions(module.lengthM, module.widthM),
    status: module.status,
    rentedToProject: module.rentedToProject ?? "",
    block: module.location?.blockCode ?? "",
    row: module.location?.rowCode ?? "",
    position: module.location?.positionCode ?? "",
    level: module.location ? formatLevelCode(module.location.level, locale) : "",
    location: module.location
      ? formatYardLocation({...module.location, locale})
      : "",
  }));
}

export async function createInventoryWorkbook(locale = "nl") {
  const rows = await getInventoryRows(locale);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Loxam Module Yard";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Inventory", {
    views: [{state: "frozen", ySplit: 1}],
  });

  sheet.columns = [
    {header: "Module number", key: "moduleNumber", width: 16},
    {header: "Type", key: "moduleType", width: 10},
    {header: "Dimensions", key: "dimensions", width: 14},
    {header: "Status", key: "status", width: 12},
    {header: "Rented to", key: "rentedToProject", width: 22},
    {header: "Block", key: "block", width: 10},
    {header: "Row", key: "row", width: 10},
    {header: "Position", key: "position", width: 12},
    {header: "Level", key: "level", width: 10},
  ];

  sheet.getRow(1).font = {bold: true, color: {argb: "FFFFFFFF"}};
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {argb: "FFC41E3A"},
  };

  rows.forEach((row) => {
    sheet.addRow({
      moduleNumber: row.moduleNumber,
      moduleType: row.moduleType,
      dimensions: row.dimensions,
      status: row.status,
      rentedToProject: row.rentedToProject,
      block: row.block,
      row: row.row,
      position: row.position,
      level: row.level,
    });
  });

  return workbook;
}

export async function workbookToBuffer(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
