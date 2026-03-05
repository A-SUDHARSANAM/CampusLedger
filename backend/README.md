# CampusLedger Backend

A production-ready FastAPI backend for the CampusLedger campus asset and inventory management system.

## Tech Stack

- **FastAPI** – web framework
- **PostgreSQL** – relational database
- **SQLAlchemy 2** – ORM
- **Pydantic v2** – data validation & schemas
- **python-jose** – JWT authentication
- **passlib[bcrypt]** – password hashing
- **Alembic** – database migrations

## Project Structure

```
backend/
├── main.py                     # FastAPI app, CORS, router registration, lifespan
├── alembic.ini                 # Alembic config
├── alembic/                    # Migration scripts
├── requirements.txt
├── .env.example
└── app/
    ├── core/
    │   ├── config.py           # Settings (pydantic-settings, reads .env)
    │   ├── security.py         # JWT helpers, password hashing
    │   └── dependencies.py     # get_db, get_current_user, RoleChecker
    ├── db/
    │   ├── base.py             # Declarative Base with id/created_at/updated_at
    │   └── session.py          # Engine & SessionLocal
    ├── models/                 # SQLAlchemy ORM models
    │   ├── user.py             # User, UserRole enum
    │   ├── lab.py              # Lab
    │   ├── asset.py            # Asset, AssetStatus, AssetCategory
    │   ├── maintenance.py      # MaintenanceRequest
    │   ├── purchase.py         # PurchaseOrder, PurchaseOrderItem
    │   └── notification.py     # Notification
    ├── schemas/                # Pydantic schemas (request / response)
    └── routers/                # FastAPI routers (one per module)
```

## Roles

| Role            | Access level                                   |
|-----------------|------------------------------------------------|
| `admin`         | Full access to all endpoints                   |
| `lab_technician`| Assets, labs (read/write), maintenance reports |
| `service_staff` | Own maintenance tickets, assets (read)         |
| `purchase_dept` | Purchase orders (approve/reject), assets (read)|

## Quick Start

### 1. Set up environment

```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL credentials and a strong SECRET_KEY
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Create the database

```sql
CREATE DATABASE campusledger;
```

### 4. Run migrations (or let lifespan auto-create tables on first run)

```bash
# Generate initial migration
alembic revision --autogenerate -m "initial schema"
# Apply migrations
alembic upgrade head
```

### 5. Start the server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: **http://localhost:8000/api/v1/docs**

## API Prefix

All routes are served under `/api/v1`:

| Module        | Prefix                       |
|---------------|------------------------------|
| Auth          | `/api/v1/auth`               |
| Users         | `/api/v1/users`              |
| Labs          | `/api/v1/labs`               |
| Assets        | `/api/v1/assets`             |
| Maintenance   | `/api/v1/maintenance`        |
| Purchase      | `/api/v1/purchase`           |
| Reports       | `/api/v1/reports`            |
| Notifications | `/api/v1/notifications`      |

## Default Admin Credentials

Seeded automatically on first startup (from `.env`):

- **Email:** `admin@campusledger.com`
- **Password:** `Admin@123456`

> Change these immediately in your `.env` before deploying.
