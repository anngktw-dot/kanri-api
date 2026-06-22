INSERT INTO "statuses" ("name", "position")
VALUES ('review', 3)
ON CONFLICT ("name") DO UPDATE SET "position" = EXCLUDED."position";

UPDATE "statuses"
SET "position" = 4
WHERE "name" = 'done';
