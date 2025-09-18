
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const db = new Database('./beauty_scheduler.db');

console.log('Running system settings migration...');

try {
  // Check if system_settings table already exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'
  `).get();

  if (!tableExists) {
    console.log('Creating system_settings table...');
    
    // Create system_settings table
    db.exec(`
      CREATE TABLE system_settings (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'string',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default settings
    const insertSetting = db.prepare(`
      INSERT INTO system_settings (id, key, value, description, type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    // VIP plan price (R$ 50.00 in cents)
    insertSetting.run(
      randomUUID(),
      'vip_plan_price',
      '5000',
      'Valor mensal do plano VIP em centavos',
      'number',
      now,
      now
    );

    // Trial plan duration (10 days)
    insertSetting.run(
      randomUUID(),
      'trial_plan_duration',
      '10',
      'Duração do período de teste em dias',
      'number',
      now,
      now
    );

    // VIP plan duration (30 days)
    insertSetting.run(
      randomUUID(),
      'vip_plan_duration',
      '30',
      'Duração do plano VIP em dias',
      'number',
      now,
      now
    );

    console.log('✅ System settings table created and populated successfully!');
  } else {
    console.log('⚠️  system_settings table already exists, skipping creation');
  }

  // Show current settings
  const settings = db.prepare('SELECT * FROM system_settings').all();
  console.log('\nCurrent system settings:');
  settings.forEach(setting => {
    const displayValue = setting.type === 'number' && setting.key.includes('price') 
      ? `R$ ${(parseInt(setting.value) / 100).toFixed(2)}`
      : setting.value;
    console.log(`- ${setting.key}: ${displayValue} (${setting.description})`);
  });

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}

console.log('\n🎉 Migration completed successfully!');
