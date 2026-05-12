DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum enum
    JOIN pg_type type ON enum.enumtypid = type.oid
    WHERE type.typname = 'UserRole'
      AND enum.enumlabel = 'ADMIN'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'ADMIN';
  END IF;
END $$;