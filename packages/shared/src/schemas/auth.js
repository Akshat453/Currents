import { z } from "zod";

export const emailSchema = z.string().trim().email().toLowerCase();
export const passwordSchema = z
  .string()
  .min(8)
  .max(72)
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[0-9]/, "Add a number")
  .regex(/[^A-Za-z0-9]/, "Add a symbol");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(20).optional().or(z.literal(""))
});
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password")
});
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema
});
