# ZEXO Cloudflare setup

This repository keeps the existing static website and adds a Cloudflare Pages Functions API.

## 1. Create Cloudflare resources

In the Cloudflare dashboard:

1. Create a D1 database named `zexo-db`.
2. Create an R2 bucket named `zexo-assets`.
3. Copy the D1 database ID.

## 2. Configure the project

Update `wrangler.toml`:

- Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with the real D1 database ID.
- Keep the D1 binding name as `DB`.
- Keep the R2 binding name as `ASSETS`.

In Pages > your ZEXO project > Settings > Variables and Secrets, add:
- `ADMIN_API_TOKEN`: a long, random secret. Store it as a secret, never in frontend JavaScript or GitHub.

## 3. Initialize the database

From the repository root, using Wrangler:

```bash
npx wrangler d1 execute zexo-db --remote --file=./schema.sql
```

## 4. Deploy

Connect the GitHub repository to Cloudflare Pages. For this plain HTML project, use the repository root as the build output directory and no build command. The `functions/` directory is deployed as Pages Functions.

## API routes

- `GET /api/health` — service health check.
- `GET /api/products` — published products.
- `GET /api/products?category=addon` — filter published products.
- `POST /api/admin/products` — create/update a product; requires `Authorization: Bearer <ADMIN_API_TOKEN>`.
- `POST /api/admin/upload` — upload a file to R2; requires the same authorization header and an `X-File-Key` header.

The admin token must only be used by a trusted server-side admin session. Do not hardcode it into `admin.html` or any browser JavaScript. Before enabling public admin access, implement proper user authentication and authorization.
