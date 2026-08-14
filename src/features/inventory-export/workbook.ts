import "server-only";

import ExcelJS from "exceljs";
import {listModuleSummaries} from "@/features/modules/queries";
import {formatDateTime, formatDimensions, formatLevelCode} from "@/lib/format";

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
  acBrand: string;
  acInternal: string;
  acSerial: string;
  acMaintenance: string;
  lastMovedAt: string;
};

export async function getInventoryRows(locale = "nl"): Promise<InventoryRow[]> {
  const modules = await listModuleSummaries();

  return modules.map((module) => ({
    moduleNumber: module.moduleNumber,
    moduleType: module.moduleTypeNumber || module.moduleTypeCode,
    dimensions: formatDimensions(module.lengthM, module.widthM),
    status: module.status,
    rentedToProject: module.rentedToProject ?? "",
    block: module.location?.blockCode ?? "",
    row: module.location?.rowCode ?? "",
    position: module.location?.positionCode ?? "",
    level: module.location ? formatLevelCode(module.location.level, locale) : "",
    location: "",
    acBrand: module.airco?.brand ?? "",
    acInternal: module.airco?.internalNumber ?? "",
    acSerial: module.airco?.serialNumber ?? "",
    acMaintenance: module.airco?.lastMaintenanceAt ?? "",
    lastMovedAt: module.lastMovedAt ? formatDateTime(module.lastMovedAt, locale) : "",
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
    {header: "Type", key: "moduleType", width: 12},
    {header: "Dimensions", key: "dimensions", width: 14},
    {header: "Status", key: "status", width: 12},
    {header: "Project/site", key: "rentedToProject", width: 22},
    {header: "Block", key: "block", width: 10},
    {header: "Row", key: "row", width: 10},
    {header: "Position", key: "position", width: 12},
    {header: "Level", key: "level", width: 10},
    {header: "Airco brand", key: "acBrand", width: 16},
    {header: "Airco internal number", key: "acInternal", width: 22},
    {header: "Airco serial number", key: "acSerial", width: 20},
    {header: "Maintenance", key: "acMaintenance", width: 16},
    {header: "Last movement", key: "lastMovedAt", width: 22},
  ];

  const header = sheet.getRow(1);
  header.font = {bold: true, color: {argb: "FFFFFFFF"}};
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {argb: "FFC41E3A"},
  };
  header.alignment = {vertical: "middle"};
  header.height = 22;

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
      acBrand: row.acBrand,
      acInternal: row.acInternal,
      acSerial: row.acSerial,
      acMaintenance: row.acMaintenance,
      lastMovedAt: row.lastMovedAt,
    });
  });

  sheet.autoFilter = {
    from: {row: 1, column: 1},
    to: {row: Math.max(1, rows.length + 1), column: 14},
  };

  return workbook;
}

export async function workbookToBuffer(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
