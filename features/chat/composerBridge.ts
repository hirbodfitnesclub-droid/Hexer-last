export type DraftMessage = {
  text: string;
  imageFile?: Blob | null;
  audioFile?: Blob | null;
};

let pendingDraft: DraftMessage | null = null;

export const setPendingDraft = (draft: DraftMessage) => {
  pendingDraft = draft;
};

export const peekPendingDraft = (): DraftMessage | null => pendingDraft;

export const clearPendingDraft = () => {
  pendingDraft = null;
};
