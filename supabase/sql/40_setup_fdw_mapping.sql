-- این فایل صرفاً جهت مستندسازی زیرساخت است و در پروداکشن با رمز واقعی اجرا شده است
DROP USER MAPPING IF EXISTS FOR postgres SERVER analytics_srv;
DROP USER MAPPING IF EXISTS FOR authenticated SERVER analytics_srv;

CREATE USER MAPPING FOR postgres 
SERVER analytics_srv 
OPTIONS (user 'fdw_reader', password 'DUMMY_PASSWORD_DO_NOT_COMMIT');

CREATE USER MAPPING FOR authenticated 
SERVER analytics_srv 
OPTIONS (user 'fdw_reader', password 'DUMMY_PASSWORD_DO_NOT_COMMIT');
