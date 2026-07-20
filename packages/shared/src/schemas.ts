import { z } from "zod";
import { Priority, SystemRole, TaskStatus, Visibility } from "./enums";

export const registerSchema = z
  .object({
    fullName: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  assigneeId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  category: z.string().max(80).optional(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.NOT_STARTED),
  visibility: z.nativeEnum(Visibility).default(Visibility.PRIVATE),
  notes: z.string().max(5000).optional(),
  participantEmails: z.array(z.string().email()).optional(),
  force: z.boolean().optional(),
  overlapReason: z.string().max(500).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().omit({
  date: true,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  systemRole: SystemRole;
  timezone: string;
};
