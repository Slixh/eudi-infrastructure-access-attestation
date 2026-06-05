-- Migration: Grant ↔ Resource many-to-many
-- Replaces the single resourceEntityId FK with an implicit join table.

-- 1. Create the join table
CREATE TABLE "_GrantToResource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_GrantToResource_A_fkey" FOREIGN KEY ("A") REFERENCES "Grant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_GrantToResource_B_fkey" FOREIGN KEY ("B") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "_GrantToResource_AB_unique" ON "_GrantToResource"("A", "B");
CREATE INDEX "_GrantToResource_B_index" ON "_GrantToResource"("B");

-- 2. Migrate existing data: move resourceEntityId links into the join table
INSERT INTO "_GrantToResource" ("A", "B")
SELECT "id", "resourceEntityId" FROM "Grant" WHERE "resourceEntityId" IS NOT NULL;

-- 3. Drop resourceEntityId column from Grant (SQLite requires table recreation)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Grant" (
    "id"           TEXT     NOT NULL PRIMARY KEY,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL,
    "label"        TEXT     NOT NULL,
    "resourceId"   TEXT     NOT NULL,
    "pidSubject"   TEXT,
    "pidFirstName" TEXT,
    "pidFamilyName" TEXT,
    "pidBirthdate" TEXT,
    "status"       TEXT     NOT NULL DEFAULT 'PENDING',
    "inviteToken"  TEXT,
    "credentialId" TEXT
);

INSERT INTO "new_Grant" (
    "id", "createdAt", "updatedAt", "label", "resourceId",
    "pidSubject", "pidFirstName", "pidFamilyName", "pidBirthdate",
    "status", "inviteToken", "credentialId"
)
SELECT
    "id", "createdAt", "updatedAt", "label", "resourceId",
    "pidSubject", "pidFirstName", "pidFamilyName", "pidBirthdate",
    "status", "inviteToken", "credentialId"
FROM "Grant";

DROP TABLE "Grant";
ALTER TABLE "new_Grant" RENAME TO "Grant";
CREATE UNIQUE INDEX "Grant_inviteToken_key" ON "Grant"("inviteToken");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
