-- این فایل صرفاً جهت مستندسازی زیرساخت است و در پروداکشن با رمز واقعی اجرا شده است
CREATE ROLE fdw_reader WITH LOGIN PASSWORD 'DUMMY_PASSWORD_DO_NOT_COMMIT';
GRANT CONNECT ON DATABASE postgres TO fdw_reader;
GRANT USAGE ON SCHEMA public TO fdw_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO fdw_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO fdw_reader;
