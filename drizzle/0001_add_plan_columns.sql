
-- Add plan status and validity columns to merchants table
ALTER TABLE merchants 
ADD COLUMN plan_status TEXT DEFAULT 'free' CHECK (plan_status IN ('free', 'vip')),
ADD COLUMN plan_validity TIMESTAMP;

-- Set default plan validity for existing merchants (10 days from now for free plan)
UPDATE merchants 
SET plan_validity = NOW() + INTERVAL '10 days' 
WHERE plan_validity IS NULL AND plan_status = 'free';
