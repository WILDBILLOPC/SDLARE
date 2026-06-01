"use client";

type DeleteButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  label?: string;
  confirmMessage?: string;
};

// Renders a destructive submit button guarded by a browser confirm dialog.
export function DeleteButton({
  action,
  id,
  label = "Delete",
  confirmMessage = "Are you sure? This cannot be undone.",
}: DeleteButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex items-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 shadow-sm transition hover:bg-rose-50"
      >
        {label}
      </button>
    </form>
  );
}
