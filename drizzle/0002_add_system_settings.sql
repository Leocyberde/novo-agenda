
-- Create system_settings table for admin-configurable values
CREATE TABLE system_settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'string',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default VIP plan price setting (R$ 50.00 in cents)
INSERT INTO system_settings (id, key, value, description, type) 
VALUES ('vip-plan-price', 'vip_plan_price', '5000', 'Valor mensal do plano VIP em centavos', 'number');

-- Insert trial plan duration setting (10 days)
INSERT INTO system_settings (id, key, value, description, type)
VALUES ('trial-plan-duration', 'trial_plan_duration', '10', 'Duração do período de teste em dias', 'number');

-- Insert VIP plan duration setting (30 days)
INSERT INTO system_settings (id, key, value, description, type)
VALUES ('vip-plan-duration', 'vip_plan_duration', '30', 'Duração do plano VIP em dias', 'number');
