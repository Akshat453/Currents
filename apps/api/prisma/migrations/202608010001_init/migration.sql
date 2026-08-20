-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'operator', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('Type1', 'Type2', 'CCS', 'CHAdeMO', 'Tesla');

-- CreateEnum
CREATE TYPE "StationStatus" AS ENUM ('active', 'maintenance', 'offline', 'coming_soon');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ChargerStatus" AS ENUM ('available', 'in_use', 'reserved', 'faulted', 'unavailable');

-- CreateEnum
CREATE TYPE "ChargingSpeed" AS ENUM ('slow', 'fast', 'rapid', 'ultra_rapid');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('initiated', 'charging', 'paused', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('card', 'upi', 'wallet', 'net_banking');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('credit', 'debit', 'refund');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('booking_confirmed', 'charging_started', 'charging_completed', 'payment_success', 'payment_failed', 'station_available', 'maintenance_alert', 'promotional');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "profile_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "replaced_by_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_vehicles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "battery_capacity_kwh" DECIMAL(5,2),
    "connector_type" "ConnectorType" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charging_stations" (
    "id" TEXT NOT NULL,
    "operator_id" TEXT,
    "external_provider" TEXT,
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "status" "StationStatus" NOT NULL DEFAULT 'active',
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'approved',
    "approved_at" TIMESTAMP(3),
    "amenities" JSONB NOT NULL DEFAULT '[]',
    "images" JSONB NOT NULL DEFAULT '[]',
    "opening_time" TIME,
    "closing_time" TIME,
    "is_24x7" BOOLEAN NOT NULL DEFAULT false,
    "base_price_per_kwh" DECIMAL(6,2) NOT NULL,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charging_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chargers" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "charger_identifier" TEXT NOT NULL,
    "connector_type" "ConnectorType" NOT NULL,
    "max_power_kw" DECIMAL(5,2) NOT NULL,
    "charging_speed" "ChargingSpeed" NOT NULL,
    "status" "ChargerStatus" NOT NULL DEFAULT 'available',
    "current_session_id" TEXT,
    "last_maintenance_at" TIMESTAMP(3),
    "fault_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chargers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "charger_id" TEXT,
    "vehicle_id" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "booking_time" TIMESTAMP(3) NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "estimated_kwh" DECIMAL(6,2),
    "price_estimate" DECIMAL(8,2),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charging_sessions" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT,
    "user_id" TEXT NOT NULL,
    "charger_id" TEXT,
    "vehicle_id" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'initiated',
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "energy_delivered_kwh" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "start_battery_percent" INTEGER,
    "end_battery_percent" INTEGER,
    "average_power_kw" DECIMAL(5,2),
    "total_cost" DECIMAL(8,2),
    "payment_status" TEXT,
    "session_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charging_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "payment_method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "gateway" TEXT,
    "gateway_transaction_id" TEXT,
    "gateway_response" JSONB,
    "refund_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balance_after" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "session_id" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "days_of_week" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "price_multiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "power_kw" DECIMAL(5,2),
    "voltage" DECIMAL(5,2),
    "current" DECIMAL(5,2),
    "battery_percent" INTEGER,
    "temperature" DECIMAL(4,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_predictions" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "prediction_date" DATE NOT NULL,
    "hour" INTEGER NOT NULL,
    "predicted_demand" DECIMAL(5,2) NOT NULL,
    "confidence_score" DECIMAL(3,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "user_vehicles_user_id_idx" ON "user_vehicles"("user_id");

-- CreateIndex
CREATE INDEX "charging_stations_latitude_longitude_idx" ON "charging_stations"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "charging_stations_operator_id_idx" ON "charging_stations"("operator_id");

-- CreateIndex
CREATE INDEX "charging_stations_status_idx" ON "charging_stations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "charging_stations_external_provider_external_id_key" ON "charging_stations"("external_provider", "external_id");

-- CreateIndex
CREATE INDEX "chargers_station_id_idx" ON "chargers"("station_id");

-- CreateIndex
CREATE INDEX "chargers_status_idx" ON "chargers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "chargers_station_id_charger_identifier_key" ON "chargers"("station_id", "charger_identifier");

-- CreateIndex
CREATE INDEX "bookings_user_id_idx" ON "bookings"("user_id");

-- CreateIndex
CREATE INDEX "bookings_station_id_idx" ON "bookings"("station_id");

-- CreateIndex
CREATE INDEX "bookings_charger_id_idx" ON "bookings"("charger_id");

-- CreateIndex
CREATE INDEX "bookings_start_time_end_time_idx" ON "bookings"("start_time", "end_time");

-- CreateIndex
CREATE INDEX "charging_sessions_user_id_idx" ON "charging_sessions"("user_id");

-- CreateIndex
CREATE INDEX "charging_sessions_charger_id_idx" ON "charging_sessions"("charger_id");

-- CreateIndex
CREATE INDEX "charging_sessions_booking_id_idx" ON "charging_sessions"("booking_id");

-- CreateIndex
CREATE INDEX "charging_sessions_start_time_end_time_idx" ON "charging_sessions"("start_time", "end_time");

-- CreateIndex
CREATE INDEX "charging_sessions_status_idx" ON "charging_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_transaction_id_key" ON "payments"("gateway_transaction_id");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_session_id_idx" ON "payments"("session_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_reference_id_key" ON "wallet_transactions"("reference_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_idx" ON "wallet_transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "reviews_station_id_idx" ON "reviews"("station_id");

-- CreateIndex
CREATE INDEX "reviews_user_id_idx" ON "reviews"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_user_id_session_id_key" ON "reviews"("user_id", "session_id");

-- CreateIndex
CREATE INDEX "favorites_user_id_idx" ON "favorites"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_station_id_key" ON "favorites"("user_id", "station_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "pricing_rules_station_id_idx" ON "pricing_rules"("station_id");

-- CreateIndex
CREATE INDEX "session_logs_session_id_idx" ON "session_logs"("session_id");

-- CreateIndex
CREATE INDEX "session_logs_timestamp_idx" ON "session_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "demand_predictions_station_id_prediction_date_hour_key" ON "demand_predictions"("station_id", "prediction_date", "hour");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vehicles" ADD CONSTRAINT "user_vehicles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_stations" ADD CONSTRAINT "charging_stations_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chargers" ADD CONSTRAINT "chargers_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "charging_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "charging_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "chargers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "user_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "chargers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_sessions" ADD CONSTRAINT "charging_sessions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "user_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "charging_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "charging_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "charging_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "charging_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "charging_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "charging_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_predictions" ADD CONSTRAINT "demand_predictions_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "charging_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
