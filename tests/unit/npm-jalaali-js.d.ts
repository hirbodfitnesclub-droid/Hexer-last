declare module 'npm:jalaali-js' {
  export function toJalaali(date: Date): { jy: number; jm: number; jd: number };
  export function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number };
  export function jalaaliMonthLength(jy: number, jm: number): number;
}
