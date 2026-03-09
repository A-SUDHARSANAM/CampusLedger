-- ============================================================
-- CampusLedger — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────
create type user_role as enum ('admin', 'lab_technician', 'service_staff', 'purchase_dept');
create type asset_status as enum ('active', 'inactive', 'under_maintenance', 'disposed', 'lost');
create type asset_category as enum ('electronics', 'furniture', 'lab_equipment', 'computers', 'networking', 'software', 'other');
create type maintenance_status as enum ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
create type maintenance_priority as enum ('low', 'medium', 'high', 'critical');
create type po_status as enum ('draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'rejected', 'cancelled');
create type notification_type as enum ('info', 'warning', 'success', 'error', 'maintenance', 'purchase', 'asset');

-- ─────────────────────────────────────────────────────────────
-- PROFILES  (extends auth.users)
-- ─────────────────────────────────────────────────────────────
create table profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    email       text not null unique,
    full_name   text not null,
    role        user_role not null default 'lab_technician',
    is_active   boolean not null default true,
    phone       text,
    department  text,
    avatar_url  text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_profiles_updated_at
    before update on profiles
    for each row execute procedure update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- LABS
-- ─────────────────────────────────────────────────────────────
create table labs (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    lab_code        text not null unique,
    location        text,
    building        text,
    floor           text,
    description     text,
    capacity        int,
    is_active       boolean not null default true,
    technician_id   uuid references profiles(id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create trigger trg_labs_updated_at
    before update on labs
    for each row execute procedure update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- PURCHASE ORDERS  (declared before assets because assets FK)
-- ─────────────────────────────────────────────────────────────
create table purchase_orders (
    id                      uuid primary key default gen_random_uuid(),
    po_number               text not null unique,
    title                   text not null,
    description             text,
    purchase_department_name     text,
    purchase_department_contact  text,
    status                  po_status not null default 'draft',
    total_amount            numeric(14,2),
    expected_delivery_date  date,
    actual_delivery_date    date,
    rejection_reason        text,
    requested_by_id         uuid references profiles(id) on delete set null,
    approved_by_id          uuid references profiles(id) on delete set null,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create trigger trg_purchase_orders_updated_at
    before update on purchase_orders
    for each row execute procedure update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- PURCHASE ORDER ITEMS
-- ─────────────────────────────────────────────────────────────
create table purchase_order_items (
    id                  uuid primary key default gen_random_uuid(),
    purchase_order_id   uuid not null references purchase_orders(id) on delete cascade,
    item_name           text not null,
    description         text,
    quantity            int not null default 1,
    unit_price          numeric(12,2),
    total_price         numeric(12,2),
    received_quantity   int not null default 0,
    specifications      text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create trigger trg_po_items_updated_at
    before update on purchase_order_items
    for each row execute procedure update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- ASSETS
-- ─────────────────────────────────────────────────────────────
create table assets (
    id                  uuid primary key default gen_random_uuid(),
    name                text not null,
    asset_tag           text not null unique,
    serial_number       text unique,
    category            asset_category not null default 'other',
    status              asset_status not null default 'active',
    description         text,
    model               text,
    manufacturer        text,
    purchase_date       date,
    warranty_expiry     date,
    purchase_price      numeric(12,2),
    location_detail     text,
    qr_code             text,
    image_url           text,
    lab_id              uuid references labs(id) on delete set null,
    purchase_order_id   uuid references purchase_orders(id) on delete set null,
    assigned_to_id      uuid references profiles(id) on delete set null,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create trigger trg_assets_updated_at
    before update on assets
    for each row execute procedure update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- MAINTENANCE REQUESTS
-- ─────────────────────────────────────────────────────────────
create table maintenance_requests (
    id                uuid primary key default gen_random_uuid(),
    title             text not null,
    description       text,
    status            maintenance_status not null default 'pending',
    priority          maintenance_priority not null default 'medium',
    resolution_notes  text,
    resolved_at       timestamptz,
    estimated_cost    text,
    asset_id          uuid not null references assets(id) on delete cascade,
    reported_by_id    uuid references profiles(id) on delete set null,
    assigned_to_id    uuid references profiles(id) on delete set null,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create trigger trg_maintenance_updated_at
    before update on maintenance_requests
    for each row execute procedure update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────
create table notifications (
    id          uuid primary key default gen_random_uuid(),
    title       text not null,
    message     text not null,
    type        notification_type not null default 'info',
    is_read     boolean not null default false,
    link        text,
    user_id     uuid not null references profiles(id) on delete cascade,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create trigger trg_notifications_updated_at
    before update on notifications
    for each row execute procedure update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (basic — tighten per your needs)
-- ─────────────────────────────────────────────────────────────
-- Enable RLS on all tables
alter table profiles             enable row level security;
alter table labs                 enable row level security;
alter table assets               enable row level security;
alter table maintenance_requests enable row level security;
alter table purchase_orders      enable row level security;
alter table purchase_order_items enable row level security;
alter table notifications        enable row level security;

-- The FastAPI backend uses the service role key which bypasses RLS.
-- These policies protect direct client-side access via the anon/user key.

create policy "Authenticated users can read profiles"
    on profiles for select using (auth.role() = 'authenticated');

create policy "Users can update their own profile"
    on profiles for update using (auth.uid() = id);

create policy "Authenticated users can read labs"
    on labs for select using (auth.role() = 'authenticated');

create policy "Authenticated users can read assets"
    on assets for select using (auth.role() = 'authenticated');

create policy "Users can read their own notifications"
    on notifications for select using (auth.uid() = user_id);

create policy "Users can update their own notifications"
    on notifications for update using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- INITIAL ADMIN USER
-- ─────────────────────────────────────────────────────────────
-- After creating the admin in Supabase Auth Dashboard (or via API), run:
--   insert into profiles (id, email, full_name, role, is_active)
--   values ('<auth-user-uuid>', 'admin@campusledger.com', 'System Administrator', 'admin', true);
