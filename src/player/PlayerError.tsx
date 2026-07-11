import { IconAlert } from '@/lib/icons';

/** Friendly, actionable failure state — shown for both player tiers. */
export function PlayerError({ lessonId }: { lessonId: string }) {
  // Logged (again) here so the error is visible even if the caller forgot.
  console.error(`This video isn't available — lesson id: ${lessonId}`);
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-ink px-6 text-center text-white">
      <IconAlert size={32} className="text-amber-400" />
      <p className="text-lg font-bold">This video isn&apos;t available</p>
      <p className="text-sm text-white/80">
        Please tell your tutor. Mention the lesson name — that helps them fix
        it quickly.
      </p>
    </div>
  );
}
