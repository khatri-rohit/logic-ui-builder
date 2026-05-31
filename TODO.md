Make Studio changes for UI,
aadd Reminder for Future Session

Invoice / Receipt History (answer #13)
Users expect to see past invoices and receipts in their billing dashboard. This requires:

- Storing invoice objects from Razorpay webhooks (invoice.paid events)
- A new Invoice table with razorpayInvoiceId, subscriptionId, amount, status, periodStart, periodEnd, pdfUrl
- A GET /api/billing/invoices endpoint
- UI list in BillingPageClient
