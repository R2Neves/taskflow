import { Suspense } from "react";
import { NewTaskForm } from "./new-task-form";

export default function NewTaskPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-brand-700">Carregando…</p>
        </main>
      }
    >
      <NewTaskForm />
    </Suspense>
  );
}
