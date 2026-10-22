import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SignOut } from "@phosphor-icons/react";
import { toast } from "sonner";

import { outlinePill } from "@/components/customer/customer-ui";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer, type CustomerProfile } from "@/lib/customer";
import { SkeletonForm } from "@/components/ui/skeletons";

export const Route = createFileRoute("/account/settings")({
  head: () => ({ meta: [{ title: "Settings — Bookly" }] }),
  component: SettingsPage,
});

type Pref = "email_reminders" | "marketing_emails";
const PREFS: { key: Pref; title: string; text: string }[] = [
  {
    key: "email_reminders",
    title: "Appointment emails",
    text: "Confirmations, reminders and changes to your bookings.",
  },
  {
    key: "marketing_emails",
    title: "Offers and news",
    text: "Deals and updates from salons you've booked with.",
  },
];

function SettingsPage() {
  const customer = useCustomer();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const me = customer.data;

  const update = useMutation({
    mutationFn: async ({ key, value }: { key: Pref; value: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update(
          key === "email_reminders" ? { email_reminders: value } : { marketing_emails: value },
        )
        .eq("id", me!.id);
      if (error) throw error;
    },
    onMutate: ({ key, value }) => {
      queryClient.setQueryData<CustomerProfile | null>(["customer"], (old) =>
        old ? { ...old, [key]: value } : old,
      );
    },
    onSuccess: () => toast.success("Preferences saved"),
    onError: () => {
      toast.error("Couldn't save that change");
      void queryClient.invalidateQueries({ queryKey: ["customer"] });
    },
  });

  if (!me) return <SkeletonForm fields={3} label="Loading settings" />;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-display font-semibold">Settings</h1>
      <section className="rounded-2xl bg-card p-6 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <h2 className="text-title font-semibold">Notification preferences</h2>
        <p className="mt-1 text-body text-muted-foreground">
          Choose which emails you get. Messages go to {me.email}.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {PREFS.map((pref) => (
            <li key={pref.key} className="flex items-center justify-between gap-4 py-4">
              <label htmlFor={pref.key} className="min-w-0">
                <span className="block text-body font-semibold">{pref.title}</span>
                <span className="block text-caption text-muted-foreground">{pref.text}</span>
              </label>
              <Switch
                id={pref.key}
                checked={me[pref.key]}
                onCheckedChange={(value) => update.mutate({ key: pref.key, value })}
              />
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl bg-card p-6 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <h2 className="text-title font-semibold">Login and security</h2>
        <p className="mt-1 text-body text-muted-foreground">
          You sign in with a link sent to {me.email}, so there&apos;s no password to remember.
        </p>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            queryClient.clear();
            void navigate({ to: "/discover" });
          }}
          className={`${outlinePill} mt-4`}
        >
          <SignOut size={18} /> Log out
        </button>
      </section>
    </div>
  );
}
