import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─────────────────────────────────────────────
  // UNITS OF MEASURE
  // ─────────────────────────────────────────────
  const units = await Promise.all([
    prisma.unit.upsert({ where: { name: "kg" }, update: {}, create: { name: "kg" } }),
    prisma.unit.upsert({ where: { name: "g" }, update: {}, create: { name: "g" } }),
    prisma.unit.upsert({ where: { name: "litre" }, update: {}, create: { name: "litre" } }),
    prisma.unit.upsert({ where: { name: "ml" }, update: {}, create: { name: "ml" } }),
    prisma.unit.upsert({ where: { name: "pcs" }, update: {}, create: { name: "pcs" } }),
    prisma.unit.upsert({ where: { name: "loaf" }, update: {}, create: { name: "loaf" } }),
    prisma.unit.upsert({ where: { name: "tray" }, update: {}, create: { name: "tray" } }),
    prisma.unit.upsert({ where: { name: "dozen" }, update: {}, create: { name: "dozen" } }),
    prisma.unit.upsert({ where: { name: "bag" }, update: {}, create: { name: "bag" } }),
    prisma.unit.upsert({ where: { name: "box" }, update: {}, create: { name: "box" } }),
  ]);
  console.log(`✅ Units (${units.length})`);

  // ─────────────────────────────────────────────
  // PRODUCT CATEGORIES
  // ─────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.category.upsert({ where: { name: "Raw Materials" }, update: {}, create: { name: "Raw Materials" } }),
    prisma.category.upsert({ where: { name: "Packaging" }, update: {}, create: { name: "Packaging" } }),
  ]);
  console.log(`✅ Categories (${categories.length})`);

  // ─────────────────────────────────────────────
  // EXPENSE CATEGORIES
  // ─────────────────────────────────────────────
  const expenseCategories = await Promise.all([
    prisma.expenseCategory.upsert({ where: { name: "Ingredients & Raw Materials" }, update: {}, create: { name: "Ingredients & Raw Materials" } }),
    prisma.expenseCategory.upsert({ where: { name: "Utilities (Electricity & Water)" }, update: {}, create: { name: "Utilities (Electricity & Water)" } }),
    prisma.expenseCategory.upsert({ where: { name: "Equipment Maintenance" }, update: {}, create: { name: "Equipment Maintenance" } }),
    prisma.expenseCategory.upsert({ where: { name: "Packaging Supplies" }, update: {}, create: { name: "Packaging Supplies" } }),
    prisma.expenseCategory.upsert({ where: { name: "Delivery & Transport" }, update: {}, create: { name: "Delivery & Transport" } }),
    prisma.expenseCategory.upsert({ where: { name: "Marketing & Promotions" }, update: {}, create: { name: "Marketing & Promotions" } }),
    prisma.expenseCategory.upsert({ where: { name: "Staff Welfare" }, update: {}, create: { name: "Staff Welfare" } }),
    prisma.expenseCategory.upsert({ where: { name: "Miscellaneous" }, update: {}, create: { name: "Miscellaneous" } }),
  ]);
  console.log(`✅ Expense categories (${expenseCategories.length})`);

  // ─────────────────────────────────────────────
  // DEPARTMENTS
  // ─────────────────────────────────────────────
  const departments = await Promise.all([
    prisma.department.upsert({ where: { name: "Management" }, update: {}, create: { name: "Management" } }),
    prisma.department.upsert({ where: { name: "Production" }, update: {}, create: { name: "Production" } }),
    prisma.department.upsert({ where: { name: "Sales & Distribution" }, update: {}, create: { name: "Sales & Distribution" } }),
    prisma.department.upsert({ where: { name: "Finance & Accounting" }, update: {}, create: { name: "Finance & Accounting" } }),
    prisma.department.upsert({ where: { name: "Store & Inventory" }, update: {}, create: { name: "Store & Inventory" } }),
    prisma.department.upsert({ where: { name: "Human Resources" }, update: {}, create: { name: "Human Resources" } }),
  ]);
  console.log(`✅ Departments (${departments.length})`);

  const unitMap = Object.fromEntries(units.map((u) => [u.name, u.id]));
  const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));
  const deptMap = Object.fromEntries(departments.map((d) => [d.name, d.id]));

  // ─────────────────────────────────────────────
  // PRODUCTS
  // ─────────────────────────────────────────────
  const products = await Promise.all([
    // Raw Materials
    prisma.product.upsert({
      where: { sku: "RM-001" }, update: {},
      create: { sku: "RM-001", name: "All-Purpose Flour", categoryId: catMap["Raw Materials"], unitId: unitMap["kg"], costPrice: 2.50, sellingPrice: 0, reorderLevel: 100, currentStock: 500 },
    }),
    prisma.product.upsert({
      where: { sku: "RM-002" }, update: {},
      create: { sku: "RM-002", name: "Bread Flour", categoryId: catMap["Raw Materials"], unitId: unitMap["kg"], costPrice: 2.80, sellingPrice: 0, reorderLevel: 100, currentStock: 400 },
    }),
    prisma.product.upsert({
      where: { sku: "RM-003" }, update: {},
      create: { sku: "RM-003", name: "Caster Sugar", categoryId: catMap["Raw Materials"], unitId: unitMap["kg"], costPrice: 1.80, sellingPrice: 0, reorderLevel: 80, currentStock: 300 },
    }),
    prisma.product.upsert({
      where: { sku: "RM-004" }, update: {},
      create: { sku: "RM-004", name: "Unsalted Butter", categoryId: catMap["Raw Materials"], unitId: unitMap["kg"], costPrice: 9.50, sellingPrice: 0, reorderLevel: 50, currentStock: 120 },
    }),
    prisma.product.upsert({
      where: { sku: "RM-005" }, update: {},
      create: { sku: "RM-005", name: "Fresh Eggs", categoryId: catMap["Raw Materials"], unitId: unitMap["dozen"], costPrice: 3.20, sellingPrice: 0, reorderLevel: 30, currentStock: 80 },
    }),
    prisma.product.upsert({
      where: { sku: "RM-006" }, update: {},
      create: { sku: "RM-006", name: "Instant Yeast", categoryId: catMap["Raw Materials"], unitId: unitMap["kg"], costPrice: 12.00, sellingPrice: 0, reorderLevel: 10, currentStock: 25 },
    }),
    prisma.product.upsert({
      where: { sku: "RM-007" }, update: {},
      create: { sku: "RM-007", name: "Fine Salt", categoryId: catMap["Raw Materials"], unitId: unitMap["kg"], costPrice: 0.80, sellingPrice: 0, reorderLevel: 20, currentStock: 60 },
    }),
    prisma.product.upsert({
      where: { sku: "RM-008" }, update: {},
      create: { sku: "RM-008", name: "Full Cream Milk", categoryId: catMap["Raw Materials"], unitId: unitMap["litre"], costPrice: 1.50, sellingPrice: 0, reorderLevel: 40, currentStock: 100 },
    }),
    prisma.product.upsert({
      where: { sku: "RM-009" }, update: {},
      create: { sku: "RM-009", name: "Cocoa Powder", categoryId: catMap["Raw Materials"], unitId: unitMap["kg"], costPrice: 14.00, sellingPrice: 0, reorderLevel: 10, currentStock: 20 },
    }),
    prisma.product.upsert({
      where: { sku: "RM-010" }, update: {},
      create: { sku: "RM-010", name: "Baking Powder", categoryId: catMap["Raw Materials"], unitId: unitMap["kg"], costPrice: 5.00, sellingPrice: 0, reorderLevel: 5, currentStock: 15 },
    }),
    // Packaging
    prisma.product.upsert({
      where: { sku: "PK-001" }, update: {},
      create: { sku: "PK-001", name: "Bread Bag (Polythene)", categoryId: catMap["Packaging"], unitId: unitMap["pcs"], costPrice: 0.05, sellingPrice: 0, reorderLevel: 500, currentStock: 2000 },
    }),
    prisma.product.upsert({
      where: { sku: "PK-002" }, update: {},
      create: { sku: "PK-002", name: "Cake Box (Medium)", categoryId: catMap["Packaging"], unitId: unitMap["pcs"], costPrice: 0.40, sellingPrice: 0, reorderLevel: 100, currentStock: 300 },
    }),
    prisma.product.upsert({
      where: { sku: "PK-003" }, update: {},
      create: { sku: "PK-003", name: "Pastry Box (Small)", categoryId: catMap["Packaging"], unitId: unitMap["pcs"], costPrice: 0.25, sellingPrice: 0, reorderLevel: 200, currentStock: 600 },
    }),
  ]);
  console.log(`✅ Products (${products.length})`);

  // ─────────────────────────────────────────────
  // SUPPLIERS
  // ─────────────────────────────────────────────
  await prisma.supplier.upsert({
    where: { id: "seed-supplier-001" }, update: {},
    create: {
      id: "seed-supplier-001",
      name: "Golden Grain Mills Ltd",
      contactName: "Kweku Asante",
      email: "kweku@goldengrain.com",
      phone: "+233 24 111 2222",
      address: "Tema Industrial Area, Accra",
    },
  });
  await prisma.supplier.upsert({
    where: { id: "seed-supplier-002" }, update: {},
    create: {
      id: "seed-supplier-002",
      name: "FreshDairy Supplies",
      contactName: "Abena Owusu",
      email: "abena@freshdairy.com",
      phone: "+233 20 333 4444",
      address: "Spintex Road, Accra",
    },
  });
  await prisma.supplier.upsert({
    where: { id: "seed-supplier-003" }, update: {},
    create: {
      id: "seed-supplier-003",
      name: "Paks Packaging Solutions",
      contactName: "Yaw Mensah",
      email: "yaw@pakspack.com",
      phone: "+233 27 555 6666",
      address: "Kaneshie, Accra",
    },
  });
  console.log(`✅ Suppliers (3)`);

  // ─────────────────────────────────────────────
  // SALESMEN
  // ─────────────────────────────────────────────
  await prisma.salesman.upsert({
    where: { id: "seed-customer-001" }, update: {},
    create: {
      id: "seed-customer-001",
      name: "Ram Bahadur",
      phone: "+977 98 1234 5678",
      address: "Kathmandu",
      commissionPct: 25,
    },
  });
  await prisma.salesman.upsert({
    where: { id: "seed-customer-002" }, update: {},
    create: {
      id: "seed-customer-002",
      name: "Shyam Prasad",
      phone: "+977 98 2345 6789",
      address: "Lalitpur",
      commissionPct: 25,
    },
  });
  await prisma.salesman.upsert({
    where: { id: "seed-customer-003" }, update: {},
    create: {
      id: "seed-customer-003",
      name: "Hari Lal",
      phone: "+977 98 3456 7890",
      address: "Bhaktapur",
      commissionPct: 30,
    },
  });
  await prisma.salesman.upsert({
    where: { id: "seed-customer-004" }, update: {},
    create: {
      id: "seed-customer-004",
      name: "Gita Kumari",
      phone: null,
      address: null,
      commissionPct: 25,
    },
  });
  console.log(`✅ Salesmen (4)`);

  // ─────────────────────────────────────────────
  // EMPLOYEES
  // ─────────────────────────────────────────────
  await prisma.employee.upsert({
    where: { employeeNo: "EMP-001" }, update: {},
    create: {
      employeeNo: "EMP-001", firstName: "Kwame", lastName: "Asante",
      email: "kwame.asante@example.com", phone: "+233 24 100 0001",
      departmentId: deptMap["Management"], position: "General Manager",
      basicSalary: 5000.00, startDate: new Date("2020-01-01"),
    },
  });
  await prisma.employee.upsert({
    where: { employeeNo: "EMP-002" }, update: {},
    create: {
      employeeNo: "EMP-002", firstName: "Ama", lastName: "Boateng",
      email: "ama.boateng@example.com", phone: "+233 24 100 0002",
      departmentId: deptMap["Finance & Accounting"], position: "Accountant",
      basicSalary: 3200.00, startDate: new Date("2021-03-15"),
    },
  });
  await prisma.employee.upsert({
    where: { employeeNo: "EMP-003" }, update: {},
    create: {
      employeeNo: "EMP-003", firstName: "Yaw", lastName: "Darko",
      email: "yaw.darko@example.com", phone: "+233 24 100 0003",
      departmentId: deptMap["Sales & Distribution"], position: "Sales Representative",
      basicSalary: 2500.00, startDate: new Date("2022-06-01"),
    },
  });
  await prisma.employee.upsert({
    where: { employeeNo: "EMP-004" }, update: {},
    create: {
      employeeNo: "EMP-004", firstName: "Efua", lastName: "Mensah",
      email: "efua.mensah@example.com", phone: "+233 24 100 0004",
      departmentId: deptMap["Store & Inventory"], position: "Store Keeper",
      basicSalary: 2200.00, startDate: new Date("2021-09-10"),
    },
  });
  await prisma.employee.upsert({
    where: { employeeNo: "EMP-005" }, update: {},
    create: {
      employeeNo: "EMP-005", firstName: "Kofi", lastName: "Owusu",
      email: "kofi.owusu@example.com", phone: "+233 24 100 0005",
      departmentId: deptMap["Production"], position: "Head Baker",
      basicSalary: 3000.00, startDate: new Date("2020-03-01"),
    },
  });
  await prisma.employee.upsert({
    where: { employeeNo: "EMP-006" }, update: {},
    create: {
      employeeNo: "EMP-006", firstName: "Akosua", lastName: "Frimpong",
      email: "akosua.frimpong@example.com", phone: "+233 24 100 0006",
      departmentId: deptMap["Production"], position: "Pastry Chef",
      basicSalary: 2800.00, startDate: new Date("2021-01-05"),
    },
  });
  console.log(`✅ Employees (6)`);

  console.log("\n✅ Seeding complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
