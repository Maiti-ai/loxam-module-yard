import {createClient} from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "module-photos";

if (!url || !publishableKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, publishableKey, {
  auth: {persistSession: false, autoRefreshToken: false},
});

const expectedRelations = [
  {name: "profiles", select: "id"},
  {name: "module_types", select: "id,code"},
  {name: "yard_blocks", select: "id,code"},
  {name: "yard_rows", select: "id,code"},
  {name: "yard_positions", select: "id,code"},
  {name: "yard_slots", select: "id,level"},
  {name: "modules", select: "id,module_number,status"},
  {name: "module_locations", select: "module_id,slot_id"},
  {name: "module_movements", select: "id,module_id"},
  {name: "module_photos", select: "id,storage_path"},
  {name: "air_conditioning_units", select: "id,brand,serial_number,internal_number"},
  {name: "module_location_view", select: "module_id,module_number,block_code,level"},
];

function isSchemaMissing(error) {
  return error?.code === "PGRST205";
}

function isAnonymousDenied(error) {
  return Boolean(error) && !isSchemaMissing(error);
}

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

const relationResults = {};
let missingCount = 0;
let deniedCount = 0;

for (const relation of expectedRelations) {
  const {error, status} = await supabase.from(relation.name).select(relation.select).limit(1);
  const entry = {
    status,
    code: error?.code ?? null,
    message: error?.message ?? null,
  };
  relationResults[relation.name] = entry;
  if (isSchemaMissing(error)) {
    missingCount += 1;
  } else if (isAnonymousDenied(error)) {
    deniedCount += 1;
  }
}

result.details.relations = relationResults;
result.schemaApplied = missingCount === 0;
result.anonymousAccessBlocked = missingCount === 0 && deniedCount === expectedRelations.length;

const objectListResponse = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
  method: "POST",
  headers: {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({prefix: "", limit: 1}),
});
result.details.storageObjectListStatus = objectListResponse.status;
const objectListBody = await objectListResponse.text();
result.details.storageObjectListBody = objectListBody.slice(0, 300);

if (objectListResponse.ok) {
  result.storageBucketReady = true;
} else {
  try {
    const parsed = JSON.parse(objectListBody);
    result.storageBucketReady = parsed?.code !== "NoSuchBucket";
    result.details.storageObjectListCode = parsed?.code ?? null;
  } catch {
    result.storageBucketReady = false;
  }
}

const bucketResponse = await fetch(`${url}/storage/v1/bucket/${bucket}`, {
  headers: {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
  },
});
result.details.storageBucketStatus = bucketResponse.status;
result.details.storageBucketAnonymousHidden = bucketResponse.status === 400 || bucketResponse.status === 404;

console.log(JSON.stringify(result, null, 2));

if (
  !result.authHealth ||
  !result.schemaApplied ||
  !result.anonymousAccessBlocked ||
  !result.storageBucketReady
) {
  process.exit(1);
}
