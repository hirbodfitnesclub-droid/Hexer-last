
import { supabase } from './supabaseClient';
import { Project, Task, Note, Habit } from '../types';

interface BackupMeta {
    version: number;
    timestamp: string;
    app: string;
}

interface BackupDataPayload {
    projects: Project[];
    tasks: Task[];
    notes: Note[];
    habits: Habit[];
    habit_completions: { id: string; user_id: string; habit_id: string; completion_date: string }[];
}

interface BackupFile {
    meta: BackupMeta;
    data: BackupDataPayload;
}

const CURRENT_VERSION = 1;
const APP_NAME = "HexerAI";

export const exportUserData = async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("کاربر وارد نشده است.");

    const userId = user.id;

    // دریافت تمامی اطلاعات به صورت موازی
    const [projects, tasks, notes, habits, habitCompletions] = await Promise.all([
        supabase.from('projects').select('*').eq('user_id', userId),
        supabase.from('tasks').select('*').eq('user_id', userId),
        supabase.from('notes').select('*').eq('user_id', userId),
        supabase.from('habits').select('*').eq('user_id', userId),
        supabase.from('habit_completions').select('*').eq('user_id', userId)
    ]);

    if (projects.error) throw new Error(`خطا در دریافت پروژه‌ها: ${projects.error.message}`);
    if (tasks.error) throw new Error(`خطا در دریافت کارها: ${tasks.error.message}`);
    if (notes.error) throw new Error(`خطا در دریافت یادداشت‌ها: ${notes.error.message}`);
    if (habits.error) throw new Error(`خطا در دریافت عادت‌ها: ${habits.error.message}`);
    if (habitCompletions.error) throw new Error(`خطا در دریافت تاریخچه عادت‌ها: ${habitCompletions.error.message}`);

    // ساختار فایل پشتیبان طبق استاندارد درخواستی (Meta + Data)
    const backupFile: BackupFile = {
        meta: {
            version: CURRENT_VERSION,
            timestamp: new Date().toISOString(),
            app: APP_NAME
        },
        data: {
            projects: projects.data as Project[],
            tasks: tasks.data as Task[],
            notes: notes.data as Note[],
            habits: habits.data as Habit[],
            habit_completions: habitCompletions.data as any[]
        }
    };

    // ایجاد و دانلود فایل
    const blob = new Blob([JSON.stringify(backupFile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hexer_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const importUserData = async (file: File): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("کاربر وارد نشده است.");
    const userId = user.id;

    const text = await file.text();
    let backupFile: BackupFile;
    
    try {
        backupFile = JSON.parse(text);
    } catch (e) {
        throw new Error("فایل انتخاب شده یک JSON معتبر نیست.");
    }

    // اعتبارسنجی اولیه ساختار
    if (!backupFile.meta || !backupFile.data || backupFile.meta.app !== APP_NAME) {
         throw new Error("ساختار فایل پشتیبان معتبر نیست یا مربوط به این برنامه نمی‌باشد.");
    }
    
    // در آینده می‌توان اینجا لاجیک مایگریشن ورژن‌های قدیمی را اضافه کرد
    if (backupFile.meta.version > CURRENT_VERSION) {
        throw new Error(`نسخه فایل پشتیبان (${backupFile.meta.version}) از نسخه فعلی برنامه (${CURRENT_VERSION}) بالاتر است. لطفاً برنامه را آپدیت کنید.`);
    }

    const { data } = backupFile;

    // تابع کمکی برای تنظیم شناسه کاربر جاری روی داده‌های ورودی (Sanitization)
    // این کار حیاتی است تا داده‌ها به نام کاربر فعلی ثبت شوند، نه کاربری که بکاپ گرفته
    const sanitize = (items: any[]) => items.map(item => ({ ...item, user_id: userId }));

    // ترتیب وارد کردن داده‌ها بسیار مهم است (Foreign Key Constraints)
    
    // 1. پروژه‌ها (چون وابستگی ندارند و پدر تسک‌ها و یادداشت‌ها هستند)
    if (data.projects && data.projects.length > 0) {
        const { error } = await supabase.from('projects').upsert(sanitize(data.projects));
        if (error) throw new Error(`خطا در وارد کردن پروژه‌ها: ${error.message}`);
    }

    // 2. کارها (ممکن است به پروژه وابسته باشند)
    if (data.tasks && data.tasks.length > 0) {
        const { error } = await supabase.from('tasks').upsert(sanitize(data.tasks));
        if (error) throw new Error(`خطا در وارد کردن کارها: ${error.message}`);
    }

    // 3. یادداشت‌ها (ممکن است به پروژه وابسته باشند)
    if (data.notes && data.notes.length > 0) {
        const { error } = await supabase.from('notes').upsert(sanitize(data.notes));
        if (error) throw new Error(`خطا در وارد کردن یادداشت‌ها: ${error.message}`);
    }

    // 4. عادت‌ها (مستقل)
    if (data.habits && data.habits.length > 0) {
        const { error } = await supabase.from('habits').upsert(sanitize(data.habits));
        if (error) throw new Error(`خطا در وارد کردن عادت‌ها: ${error.message}`);
    }

    // 5. تاریخچه عادت‌ها (وابسته به عادت‌ها)
    if (data.habit_completions && data.habit_completions.length > 0) {
        const { error } = await supabase.from('habit_completions').upsert(sanitize(data.habit_completions));
        if (error) throw new Error(`خطا در وارد کردن تاریخچه عادت‌ها: ${error.message}`);
    }
};
