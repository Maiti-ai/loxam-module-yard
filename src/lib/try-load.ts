export async function tryLoad<T>(
  loader: () => Promise<T>,
): Promise<{ok: true; data: T} | {ok: false}> {
  try {
    return {ok: true, data: await loader()};
  } catch {
    return {ok: false};
  }
}
