import "server-only";

import ExcelJS from "exceljs";

export type InventoryExportRow = {
  moduleNumber: string;
  moduleType: string;
  status: string;
  yardLocation: string;
  rentedToProject: string;
  acBrand: string;
  acSerialNumber: string;
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
    {header: "Module number", key: "moduleNumber", width: 16},
    {header: "Type", key: "moduleType", width: 10},
    {header: "Status", key: "status", width: 12},
    {header: "Yard location", key: "yardLocation", width: 22},
    {header: "Rented to", key: "rentedToProject", width: 22},
    {header: "AC brand", key: "acBrand", width: 16},
    {header: "AC serial", key: "acSerialNumber", width: 18},
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
