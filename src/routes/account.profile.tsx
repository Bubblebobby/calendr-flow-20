import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { solidPill } from "@/components/customer/customer-ui";
import { supabase } from "@/integrations/supabase/client";
import { initialsOf, splitName, useCustomer } from "@/lib/customer";
import { cn } from "@/lib/utils";
import { SkeletonForm } from "@/components/ui/skeletons";

export const Route = createFileRoute("/account/profile")({
  head: () => ({ meta: [{ title: "Profile — Bookly" }] }),
  component: ProfilePage,
});

const GENDERS = [
  { value: "", label: "Prefer not to say" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "other", label: "Other" },
];

const field =
  "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

function ProfilePage() {
  const customer = useCustomer();
  const queryClient = useQueryClient();
  const me = customer.data;
  const [form, setForm] = useState({ first: "", last: "", phone: "", birthday: "", gender: "" });

  useEffect(() => {
    if (!me) return;
    const { first, last } = splitName(me.full_name);
    setForm({
      first,
      last,
      phone: me.phone ?? "",
      birthday: me.birthday ?? "",
      gender: me.gender ?? "",
    });
  }, [me]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: [form.first.trim(), form.last.trim()].filter(Boolean).join(" ") || null,
          phone: form.phone.trim() || null,
          birthday: form.birthday || null,
          gender: form.gender || null,
        })
        .eq("id", me!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile saved");
      void queryClient.invalidateQueries({ queryKey: ["customer"] });
    },
    onError: () => toast.error("Couldn't save your profile"),
  });

  if (!me) return <SkeletonForm fields={5} label="Loading profile" />;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-display font-semibold">Profile</h1>
      <div className="flex items-center gap-4 rounded-2xl bg-card p-6 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <span className="flex size-16 items-center justify-center rounded-full bg-accent text-title font-semibold text-primary">
          {initialsOf(me.full_name || me.email)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-title font-semibold">{me.full_name || "Add your name"}</p>
          <p className="truncate text-body text-muted-foreground">{me.email}</p>
        </div>
      </div>

      <form
        className="space-y-5 rounded-2xl bg-card p-6 shadow-[inset_0_0_0_1px_var(--color-border)]"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-body font-semibold">
            First name
            <input
              value={form.first}
              maxLength={60}
              autoComplete="given-name"
              onChange={(e) => setForm({ ...form, first: e.target.value })}
              className={field}
            />
          </label>
          <label className="block text-body font-semibold">
            Last name
            <input
              value={form.last}
              maxLength={60}
              autoComplete="family-name"
              onChange={(e) => setForm({ ...form, last: e.target.value })}
              className={field}
            />
          </label>
        </div>
        <label className="block text-body font-semibold">
          Email
          <input
            value={me.email}
            readOnly
            className={cn(field, "bg-secondary text-muted-foreground")}
          />
          <span className="mt-1 block text-caption font-normal text-muted-foreground">
            You sign in with this email.
          </span>
        </label>
        <label className="block text-body font-semibold">
          Phone number
          <input
            type="tel"
            value={form.phone}
            maxLength={30}
            autoComplete="tel"
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className={field}
          />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-body font-semibold">
            Date of birth
            <input
              type="date"
              value={form.birthday}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              className={field}
            />
          </label>
          <label className="block text-body font-semibold">
            Gender
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className={field}
            >
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-caption text-muted-foreground">
          We fill these in for you when you book. Salons see the details you book with.
        </p>
        <button type="submit" disabled={save.isPending} className={cn(solidPill, "h-12 px-8")}>
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
