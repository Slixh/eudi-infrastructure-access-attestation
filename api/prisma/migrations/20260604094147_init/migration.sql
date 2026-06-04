-- CreateTable
CREATE TABLE "Grant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "label" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "pidSubject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inviteToken" TEXT,
    "credentialId" TEXT
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    CONSTRAINT "AccessLog_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Grant_inviteToken_key" ON "Grant"("inviteToken");
