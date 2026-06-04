-- Temporarily revert: production Vercel still has old Prisma client compiled
-- with @@map("Customer"). Rename back so production works until new code deploys.
ALTER TABLE "Salesman" RENAME TO "Customer";
ALTER TABLE "SalesmanPayment" RENAME TO "CustomerPayment";
