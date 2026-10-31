# StudioSpace API

Express 5, MongoDB, Better Auth with MongoDB adapter, HTTPOnly JWT cookies, ImgBB uploads.

## Setup

Requires Node.js 22+ and a MongoDB replica set such as Atlas.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Fill every required environment setting before starting. Set separate 32+ character BETTER_AUTH_SECRET and JWT_SECRET values, plus MONGODB_URI and CLIENT_URL. Google and ImgBB keys enable their corresponding integrations.

## API

| Method | Path | Access |
| --- | --- | --- |
| GET | /api/health | Public |
| GET | /api/config | Public feature availability |
| GET | /api/studios | Public; category/search/sort/featured queries |
| GET | /api/studios/:id | Public; includes confirmed availability and stored reviews |
| GET | /api/my-listings | Session; current host only |
| POST | /api/studios | Session + JWT; host inferred from account |
| PATCH | /api/studios/:id | Session + JWT; owner only |
| DELETE | /api/studios/:id | Session + JWT; owner only |
| POST | /api/bookings | Session + JWT; pending booking request |
| GET | /api/bookings | Session; creator's bookings, or host=true for own incoming requests |
| PATCH | /api/bookings/:id | Session + JWT; permitted owner/creator status transition |
| POST | /api/upload | Session + JWT; ImgBB upload |
| POST | /api/access | Session; issue short-lived HTTPOnly JWT |
| DELETE | /api/access | Clear application JWT |
| GET/POST | /api/auth/* | Better Auth endpoints |

Mutations require the configured CLIENT_URL Origin header. The browser accesses the API through Next rewrites; credentials do not cross browser origins. JWT verification also requires an active matching Better Auth session, so logging out invalidates access even before JWT expiry.

The server computes booking prices from the current studio record. Studio mutations whitelist editable fields and never trust ownerEmail supplied by the browser. Confirmation uses a per-studio write within a MongoDB transaction to serialize concurrent overlapping confirmations. Only existing Confirmed bookings block new requests, as required by the assignment.

## Demo content

Register a host through the client. Set SEED_OWNER_EMAIL to that account email, then run `npm run seed`. It inserts six illustrative listings without fake reviews. Seed preserves existing sample records.

## Tests

`npm test` runs six domain validation tests and skips the opt-in MongoDB integration test. To run the latter, set RUN_INTEGRATION=1. It downloads a temporary MongoDB binary and creates an isolated replica set. Some containers cannot run mongod; use an unrestricted development machine for that test.

## Deployment

Build: `npm ci`. Start: `npm start`. Set NODE_ENV=production, real secrets, Atlas credentials, exact HTTPS CLIENT_URL, and provider credentials in your host settings. Add Google callbacks for your client origin. Never commit .env.
