# Mietubl POS monorepo

The `frontend/` React app and `backend/` Express API are built and served by one
Railway service. Attach `www.mietubl-luzon.com`, `www.mietubl-visayas.com`, and
`www.mietubl-mindanao.com` to that service. Requests are routed to the matching
database using the request hostname.

## Railway environment

Configure these variables in the Railway service. Store all credentials in
Railway's environment settings; do not commit them:

- `DB_URL_LUZON`: MySQL connection URL for the `mietubl` database.
- `DB_URL_VISAYAS`: MySQL connection URL for the `mietubl-visayas` database.
- `DB_URL_MINDANAO`: MySQL connection URL for the `mietubl-mindanao` database.
- `DB_SSLMODE=REQUIRED`
- `DB_CA_PATH=backend/certs/ca-certificate.crt`
- `JWT_SECRET`
- `STORAGE_BUCKET`, `STORAGE_ENDPOINT`, `STORAGE_KEY`, `STORAGE_REGION`,
  `STORAGE_SECRET`
- `DTR_INTERNAL_URL`: the DTR Railway private URL, including its listening port
  (for example, `http://mietubl-dtr.railway.internal:<DTR_LISTEN_PORT>`).

Connection URLs use the `mysql://user:password@host:port/database` format.
Percent-encode reserved characters in the username and password. Do not add regional `VITE_API_URL` values: the frontend calls `/api` on its
current domain. For testing the Railway-generated domain, set `DB_REGION` to the
database to use (for example, `luzon`). Requests on a matching regional custom
domain always select that domain's database, regardless of `DB_REGION`.

The wildcard `*.mietubl-ph.com` domain on the POS Railway service also receives
`dtr.mietubl-ph.com`. Set `DTR_INTERNAL_URL` on that service to proxy this exact
hostname to the DTR service over Railway private networking. Use the port that
the DTR service listens on; other hostnames continue through normal region
routing.

Use the repository root as the Railway service root. The root `build` script
installs both applications, builds the frontend, and compiles the backend; the
root `start` script starts the compiled Express server. The server serves the
frontend build and its API from the same regional hostname. `/health` is a
database-independent health check.

## Local development

Set `DB_REGION` to `luzon`, `visayas`, or `mindanao` in the backend environment,
and configure the corresponding `DB_URL_<REGION>` value. Then install and run:

```sh
npm run install:all
npm run dev
```

Run the frontend separately with `npm --prefix frontend run dev`; Vite proxies
`/api` requests to the backend on port 4000.
