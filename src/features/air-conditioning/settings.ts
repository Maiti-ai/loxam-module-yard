import {AIRCO_SETTING_KEY} from "@/config/airco";
import {parseIntervalMonths} from "@/features/air-conditioning/status";
import {createClient} from "@/lib/supabase/server";

export async function getAircoIntervalMonths(): Promise<number | null> {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from("app_settings")
    .select("value_json")
    .eq("key", AIRCO_SETTING_KEY)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return parseIntervalMonths(data.value_json);
}

export async function setAircoIntervalMonths(months: number | null, userId: string) {
  const supabase = await createClient();
  const {error} = await supabase.from("app_settings").upsert({
    key: AIRCO_SETTING_KEY,
    value_json: months,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error("SAVE_FAILED");
  }
}
