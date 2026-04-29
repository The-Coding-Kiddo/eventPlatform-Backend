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

## 2. Frontend Setup

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

## 3. Test Accounts

The backend seed script automatically generates demo accounts. Once both servers are running, you can log in to the frontend using:

- **Super Admin:** `superadmin@demo.com` | Password: `123456`
- **Institution Admin:** `admin@demo.com` | Password: `123456`
- **Citizen (Standard User):** `citizen@demo.com` | Password: `123456`
