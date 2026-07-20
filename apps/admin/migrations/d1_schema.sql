CREATE TABLE IF NOT EXISTS student_cgpa (
  student_id TEXT PRIMARY KEY,
  batch_year TEXT NOT NULL,
  batch_label TEXT NOT NULL,
  regulation TEXT NOT NULL,
  sgpa_1_1 REAL,
  credits_1_1 REAL,
  sgpa_1_2 REAL,
  credits_1_2 REAL,
  sgpa_2_1 REAL,
  credits_2_1 REAL,
  sgpa_2_2 REAL,
  credits_2_2 REAL,
  sgpa_3_1 REAL,
  credits_3_1 REAL,
  sgpa_3_2 REAL,
  credits_3_2 REAL,
  sgpa_4_1 REAL,
  credits_4_1 REAL,
  sgpa_4_2 REAL,
  credits_4_2 REAL,
  total_credits REAL,
  cgpa REAL,
  supplementary_appearances TEXT,
  sync_token TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_academic_summary (
  student_id TEXT PRIMARY KEY,
  batch_year TEXT NOT NULL,
  regulation TEXT NOT NULL,
  percentage TEXT NOT NULL,
  percentage_value REAL NOT NULL DEFAULT 0,
  division TEXT NOT NULL,
  division_class TEXT NOT NULL,
  progress_percentage REAL NOT NULL DEFAULT 0,
  progress_class TEXT NOT NULL,
  supplementary_count INTEGER NOT NULL DEFAULT 0,
  sync_token TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS semester_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  batch_year TEXT NOT NULL,
  semester_number INTEGER NOT NULL,
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  grade TEXT,
  credits TEXT,
  row_order INTEGER NOT NULL DEFAULT 0,
  is_honors_minor INTEGER NOT NULL DEFAULT 0,
  sync_token TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(batch_year, semester_number, student_id, subject_code)
);

CREATE TABLE IF NOT EXISTS toppers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_year TEXT NOT NULL,
  category TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  cgpa REAL NOT NULL,
  rank_order INTEGER NOT NULL,
  sync_token TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(batch_year, category, rank_order)
);

CREATE TABLE IF NOT EXISTS honors_minor_eligibility (
  student_id TEXT PRIMARY KEY,
  batch_year TEXT NOT NULL,
  degree_type TEXT NOT NULL,
  eligibility_status TEXT NOT NULL,
  remarks TEXT,
  sync_token TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  date_text TEXT,
  is_new INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_cgpa_batch
ON student_cgpa(batch_year);

CREATE INDEX IF NOT EXISTS idx_academic_summary_batch
ON student_academic_summary(batch_year);

CREATE INDEX IF NOT EXISTS idx_semester_student
ON semester_results(student_id, semester_number, row_order);

CREATE INDEX IF NOT EXISTS idx_semester_batch_sem
ON semester_results(batch_year, semester_number, row_order);

CREATE INDEX IF NOT EXISTS idx_toppers_batch_category
ON toppers(batch_year, category, rank_order);

CREATE INDEX IF NOT EXISTS idx_honors_minor_eligibility_batch
ON honors_minor_eligibility(batch_year, degree_type);

CREATE INDEX IF NOT EXISTS idx_notifications_order
ON notifications(sort_order, id);
