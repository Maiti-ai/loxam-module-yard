import {NextResponse} from "next/server";
import {createInventoryWorkbook, workbookToBuffer} from "@/features/inventory-export";
import {getCurrentProfile} from "@/features/auth";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({error: "UNAUTHENTICATED"}, {status: 401});
  }

  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "nl";

  try {
    const workbook = await createInventoryWorkbook(locale);
    const buffer = await workbookToBuffer(workbook);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="loxam-module-yard-inventory.xlsx"',
      },
    });
  } catch {
    return NextResponse.json({error: "LOAD_FAILED"}, {status: 500});
  }
}
