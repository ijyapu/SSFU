import { z } from "zod";

export const expenseSchema = z.object({
  categoryId:    z.string().min(1, "Select a category"),
  description:   z.string().min(1, "Description is required").max(500),
  amount:        z.number().min(0.01, "Amount must be > 0").max(9_999_999),
  date:          z.string().min(1, "Date is required"),
  notes:         z.string().max(2000).optional(),
  attachmentUrl: z.string().url().max(2048).refine(
    (u) => u.startsWith("https://"),
    { message: "Must be an HTTPS URL" }
  ).optional().nullable(),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
