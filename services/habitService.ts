import { supabase } from './supabaseClient';
import { Habit } from '../types';

type HabitInsert = Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completedDates'>;
type HabitUpdate = Partial<Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completedDates'>>;

interface HabitCompletion {
    habit_id: string;
    completion_date: string; // YYYY-MM-DD
}

export const getHabits = async (): Promise<Habit[]> => {
    // Select explicit columns from the habits table
    const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id, user_id, name, description, frequency, target_count, created_at, updated_at');

    if (habitsError) throw habitsError;

    // Calculate 90 days ago in Asia/Tehran timezone
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const ninetyDaysAgoStr = formatter.format(ninetyDaysAgo);

    const { data: completionsData, error: completionsError } = await supabase
        .from('habit_completions')
        .select('habit_id, completion_date')
        .gte('completion_date', ninetyDaysAgoStr);

    if (completionsError) throw completionsError;

    const completionsMap = new Map<string, string[]>();
    (completionsData as HabitCompletion[]).forEach(comp => {
        const dates = completionsMap.get(comp.habit_id) || [];
        dates.push(comp.completion_date);
        completionsMap.set(comp.habit_id, dates);
    });

    // Map the database response to include completion dates
    return (habitsData as Habit[]).map(habit => ({
        ...habit,
        completedDates: completionsMap.get(habit.id) || []
    }));
};

export const createHabit = async (habit: HabitInsert & { id?: string }, id?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const finalId = id || habit.id;
    const habitForDb: any = {
      ...habit,
      user_id: user.id
    };
    if (finalId) {
      habitForDb.id = finalId;
    }

    const { data, error } = await supabase
        .from('habits')
        .upsert([habitForDb], { onConflict: 'id' })
        .select()
        .single();
        
    if (error) throw error;
    
    // The returned object now matches the Habit type directly, just need to add empty completions array
    return { 
        ...data, 
        completedDates: [] 
    } as Habit;
};

export const updateHabit = async (id: string, updates: HabitUpdate) => {
    const { data, error } = await supabase
        .from('habits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    
    if (error) throw error;
    // Note: this doesn't return completions. Refetch is handled by subscriptions in App.tsx.
    return {
        ...data,
        completedDates: [], // Assume completions are handled by the main state
    } as Habit;
};

export const deleteHabit = async (id: string) => {
    const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id);
        
    if (error) throw error;
};

export const toggleHabitCompletion = async (habitId: string, date: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Check if completion exists for this date
    const { data: existing, error: selectError } = await supabase
        .from('habit_completions')
        .select('id')
        .eq('habit_id', habitId)
        .eq('completion_date', date)
        .single();

    if (selectError && selectError.code !== 'PGRST116') { // PGRST116: no rows found
        throw selectError;
    }

    if (existing) {
        // Delete it
        const { error: deleteError } = await supabase
            .from('habit_completions')
            .delete()
            .eq('id', existing.id);
        if (deleteError) throw deleteError;
    } else {
        // Create it
        const { error: insertError } = await supabase
            .from('habit_completions')
            .insert({
                user_id: user.id,
                habit_id: habitId,
                completion_date: date,
            });
        if (insertError) throw insertError;
    }
};

export const setHabitCompletion = async (habitId: string, date: string, completed: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    if (completed) {
        // Insert with ON CONFLICT DO NOTHING
        const { error } = await supabase
            .from('habit_completions')
            .upsert([{
                user_id: user.id,
                habit_id: habitId,
                completion_date: date
            }], { onConflict: 'habit_id,completion_date' });
            
        if (error) throw error;
    } else {
        // Delete
        const { error } = await supabase
            .from('habit_completions')
            .delete()
            .eq('habit_id', habitId)
            .eq('completion_date', date);
            
        if (error) throw error;
    }
};