-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'DE',
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "description" TEXT,
    "locationId" TEXT NOT NULL,
    CONSTRAINT "Resource_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Grant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "label" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceEntityId" TEXT,
    "pidSubject" TEXT,
    "pidFirstName" TEXT,
    "pidFamilyName" TEXT,
    "pidBirthdate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inviteToken" TEXT,
    "credentialId" TEXT,
    CONSTRAINT "Grant_resourceEntityId_fkey" FOREIGN KEY ("resourceEntityId") REFERENCES "Resource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Grant" ("createdAt", "credentialId", "id", "inviteToken", "label", "pidBirthdate", "pidFamilyName", "pidFirstName", "pidSubject", "resourceId", "status", "updatedAt") SELECT "createdAt", "credentialId", "id", "inviteToken", "label", "pidBirthdate", "pidFamilyName", "pidFirstName", "pidSubject", "resourceId", "status", "updatedAt" FROM "Grant";
DROP TABLE "Grant";
ALTER TABLE "new_Grant" RENAME TO "Grant";
CREATE UNIQUE INDEX "Grant_inviteToken_key" ON "Grant"("inviteToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Resource_identifier_key" ON "Resource"("identifier");
