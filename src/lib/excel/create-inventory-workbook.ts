import "server-only";

import ExcelJS from "exceljs";

export type InventoryExportRow = {
  serialNumber: string;
  name: string;
  status: string;
  yardLocation: string;
  acBrand: string;
  acModel: string;
  lastMovedAt: string;
};

export async function createInventoryWorkbook(
  rows: InventoryExportRow[] = [],
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Loxam Module Yard";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Inventory", {
    views: [{state: "frozen", ySplit: 1}],
  });

  sheet.columns = [
    {header: "Serial number", key: "serialNumber", width: 22},
    {header: "Name", key: "name", width: 28},
    {header: "Status", key: "status", width: 16},
    {header: "Yard location", key: "yardLocation", width: 20},
    {header: "AC brand", key: "acBrand", width: 18},
    {header: "AC model", key: "acModel", width: 18},
    {header: "Last moved at", key: "lastMovedAt", width: 22},
  ];

  sheet.getRow(1).font = {bold: true};
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {argb: "FFFFCC00"},
  };

  rows.forEach((row) => {
    sheet.addRow(row);
  });

  return workbook;
}

export async function workbookToBuffer(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
