import React from 'react';
import {
  LayoutGridIcon,
  ListChecksIcon,
  SparklesIcon,
  NotebookIcon,
  BriefcaseIcon
} from '../../../components/icons';

export interface OnboardingSlide {
  id: number;
  Icon: React.FC<{ className?: string }>;
  title: string;
  body: string;
  highlight?: boolean;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 1,
    Icon: LayoutGridIcon,
    title: 'داشبورد؛ اتاق‌فرمانِ تو',
    body: 'اینجا همه‌چیز جلوی چشمته. کارهای امروز، زنجیره‌ی عادت‌ها و یادداشت‌های مهمت رو یه جا ببین و روندِ پیشرفتت رو چک کن.'
  },
  {
    id: 2,
    Icon: ListChecksIcon,
    title: 'کارها روی غلتک!',
    body: 'تسکهات رو بساز، براشون یادآور پیامکی بذار و به پروژه‌ها وصلشون کن. با هکسر دیگه هیچ ددلاینی از دستت در نمیره.'
  },
  {
    id: 3,
    Icon: SparklesIcon,
    title: 'دستیارِ ذهن‌خوانِ تو',
    body: 'فقط ویس بده! هکسر حرفت رو می‌فهمه و تسک می‌سازه. با «سرچ معنایی» هم فقط کافیه منظورت رو بگی تا دقیقاً همون چیزی که می‌خوای رو برات پیدا کنه.',
    highlight: true
  },
  {
    id: 4,
    Icon: NotebookIcon,
    title: 'خداحافظی با «سیو مسیج»',
    body: 'ایده‌ها، لینک‌ها و صورتجلسه‌ها رو اینجا بنویس و تگ بزن. هر یادداشتی رو می‌تونی مستقیم به یه تسک یا پروژه‌ی خاص وصل کنی تا گم نشه.'
  },
  {
    id: 5,
    Icon: BriefcaseIcon,
    title: 'سنگ‌های بزرگ رو خُرد کن!',
    body: 'پروژه‌های سنگین رو به قدم‌های کوچیک بشکن. کارهات رو بهش وصل کن و نمودارِ پیشرفتت رو ببین تا انگیزه‌ت وسط راه نیفته.'
  }
];
