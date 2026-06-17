-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT', 'DAILY_IN', 'DAILY_OUT');

-- CreateEnum
CREATE TYPE "DailyLogStatus" AS ENUM ('OPEN', 'CLOSED', 'REOPENED', 'AUTO_ADJUSTED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'LOST');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHECK', 'ESEWA', 'KHALTI', 'IME_PAY', 'FONEPAY', 'OTHER');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RecipeIngredientCategory" AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'OTHER_DIRECT');

-- CreateEnum
CREATE TYPE "RecipeOverheadCategory" AS ENUM ('FUEL', 'ELECTRICITY', 'OTHER_OVERHEAD');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sellingPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "piecesPerPacket" INTEGER,
    "currentStock" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "yieldQty" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "deductionPct" DECIMAL(5,2) NOT NULL DEFAULT 35,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "costCategory" "RecipeIngredientCategory" NOT NULL DEFAULT 'RAW_MATERIAL',

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeOverheadLine" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "lineCost" DECIMAL(10,2) NOT NULL,
    "category" "RecipeOverheadCategory" NOT NULL DEFAULT 'FUEL',

    CONSTRAINT "RecipeOverheadLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "quantityBefore" DECIMAL(10,3) NOT NULL,
    "quantityAfter" DECIMAL(10,3) NOT NULL,
    "unitCost" DECIMAL(10,2),
    "notes" TEXT,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "isAdminOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "logDate" DATE NOT NULL,
    "status" "DailyLogStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "autoAdjustedAt" TIMESTAMP(3),
    "autoAdjustedBy" TEXT,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLogItem" (
    "id" TEXT NOT NULL,
    "dailyLogId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "openingQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "producedQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "usedQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "soldQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "freshReturnQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "wasteQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "damagedQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "closingQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "pan" TEXT,
    "openingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "receivedQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturn" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturnItem" (
    "id" TEXT NOT NULL,
    "purchaseReturnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PurchaseReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "receiptUrl" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPaymentAllocation" (
    "id" TEXT NOT NULL,
    "vendorPaymentId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "VendorPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "vatTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "invoiceUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLineItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "categoryId" TEXT,
    "unitId" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "grossAmount" DECIMAL(10,2) NOT NULL,
    "vatPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "excisePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "exciseAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PurchaseLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "pan" TEXT,
    "dob" TIMESTAMP(3),
    "citizenshipNo" TEXT,
    "photo" TEXT,
    "openingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "commissionPct" DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "commissionPct" DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    "commissionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "factoryAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesReturn" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "notes" TEXT,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "returnType" TEXT NOT NULL DEFAULT 'WASTE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesReturnItem" (
    "id" TEXT NOT NULL,
    "salesReturnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "SalesReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPayment" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "citizenshipId" TEXT,
    "address" TEXT,
    "departmentId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "basicSalary" DECIMAL(10,2) NOT NULL,
    "openingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "clerkUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryWithdrawal" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filedBy" TEXT,
    "givenBy" TEXT,
    "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "photoUrl" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollItem" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "basicSalary" DECIMAL(10,2) NOT NULL,
    "carryoverIn" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "allowances" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "PayrollItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollDeduction" (
    "id" TEXT NOT NULL,
    "payrollItemId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "givenBy" TEXT,
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "photoUrl" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawalId" TEXT,

    CONSTRAINT "PayrollDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'SUBMITTED',
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "submittedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "phone" TEXT,
    "reason" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "receivedFrom" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "photoUrl" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptPayment" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "paidTo" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "photoUrl" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ReceiptPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "name" TEXT NOT NULL,
    "nameShort" TEXT NOT NULL,
    "slogan" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "pan" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "established" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "cashOpeningBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCounter" (
    "prefix" TEXT NOT NULL,
    "nextVal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("prefix")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_productId_key" ON "Recipe"("productId");

-- CreateIndex
CREATE INDEX "Recipe_productId_idx" ON "Recipe"("productId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_productId_idx" ON "RecipeIngredient"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredient_recipeId_productId_key" ON "RecipeIngredient"("recipeId", "productId");

-- CreateIndex
CREATE INDEX "RecipeOverheadLine_recipeId_idx" ON "RecipeOverheadLine"("recipeId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_referenceId_idx" ON "StockMovement"("referenceId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "DailyLog_logDate_idx" ON "DailyLog"("logDate");

-- CreateIndex
CREATE INDEX "DailyLog_status_idx" ON "DailyLog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_logDate_key" ON "DailyLog"("logDate");

-- CreateIndex
CREATE INDEX "DailyLogItem_dailyLogId_idx" ON "DailyLogItem"("dailyLogId");

-- CreateIndex
CREATE INDEX "DailyLogItem_productId_idx" ON "DailyLogItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLogItem_dailyLogId_productId_key" ON "DailyLogItem"("dailyLogId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_orderNumber_key" ON "PurchaseOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_orderDate_idx" ON "PurchaseOrder"("orderDate");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_returnNumber_key" ON "PurchaseReturn"("returnNumber");

-- CreateIndex
CREATE INDEX "PurchaseReturnItem_purchaseReturnId_idx" ON "PurchaseReturnItem"("purchaseReturnId");

-- CreateIndex
CREATE INDEX "SupplierPayment_purchaseOrderId_idx" ON "SupplierPayment"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- CreateIndex
CREATE INDEX "VendorPayment_supplierId_idx" ON "VendorPayment"("supplierId");

-- CreateIndex
CREATE INDEX "VendorPayment_paidAt_idx" ON "VendorPayment"("paidAt");

-- CreateIndex
CREATE INDEX "VendorPaymentAllocation_vendorPaymentId_idx" ON "VendorPaymentAllocation"("vendorPaymentId");

-- CreateIndex
CREATE INDEX "VendorPaymentAllocation_purchaseId_idx" ON "VendorPaymentAllocation"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_invoiceNo_key" ON "Purchase"("invoiceNo");

-- CreateIndex
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");

-- CreateIndex
CREATE INDEX "Purchase_date_idx" ON "Purchase"("date");

-- CreateIndex
CREATE INDEX "PurchaseLineItem_purchaseId_idx" ON "PurchaseLineItem"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseLineItem_productId_idx" ON "PurchaseLineItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_orderNumber_key" ON "SalesOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");

-- CreateIndex
CREATE INDEX "SalesOrder_orderDate_idx" ON "SalesOrder"("orderDate");

-- CreateIndex
CREATE INDEX "SalesOrderItem_salesOrderId_idx" ON "SalesOrderItem"("salesOrderId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_productId_idx" ON "SalesOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturn_returnNumber_key" ON "SalesReturn"("returnNumber");

-- CreateIndex
CREATE INDEX "SalesReturnItem_salesReturnId_idx" ON "SalesReturnItem"("salesReturnId");

-- CreateIndex
CREATE INDEX "CustomerPayment_salesOrderId_idx" ON "CustomerPayment"("salesOrderId");

-- CreateIndex
CREATE INDEX "CustomerPayment_customerId_idx" ON "CustomerPayment"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNo_key" ON "Employee"("employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_clerkUserId_key" ON "Employee"("clerkUserId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_clerkUserId_idx" ON "Employee"("clerkUserId");

-- CreateIndex
CREATE INDEX "SalaryWithdrawal_employeeId_idx" ON "SalaryWithdrawal"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryWithdrawal_takenAt_idx" ON "SalaryWithdrawal"("takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_month_year_key" ON "PayrollRun"("month", "year");

-- CreateIndex
CREATE INDEX "PayrollItem_payrollRunId_idx" ON "PayrollItem"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollItem_employeeId_idx" ON "PayrollItem"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollItem_payrollRunId_employeeId_key" ON "PayrollItem"("payrollRunId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollDeduction_withdrawalId_key" ON "PayrollDeduction"("withdrawalId");

-- CreateIndex
CREATE INDEX "PayrollDeduction_payrollItemId_idx" ON "PayrollDeduction"("payrollItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "AccessRequest_status_idx" ON "AccessRequest"("status");

-- CreateIndex
CREATE INDEX "AccessRequest_createdAt_idx" ON "AccessRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "Receipt_receivedAt_idx" ON "Receipt"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptPayment_paymentNumber_key" ON "ReceiptPayment"("paymentNumber");

-- CreateIndex
CREATE INDEX "ReceiptPayment_paidAt_idx" ON "ReceiptPayment"("paidAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeOverheadLine" ADD CONSTRAINT "RecipeOverheadLine_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLogItem" ADD CONSTRAINT "DailyLogItem_dailyLogId_fkey" FOREIGN KEY ("dailyLogId") REFERENCES "DailyLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLogItem" ADD CONSTRAINT "DailyLogItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentAllocation" ADD CONSTRAINT "VendorPaymentAllocation_vendorPaymentId_fkey" FOREIGN KEY ("vendorPaymentId") REFERENCES "VendorPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentAllocation" ADD CONSTRAINT "VendorPaymentAllocation_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLineItem" ADD CONSTRAINT "PurchaseLineItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLineItem" ADD CONSTRAINT "PurchaseLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_salesReturnId_fkey" FOREIGN KEY ("salesReturnId") REFERENCES "SalesReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryWithdrawal" ADD CONSTRAINT "SalaryWithdrawal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_payrollItemId_fkey" FOREIGN KEY ("payrollItemId") REFERENCES "PayrollItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "SalaryWithdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
