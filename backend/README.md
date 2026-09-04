# Vikash Academy — Backend (Node.js + Express + MongoDB)

Real authentication for the Vikash Academy site. Replaces the old
`localStorage`-based fake login with:

- Passwords hashed with **bcrypt** (never stored or sent in plain text)
- **JWT** tokens issued on login, verified on every protected request
- Admin-only routes actually enforced on the server (not just hidden in the UI)
- A student can only ever see their **own** payment history — enforced by
  the server using the ID inside their verified token, not something the
  browser can fake

## 1. Install

```bash
cd backend
npm install
```

## 2. Configure

```bash
cp .env.example .env
```

Open `.env` and fill in:

- `MONGO_URI` — your MongoDB connection string (local or Atlas)
- `JWT_SECRET` — a long random string. Generate one:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` — the first admin login
- `CORS_ORIGIN` — the URL your frontend runs on (e.g. `http://127.0.0.1:5500`)

## 3. Create the database and first admin

Make sure MongoDB is reachable (local `mongod` running, or an Atlas
cluster), then:

```bash
npm run seed
```

This creates one admin account using the values from `.env`. Run it again
later and it will just say the admin already exists — it won't duplicate.

## 4. Run

```bash
npm run dev     # with auto-restart (nodemon)
# or
npm start
```

Server starts on `http://localhost:5000` (or your `PORT`). Check it's alive:

```bash
curl http://localhost:5000/api/health
```

## API overview

| Method | Route                     | Auth           | Purpose                          |
|--------|---------------------------|----------------|-----------------------------------|
| POST   | /api/auth/admin/login     | —              | Admin login → `{ token, user }`   |
| POST   | /api/auth/student/login   | —              | Student login → `{ token, user }` |
| GET    | /api/auth/me              | any logged in  | Restore session on page load      |
| GET    | /api/classes              | —              | List classes (public)             |
| POST   | /api/classes              | admin          | Add class                         |
| PUT    | /api/classes/:id          | admin          | Edit class                        |
| DELETE | /api/classes/:id          | admin          | Delete class (blocked if in use)  |
| GET    | /api/students             | admin          | List students                     |
| POST   | /api/students             | admin          | Add student                       |
| PUT    | /api/students/:id         | admin          | Edit student                      |
| DELETE | /api/students/:id         | admin          | Delete student                    |
| GET    | /api/holidays             | —              | List holidays (public)            |
| POST   | /api/holidays             | admin          | Add holiday                       |
| DELETE | /api/holidays/:id         | admin          | Remove holiday                    |
| GET    | /api/payments?classId=    | admin          | Payments for a class              |
| GET    | /api/payments/me          | student        | The logged-in student's own payments |
| POST   | /api/payments             | admin          | Add payment entry                 |
| PUT    | /api/payments/:id/toggle  | admin          | Toggle Paid/Unpaid                |
| DELETE | /api/payments/:id         | admin          | Delete payment entry              |

Protected routes expect: `Authorization: Bearer <token>`

## 5. Deploy to Render (free tier)

1. Push this `backend/` folder to a GitHub repo.
2. On Render: **New → Web Service** → connect the repo.
3. Build command: `npm install`  ·  Start command: `npm start`
4. Add the same environment variables from your `.env` in Render's
   **Environment** tab (use a MongoDB Atlas free cluster for `MONGO_URI`,
   since Render doesn't host MongoDB itself).
5. Set `CORS_ORIGIN` to your deployed frontend's real URL once you have it.
6. After the first deploy, run the seed once — easiest way is to open the
   Render **Shell** tab for the service and run `npm run seed`.

Railway works the same way: connect the repo, set the same env vars,
build `npm install`, start `npm start`.

## Notes

- MongoDB Atlas has a free forever tier (M0) — good pairing with Render/Railway's
  free tier since neither hosts a database for you.
- Never commit `.env` — it's already covered by the `.gitignore` below.
