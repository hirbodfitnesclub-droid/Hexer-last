// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  isEditableTarget,
  shouldAutoOpenOnExternalQuery,
  shouldCloseOnBlur,
  shouldCloseOnEscape,
} from '../../features/tasks/components/ExpandableSearch';

describe('expandable search state machine (Tasks desktop)', () => {
  it('auto-opens when an external query arrives while closed', () => {
    expect(shouldAutoOpenOnExternalQuery({ isOpen: false, query: 'خرید' })).toBe(true);
    expect(shouldAutoOpenOnExternalQuery({ isOpen: false, query: '   ' })).toBe(false);
    expect(shouldAutoOpenOnExternalQuery({ isOpen: true, query: 'خرید' })).toBe(false);
  });

  it('stays open on blur when a query exists, closes only when empty', () => {
    expect(shouldCloseOnBlur({ query: '' })).toBe(true);
    expect(shouldCloseOnBlur({ query: '   ' })).toBe(true);
    expect(shouldCloseOnBlur({ query: 'گزارش' })).toBe(false);
  });

  it('escape closes only when empty (otherwise the query is cleared and it stays open)', () => {
    expect(shouldCloseOnEscape({ query: '' })).toBe(true);
    expect(shouldCloseOnEscape({ query: 'جلسه' })).toBe(false);
  });

  it('ignores the "/" shortcut while typing inside editable fields', () => {
    const input = document.createElement('input');
    const div = document.createElement('div');
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(div)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);

    const textarea = document.createElement('textarea');
    expect(isEditableTarget(textarea)).toBe(true);
  });
});
