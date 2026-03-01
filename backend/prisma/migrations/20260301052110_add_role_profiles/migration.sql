-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "supervisor" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabInchargeProfile" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "labName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LabInchargeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceProfile" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ServiceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_employeeId_key" ON "AdminProfile"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LabInchargeProfile_employeeId_key" ON "LabInchargeProfile"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "LabInchargeProfile_userId_key" ON "LabInchargeProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProfile_employeeId_key" ON "ServiceProfile"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProfile_userId_key" ON "ServiceProfile"("userId");

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabInchargeProfile" ADD CONSTRAINT "LabInchargeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProfile" ADD CONSTRAINT "ServiceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
