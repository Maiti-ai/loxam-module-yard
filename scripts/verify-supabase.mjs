import {createClient} from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, publishableKey, {
  auth: {persistSession: false, autoRefreshToken: false},
});

const result = {
  urlHost: new URL(url).host,
  authHealth: false,
  schemaApplied: false,
  anonymousAccessBlocked: false,
  storageBucketReady: false,
  details: {},
};

const health = await fetch(`${url}/auth/v1/health`, {
  headers: {apikey: publishableKey},
});
result.authHealth = health.ok;
result.details.authHealthStatus = health.status;

const {error: modulesError, data: modulesData, status: modulesStatus} = await supabase
  .from("modules")
  .select("id")
  .limit(1);

result.details.modulesStatus = modulesStatus;

if (!modulesError) {
  result.schemaApplied = true;
  result.anonymousAccessBlocked = false;
  result.details.anonymousModuleCount = Array.isArray(modulesData) ? modulesData.length : null;
} else if (modulesError.code === "PGRST205") {
  result.schemaApplied = false;
  result.details.modulesError = modulesError.message;
} else {
  result.schemaApplied = true;
  result.anonymousAccessBlocked = true;
  result.details.modulesError = modulesError.message;
  result.details.modulesCode = modulesError.code;
}

const storageResponse = await fetch(`${url}/storage/v1/bucket/module-photos`, {
  headers: {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
  },
});
result.details.storageStatus = storageResponse.status;
if (storageResponse.ok) {
  result.storageBucketReady = true;
} else {
  const body = await storageResponse.text();
  result.details.storageBody = body.slice(0, 300);
  if (storageResponse.status === 400 || storageResponse.status === 404) {
    result.storageBucketReady = false;
  }
}

console.log(JSON.stringify(result, null, 2));

if (!result.authHealth) {
  process.exit(1);
}
