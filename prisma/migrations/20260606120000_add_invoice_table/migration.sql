-- CreateInvoice
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "razorpayInvoiceId" TEXT NOT NULL,
    "razorpaySubscriptionId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "shortUrl" TEXT,
    "receipt" TEXT,
    "invoiceNumber" TEXT,
    "description" TEXT,
    "lineItems" JSONB,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_razorpayInvoiceId_key" ON "Invoice"("razorpayInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_userId_paidAt_idx" ON "Invoice"("userId", "paidAt");

-- CreateIndex
CREATE INDEX "Invoice_razorpaySubscriptionId_idx" ON "Invoice"("razorpaySubscriptionId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
