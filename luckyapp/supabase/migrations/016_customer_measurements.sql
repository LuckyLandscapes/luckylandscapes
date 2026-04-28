-- Adds a measurements jsonb column to customers so the Measure tool can
-- persist per-yard polygons/exclusions/circles for each customer.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS measurements jsonb;

-- Optional: index for faster lookup if measurements are queried by content.
-- (Not required for current usage — left commented for future use.)
-- CREATE INDEX IF NOT EXISTS customers_measurements_gin ON customers USING gin (measurements);
