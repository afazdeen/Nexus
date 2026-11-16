'use client';

import { useEffect, useId, useRef } from 'react';
import { CloseIcon } from './close-icon';

type Props = {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
};

// Native <dialog> confirmation: focus trap, Esc to cancel and backdrop come from the browser.
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    ref.current?.showModal();
    // Start on the safe choice, so an accidental Enter doesn't confirm a destructive action.
    cancelRef.current?.focus();
  }, []);

  // Close through the native dialog so the browser returns focus to whatever opened it.
  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl p-0 backdrop:bg-black/40"
    >
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-m-1 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <CloseIcon />
          </button>
        </div>

        <div id={`${id}-message`} className="text-sm wrap-break-word text-slate-600">
          {message}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={close}
            className="rounded-md px-4 py-2 text-sm hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              onConfirm();
            }}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
