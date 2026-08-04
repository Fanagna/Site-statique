-- ARINA Database Schema

-- News table
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  excerpt TEXT,
  content TEXT,
  image_url VARCHAR(500),
  category VARCHAR(100),
  status VARCHAR(20) DEFAULT 'published',
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration for existing databases (idempotent)
ALTER TABLE news ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'published';
ALTER TABLE news ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;
ALTER TABLE news ALTER COLUMN image_url TYPE TEXT;

-- Stats table
CREATE TABLE IF NOT EXISTS stats (
  id SERIAL PRIMARY KEY,
  young_accompanied INTEGER DEFAULT 0,
  insertion_rate INTEGER DEFAULT 0,
  partners INTEGER DEFAULT 0,
  years_active INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default stats
INSERT INTO stats (young_accompanied, insertion_rate, partners, years_active)
VALUES (30, 85, 1, 2)
ON CONFLICT DO NOTHING;

-- Pillars table
CREATE TABLE IF NOT EXISTS pillars (
  id SERIAL PRIMARY KEY,
  icon VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(50),
  sort_order INTEGER DEFAULT 0
);

-- Insert default pillars (idempotent : ne réinsère que si la table est vide)
INSERT INTO pillars (icon, title, description, color, sort_order)
SELECT * FROM (VALUES
  ('🏠', 'Hébergement sécurisé', 'Des foyers d''accueil chaleureux et protecteurs pour chaque jeune.', 'emerald', 1),
  ('🧠', 'Soutien Psychosocial', 'Reconstruction psychologique et morale par des professionnels.', 'blue', 2),
  ('🔧', 'Formation Professionnelle', 'Menuiserie, cuisine, agriculture : des métiers d''avenir.', 'orange', 3),
  ('🤝', 'Insertion Sociale', 'Aide à l''emploi, au logement et à l''intégration sociale.', 'purple', 4)
) AS p(icon, title, description, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM pillars);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Newsletter subscriptions
CREATE TABLE IF NOT EXISTS newsletters (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Beneficiaries (for admin)
CREATE TABLE IF NOT EXISTS beneficiaries (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  age INTEGER DEFAULT 0,
  entry_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(50) DEFAULT 'active',
  training VARCHAR(255),
  notes TEXT,
  photo_url TEXT,
  dossier JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration : ajouter dossier + photo_url si la table existe déjà
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS dossier JSONB DEFAULT '{}'::jsonb;

-- Finances (for admin)
CREATE TABLE IF NOT EXISTS finances (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Volunteer applications (motivation letter + CV attachments)
CREATE TABLE IF NOT EXISTS volunteers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  skills TEXT,
  availability VARCHAR(100),
  motivation TEXT,
  file_name VARCHAR(255),
  file_type VARCHAR(100),
  file_size INTEGER,
  file_data TEXT,
  cv_name VARCHAR(255),
  cv_type VARCHAR(100),
  cv_size INTEGER,
  cv_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration for existing databases (idempotent)
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS cv_name VARCHAR(255);
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS cv_type VARCHAR(100);
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS cv_size INTEGER;
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS cv_data TEXT;
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS file_url VARCHAR(500);
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS cv_url VARCHAR(500);
