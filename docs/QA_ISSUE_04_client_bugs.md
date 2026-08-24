# 🐛 پیشنویس مورد اصلاحی ۰۴ — باگ‌های کلاینت (تأییدشده توسط subagent + ممیزی)

**تاریخ ثبت:** 2026-08-23
**وضعیت:** ✅ فیکس A/B/C/E نوشته شد (2026-08-24، typecheck و تست سبز — منتظر merge). مورد D جدا شد → [OFFLINE_SYNC_V2_SHELVED.md](OFFLINE_SYNC_V2_SHELVED.md). موارد F–I فعلاً باز.
**کشف:** فاز ۱.۵ (سه باگ اول) → بازتأیید دقیق‌تر توسط subagent client-integration-qa در این فاز

---

## 🔴 A. تأیید گروهی پیشنهادها آیتم‌های شکست‌خورده را هم «approved» می‌کند
**ChatView.tsx:498-531** — بازتأیید مستقل main session ✅

وقتی یکی از proposalها در ذخیره خطا می‌دهد، `catch` فقط `console.error` می‌زند؛ سپس خط ۵۲۹ بی‌قیدوشرط همه‌ی pendingها را approved علامت می‌زند. کارتِ proposal ناموفق از UI حذف می‌شود و **پیش‌نویس کاربر برای همیشه گم می‌شود** (فقط toast تعداد موفق‌ها را می‌گوید).

```
} catch (err) { console.error('Error approving bulk item:', err); }
...
setActiveProposals(prev => prev.map(p => p.status === 'pending' ? {...p, status:'approved'} : p));
```

## ⚠️ B. نتیجه‌ی AI بعد از refresh غایب است (persist نشدن در IndexedDB)
**useDataManager.ts:1162-1217** — تأیید مجدد ✅

`injectAIProposalResult` فقط state React را آپدیت می‌کند؛ برخلاف همه‌ی CRUD های دیگر، `saveSnapshot` صدا نمی‌زند. entity ساخته‌شده توسط AI بعد از refresh تا اتمام revalidation غایب است. (شدت از 🔴 به ⚠️ تخفیف یافت چون سرور-side ساخته می‌شود و معمولاً برمی‌گردد.)

## ⚠️ C. نشت object URL صوتی — بدتر از ادعای قبلی
**ChatView.tsx:951-955** — تأیید و تشدید ✅

`URL.createObjectURL(recordedAudio)` داخل render است نه mount یک‌باره → هر re-render یک URL جدید. `revokeObjectURL` تقریباً هیچ‌جا استفاده نشده (فقط backupService).

## ⚠️ D. Offline Sync V2 مرده است — legacy outbox باگ overwrite دارد
**services/offline/operationQueue.ts + conflicts.ts**

هر دو ماژول جدید فقط توسط تست‌هایشان import می‌شوند — production هنوز مسیر legacy (`outbox.ts`) را استفاده میکند که:
- دو ویرایش متوالی آفلاین روی یک تسک همدیگر را overwrite می‌کنند (کلید entityId)
- `remapTempId` متن یادداشتی که اتفاقاً حاوی tempId باشد را خراب می‌کند
- storeهای `operations`/`tempIdMap` در IndexedDB ساخته شده ولی هیچ‌چیز در آن‌ها نمی‌نویسد

## ⚠️ E. حذف due_date در تسک تکراری بسته به flag دو رفتار مختلف دارد
**TaskEditorModal.tsx:371-387 vs migration 20260820161500:237**

مسیر RPC جدید (recurrence_rpc_v2) به‌خاطر spread شرطی کلید `due_date` را نمی‌فرستد و SQL قدیم را نگه می‌دارد؛ مسیر fallback همان حذف را واقعاً اعمال می‌کند. کاربر UI را «حذف‌شده» می‌بیند ولی تاریخ سر جایش است.

## سایر موارد جزئی‌تر (ℹ️)
- **F:** race پنجره‌ی undo حذف: کلیک لغو بین ثانیه ۳ تا ۵ → UI زنده ولی DB حذف‌شده (useDataManager.ts:784-821)
- **G:** دکمه‌ی undo مصرف‌شده بعد از refresh دوباره ظاهر می‌شود → کلیک = پیام 409 (ChatView.tsx:580)
- **H:** supabaseClient حالا بدون env کاملاً fail-fast می‌شود — ریسک دیپلوی، نه auth (نکته‌ی مثبت: anon key hardcoded قبلی حذف شده ولی از git history قابل بازیابی است → توصیه rotate)
- **I:** HabitEditorModal dead component است (App از HabitManagerModal استفاده می‌کند)

---

## اولویت پیشنهادی
1. فیکس A (چند خط: فقط successful ها را approved کن، failed ها pending بمانند + retry)
2. فیکس B (saveSnapshot در injectAIProposalResult)
3. تصمیم محصولی: یا operationQueue v2 را وصل کن یا فعلاً حذفش کن تا اعتماد کاذب نسازد
4. فیکس C/E در همان PR کلاینت
