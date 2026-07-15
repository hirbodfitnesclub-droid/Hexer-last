# فاز O — درمان ریشه‌ای مسیر به‌روزرسانی تسک [DONE]

> دو باگ باز پس از فاز N. جزئیات کامل: `PROJECT.md` §O ، `ARCHITECTURE.md` §O ، `tasks.md` فاز O.

## وضعیت
- [x] O-1 Canonical whitelist در `services/taskService.updateTask`
- [x] O-2 حذف `setEditingTask(null)` اجباری از `TasksView.handleSaveTask` پس از save معتبر
- [x] O-3 builder/minimal payload + close-on-success در `TaskEditorModal`

## خلاصه اجرا
1. **O-1** — `sanitizeTaskUpdate` + allowlist؛ `.select` هم‌تراز `getTasks` (بدون `*`).
2. **O-2** — `TasksView.handleSaveTask` دیگر بعد از update/create اتومات close نمی‌کند؛ update حتی بدون title (partial) مجاز است.
3. **O-3** — `buildTaskWritePayload`؛ toggleها minimal patch؛ `onClose` فقط بعد از success.
4. **مکمل** — `useDataManager.updateTask` روی خطای غیر-retry `throw` می‌کند تا مودال روی fail باز بماند.

## ترتیب انجام‌شده
O-1 → O-2 → O-3

## فایل‌های تغییر کرده
- `services/taskService.ts`
- `features/tasks/TasksView.tsx`
- `features/tasks/components/TaskEditorModal.tsx`
- `hooks/useDataManager.ts` (rethrow پس از toast خطا)
