const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization"
    }
  });

function isAuthorized(request, env) {
  const token = env.ADMIN_API_TOKEN;
  const header = request.headers.get("Authorization") || "";
  return Boolean(token && header === `Bearer ${token}`);
}

export async function onRequest({ request, env, params }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  const route = Array.isArray(params.path) ? params.path.join("/") : (params.path || "");

  if (request.method === "GET" && route === "health") {
    return json({ ok: true, service: "ZEXO API", timestamp: new Date().toISOString() });
  }

  if (request.method === "GET" && route === "products") {
    if (!env.DB) return json({ error: "D1 database is not configured." }, 503);
    const category = new URL(request.url).searchParams.get("category");
    let query = "SELECT id, name, description, category, thumbnail_key, price_coins, created_at FROM products WHERE is_published = 1";
    const values = [];
    if (category) {
      query += " AND category = ?";
      values.push(category);
    }
    query += " ORDER BY created_at DESC";
    const result = await env.DB.prepare(query).bind(...values).all();
    return json({ products: result.results || [] });
  }

  if (request.method === "POST" && route === "admin/products") {
    if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
    if (!env.DB) return json({ error: "D1 database is not configured." }, 503);
    const body = await request.json().catch(() => null);
    if (!body || !body.id || !body.name || !["addon", "texture_pack", "skin", "digital_product"].includes(body.category)) {
      return json({ error: "Provide id, name, and a valid category." }, 400);
    }
    await env.DB.prepare(
      "INSERT INTO products (id, name, description, category, file_key, thumbnail_key, price_coins, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, category=excluded.category, file_key=excluded.file_key, thumbnail_key=excluded.thumbnail_key, price_coins=excluded.price_coins, is_published=excluded.is_published, updated_at=CURRENT_TIMESTAMP"
    ).bind(
      String(body.id), String(body.name), String(body.description || ""), body.category,
      body.file_key || null, body.thumbnail_key || null,
      Math.max(0, Number(body.price_coins) || 0), body.is_published ? 1 : 0
    ).run();
    return json({ ok: true, id: body.id });
  }

  if (request.method === "POST" && route === "admin/upload") {
    if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
    if (!env.ASSETS) return json({ error: "R2 bucket is not configured." }, 503);
    const key = request.headers.get("X-File-Key");
    if (!key || key.includes("..") || key.startsWith("/")) return json({ error: "A safe X-File-Key is required." }, 400);
    const contentType = request.headers.get("Content-Type") || "application/octet-stream";
    if (!["application/octet-stream", "application/zip", "application/x-zip-compressed", "image/png", "image/jpeg", "image/webp", "application/json"].includes(contentType)) {
      return json({ error: "Unsupported content type." }, 415);
    }
    await env.ASSETS.put(key, request.body, { httpMetadata: { contentType } });
    return json({ ok: true, key });
  }

  return json({ error: "Not found" }, 404);
}
