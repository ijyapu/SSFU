import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding SSFU database (setup data only)...\n");

  // ─────────────────────────────────────────────
  // UNITS OF MEASURE
  // ─────────────────────────────────────────────
  const units = await Promise.all([
    prisma.unit.upsert({ where: { name: "kg"     }, update: {}, create: { name: "kg"     } }),
    prisma.unit.upsert({ where: { name: "g"      }, update: {}, create: { name: "g"      } }),
    prisma.unit.upsert({ where: { name: "litre"  }, update: {}, create: { name: "litre"  } }),
    prisma.unit.upsert({ where: { name: "ml"     }, update: {}, create: { name: "ml"     } }),
    prisma.unit.upsert({ where: { name: "pcs"    }, update: {}, create: { name: "pcs"    } }),
    prisma.unit.upsert({ where: { name: "loaf"   }, update: {}, create: { name: "loaf"   } }),
    prisma.unit.upsert({ where: { name: "tray"   }, update: {}, create: { name: "tray"   } }),
    prisma.unit.upsert({ where: { name: "dozen"  }, update: {}, create: { name: "dozen"  } }),
    prisma.unit.upsert({ where: { name: "bag"    }, update: {}, create: { name: "bag"    } }),
    prisma.unit.upsert({ where: { name: "box"    }, update: {}, create: { name: "box"    } }),
  ]);
  console.log(`✅ Units: ${units.length}`);

  // ─────────────────────────────────────────────
  // PRODUCT CATEGORIES
  // ─────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.category.upsert({ where: { name: "Raw Materials" }, update: {}, create: { name: "Raw Materials" } }),
    prisma.category.upsert({ where: { name: "Packaging"     }, update: {}, create: { name: "Packaging"     } }),
  ]);
  console.log(`✅ Product categories: ${categories.length}`);

  // ─────────────────────────────────────────────
  // EXPENSE CATEGORIES
  // ─────────────────────────────────────────────
  const expenseCategories = await Promise.all([
    prisma.expenseCategory.upsert({ where: { name: "Ingredients & Raw Materials"    }, update: {}, create: { name: "Ingredients & Raw Materials"    } }),
    prisma.expenseCategory.upsert({ where: { name: "Utilities (Electricity & Water)"}, update: {}, create: { name: "Utilities (Electricity & Water)"} }),
    prisma.expenseCategory.upsert({ where: { name: "Equipment Maintenance"          }, update: {}, create: { name: "Equipment Maintenance"          } }),
    prisma.expenseCategory.upsert({ where: { name: "Packaging Supplies"             }, update: {}, create: { name: "Packaging Supplies"             } }),
    prisma.expenseCategory.upsert({ where: { name: "Delivery & Transport"           }, update: {}, create: { name: "Delivery & Transport"           } }),
    prisma.expenseCategory.upsert({ where: { name: "Marketing & Promotions"         }, update: {}, create: { name: "Marketing & Promotions"         } }),
    prisma.expenseCategory.upsert({ where: { name: "Staff Welfare"                  }, update: {}, create: { name: "Staff Welfare"                  } }),
    prisma.expenseCategory.upsert({ where: { name: "Miscellaneous"                  }, update: {}, create: { name: "Miscellaneous"                  } }),
  ]);
  console.log(`✅ Expense categories: ${expenseCategories.length}`);

  // ─────────────────────────────────────────────
  // DEPARTMENTS
  // ─────────────────────────────────────────────
  const departments = await Promise.all([
    prisma.department.upsert({ where: { name: "Management"            }, update: {}, create: { name: "Management"            } }),
    prisma.department.upsert({ where: { name: "Production"            }, update: {}, create: { name: "Production"            } }),
    prisma.department.upsert({ where: { name: "Sales & Distribution"  }, update: {}, create: { name: "Sales & Distribution"  } }),
    prisma.department.upsert({ where: { name: "Finance & Accounting"  }, update: {}, create: { name: "Finance & Accounting"  } }),
    prisma.department.upsert({ where: { name: "Store & Inventory"     }, update: {}, create: { name: "Store & Inventory"     } }),
    prisma.department.upsert({ where: { name: "Human Resources"       }, update: {}, create: { name: "Human Resources"       } }),
  ]);
  console.log(`✅ Departments: ${departments.length}`);

  console.log("\n✅ Seeding complete. No demo products, suppliers, salesmen, or employees were inserted.");
  console.log("   Add real SSFU business data from the app UI.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
