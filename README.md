## 1. Backend Setup

**A. Environment Variables**
Copy the example environment file to create your local config:

```bash
cp .env.example .env
```

**B. Start the Database**
Spin up the PostgreSQL container in the background:

```bash
sudo docker compose up -d
```

**C. Initialize & Run**
Install dependencies, generate the database schema, seed the test data, and start the server:

```bash
npm install
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
npm run start:dev
```

_The backend is now running at `http://localhost:3000`._

---

## 2. API Documentation

We provide two ways to explore the backend API:

- **Interactive Swagger UI**: Once the backend is running, navigate to `http://localhost:3000/api/docs` in your browser. This provides an interactive OpenAPI interface where you can view schemas, required payloads, and test endpoints directly.
- **Static Documentation**: See the [`API.md`](./API.md) file in this repository for a high-level overview of the architecture, RBAC model, and endpoint tables.

---

## 3. Frontend Setup

**A. Environment Variables**
Copy the example environment file to point the frontend to your local API:

```bash
cp .env.example .env
```

**B. Install & Run**

```bash
npm install
npm run dev
```

_The frontend is now running at `http://localhost:5175`._

---

## 4. Test Accounts

The backend seed script automatically generates demo accounts. Once both servers are running, you can log in to the frontend using:

- **Super Admin:** `superadmin@demo.com` | Password: `123456`
- **Institution Admin:** `admin@demo.com` | Password: `123456`
- **Citizen (Standard User):** `citizen@demo.com` | Password: `123456`
