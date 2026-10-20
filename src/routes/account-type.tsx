import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Storefront, UserCircle } from "@phosphor-icons/react";

import { CustomerHeader, outlinePill, solidPill } from "@/components/customer/customer-ui";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/lib/customer";
import { cn } from "@/lib/utils";

type Search = { expected?: "customer" | "business" | undefined };

export const Route = createFileRoute("/account-type")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search =>
    search["expected"] === "customer" || search["expected"] === "business"
      ? { expected: search["expected"] }
      : {},
  head: () => ({ meta: [{ title: "Wrong account type — Bookly" }] }),
  component: AccountTypePage,
});

/**
 * Shown when a login opens the other class's area: a business login on the customer side, or a
 * customer login on the business side. One email is one class of account.
 */
function AccountTypePage() {
  const { expected = "customer" } = Route.useSearch();
  const customer = useCustomer();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = customer.data;
  const isBusinessLogin = expected === "customer";

  const signOutTo = async (to: "/sign-in" | "/auth") => {
    await supabase.auth.signOut();
    queryClient.clear();
    void navigate({ to });
  };

  if (customer.isLoading) return null;
  if (!me) {
    return (
      <div className="min-h-screen bg-surface">
        <CustomerHeader search={false} />
        <p className="p-10 text-center text-body text-muted-foreground">
          You&apos;re signed out.{" "}
          <Link to={isBusinessLogin ? "/sign-in" : "/auth"} className="font-semibold text-primary">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  const Icon = isBusinessLogin ? Storefront : UserCircle;
  return (
    <div className="min-h-screen bg-surface">
      <CustomerHeader search={false} />
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl bg-card p-8 text-center shadow-[inset_0_0_0_1px_var(--color-border)]">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent">
            <Icon size={28} className="text-primary" />
          </span>
          <h1 className="mt-4 text-title font-semibold">
            {isBusinessLogin
              ? "This email is a business account"
              : "This email is a customer account"}
          </h1>
          <p className="mt-2 text-body text-muted-foreground">
            <span className="font-semibold text-foreground">{me.email}</span>{" "}
            {isBusinessLogin
              ? "is used for Bookly for business. To book appointments as a customer, sign in with a different email."
              : "is used to book appointments on Bookly. To set up or join a business, use a different email."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {isBusinessLogin ? (
              <a href="/dashboard" className={cn(solidPill, "h-12")}>
                Go to your dashboard
              </a>
            ) : (
              <Link to="/account/appointments" className={cn(solidPill, "h-12")}>
                Go to my appointments
              </Link>
            )}
            <button
              type="button"
              onClick={() => void signOutTo(isBusinessLogin ? "/sign-in" : "/auth")}
              className={cn(outlinePill, "h-12")}
            >
              Sign out and use another email
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
