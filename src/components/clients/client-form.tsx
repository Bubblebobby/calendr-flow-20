import { useEffect, useMemo, useState } from "react";
import { Check, PencilSimple, Plus, User } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, flagEmoji } from "@/lib/countries";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";
import {
  ClientAddressesPanel,
  type ClientAddressValue,
} from "@/components/clients/client-addresses";
import { SkeletonFormPage } from "@/components/ui/skeletons";

const FIELD = "h-12 rounded-xl border border-input bg-transparent text-base";

const AVATAR_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#db2777",
  "#4f46e5",
];

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const PRONOUNS = ["She/her", "He/him", "They/them", "Prefer not to say"];
export const CLIENT_SOURCES = [
  "Walk-in",
  "Referral",
  "Online booking",
  "Social media",
  "Search engine",
  "Other",
];
const LANGUAGES = [
  "English",
  "French",
  "Spanish",
  "Portuguese",
  "Arabic",
  "German",
  "Italian",
  "Hindi",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  additional_email: string | null;
  phone: string | null;
  phone_country_code: string | null;
  additional_phone: string | null;
  additional_phone_country_code: string | null;
  notes: string | null;
  occupation: string | null;
  preferred_language: string | null;
  client_source: string;
  referred_by_client_id: string | null;
  country: string | null;
  gender: string | null;
  pronouns: string | null;
  birth_day: number | null;
  birth_month: number | null;
  birth_year: number | null;
  avatar_path: string | null;
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-8">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 text-body text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

export function ClientForm({
  clientId,
  onClose,
  onSaved,
}: {
  clientId?: string;
  onClose?: () => void;
  onSaved?: (clientId: string | undefined) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;
  const isEdit = Boolean(clientId);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [additionalEmail, setAdditionalEmail] = useState("");
  const [dial, setDial] = useState("");
  const [phone, setPhone] = useState("");
  const [additionalDial, setAdditionalDial] = useState("");
  const [additionalPhone, setAdditionalPhone] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [source, setSource] = useState("Walk-in");
  const [referredBy, setReferredBy] = useState("");
  const [language, setLanguage] = useState("");
  const [occupation, setOccupation] = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [addLanguageOpen, setAddLanguageOpen] = useState(false);
  const [newLanguage, setNewLanguage] = useState("");
  const [extraLanguages, setExtraLanguages] = useState<string[]>([]);
  const [section, setSection] = useState<"profile" | "addresses">("profile");
  const [address, setAddress] = useState<ClientAddressValue | null>(null);
  const [addressHydrated, setAddressHydrated] = useState(false);

  const languageOptions = useMemo(() => {
    const all = [...LANGUAGES, ...extraLanguages];
    return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
  }, [extraLanguages]);

  const signedAvatarUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("client-photos")
      .createSignedUrl(path, 60 * 60);
    if (!error && data?.signedUrl) setAvatarPreview(data.signedUrl);
  };

  const uploadAvatar = (file: File) => {
    setAvatarFile(file);
    setAvatarPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const quickAddClient = useMutation({
    mutationFn: async (name: string) => {
      if (!businessId) throw new Error("No business found");
      const [first = "", ...rest] = name.split(/\s+/);
      const { data, error } = await supabase
        .from("clients")
        .insert({
          business_id: businessId,
          first_name: first,
          last_name: rest.join(" ") || null,
          client_source: "Walk-in",
          avatar_color:
            AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)] ?? "#7c3aed",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      setReferredBy(row.id);
      setQuickAddName("");
      setQuickAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["clients", businessId] });
      toast.success("Client added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Default the phone dial code + country to the business's own country.
  useEffect(() => {
    if (!business?.country || dial) return;
    const c = COUNTRIES.find((item) => item.code === business.country);
    if (c) {
      setDial(c.dial);
      setAdditionalDial(c.dial);
      setCountry((prev) => prev || c.code);
    }
  }, [business?.country, dial]);

  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, first_name, last_name, email, additional_email, phone, phone_country_code, additional_phone, additional_phone_country_code, notes, occupation, preferred_language, client_source, referred_by_client_id, country, gender, pronouns, birth_day, birth_month, birth_year, avatar_path",
        )
        .eq("id", clientId!)
        .maybeSingle();
      if (error) throw error;
      return data as ClientRow | null;
    },
  });

  const tagsQuery = useQuery({
    queryKey: ["client-tags", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_tags")
        .select("id, name")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Separate cache key: this is a slim name-only list for "Referred by", and must not
  // overwrite the full list the Clients page caches under ["clients", businessId].
  const clientsQuery = useQuery({
    queryKey: ["clients-referral-options", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .eq("business_id", businessId!)
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignmentsQuery = useQuery({
    queryKey: ["client-tag-assignments", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_tag_assignments")
        .select("tag_id")
        .eq("client_id", clientId!);
      if (error) throw error;
      return (data ?? []).map((row) => row.tag_id);
    },
  });

  const addressQuery = useQuery({
    queryKey: ["client-address", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_addresses")
        .select(
          "address_type, address_name, street_address, apartment_suite, district, city, region, postcode, country",
        )
        .eq("client_id", clientId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (addressHydrated || !addressQuery.isSuccess) return;
    const row = addressQuery.data;
    if (row) {
      setAddress({
        address_type: row.address_type,
        address_name: row.address_name,
        street_address: row.street_address,
        apartment_suite: row.apartment_suite ?? "",
        district: row.district ?? "",
        city: row.city ?? "",
        region: row.region ?? "",
        postcode: row.postcode ?? "",
        country: row.country,
      });
    }
    setAddressHydrated(true);
  }, [addressHydrated, addressQuery.isSuccess, addressQuery.data]);

  useEffect(() => {
    if (!isEdit || hydrated || !clientQuery.isSuccess) return;
    const c = clientQuery.data;
    if (!c) {
      toast.error("Client not found");
      navigate({ to: "/clients" });
      return;
    }
    setFirstName(c.first_name ?? "");
    setLastName(c.last_name ?? "");
    setEmail(c.email ?? "");
    setAdditionalEmail(c.additional_email ?? "");
    setPhone(c.phone ?? "");
    if (c.phone_country_code) setDial(c.phone_country_code);
    setAdditionalPhone(c.additional_phone ?? "");
    if (c.additional_phone_country_code) setAdditionalDial(c.additional_phone_country_code);
    setBirthDay(c.birth_day ? String(c.birth_day) : "");
    setBirthMonth(c.birth_month ? String(c.birth_month) : "");
    setBirthYear(c.birth_year ? String(c.birth_year) : "");
    setGender(c.gender ?? "");
    setPronouns(c.pronouns ?? "");
    setSource(c.client_source ?? "Walk-in");
    setReferredBy(c.referred_by_client_id ?? "");
    setLanguage(c.preferred_language ?? "");
    setOccupation(c.occupation ?? "");
    setCountry(c.country ?? "");
    setNotes(c.notes ?? "");
    if (c.avatar_path) {
      setAvatarPath(c.avatar_path);
      void signedAvatarUrl(c.avatar_path);
    }
    setHydrated(true);
  }, [isEdit, hydrated, clientQuery.isSuccess, clientQuery.data, navigate]);

  useEffect(() => {
    if (assignmentsQuery.data) setTagIds(assignmentsQuery.data);
  }, [assignmentsQuery.data]);

  const referralOptions = useMemo(
    () => (clientsQuery.data ?? []).filter((row) => row.id !== clientId),
    [clientsQuery.data, clientId],
  );

  const createTag = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("client_tags")
        .insert({ business_id: businessId!, name })
        .select("id, name")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (tag) => {
      setTagIds((ids) => [...ids, tag.id]);
      setNewTag("");
      queryClient.invalidateQueries({ queryKey: ["client-tags", businessId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business found");
      const payload = {
        business_id: businessId,
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        additional_email: additionalEmail.trim() || null,
        phone: phone.trim() || null,
        phone_country_code: phone.trim() ? dial || null : null,
        additional_phone: additionalPhone.trim() || null,
        additional_phone_country_code: additionalPhone.trim() ? additionalDial || null : null,
        notes: notes.trim() || null,
        occupation: occupation.trim() || null,
        preferred_language: language || null,
        client_source: source,
        referred_by_client_id: referredBy || null,
        country: country || null,
        gender: gender || null,
        pronouns: pronouns || null,
        birth_day: birthDay ? Number(birthDay) : null,
        birth_month: birthMonth ? Number(birthMonth) : null,
        birth_year: birthYear ? Number(birthYear) : null,
      };

      let id = clientId;
      if (isEdit) {
        const { error } = await supabase.from("clients").update(payload).eq("id", clientId!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert({
            ...payload,
            avatar_color:
              AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)] ?? "#7c3aed",
          })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }

      // Upload a newly chosen avatar to the private client-photos bucket.
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() || "jpg";
        const path = `${businessId}/${id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("client-photos")
          .upload(path, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { error: updateError } = await supabase
          .from("clients")
          .update({ avatar_path: path })
          .eq("id", id!);
        if (updateError) throw updateError;
      }

      // Reconcile tag assignments for this client.
      await supabase.from("client_tag_assignments").delete().eq("client_id", id!);
      if (tagIds.length) {
        const { error } = await supabase.from("client_tag_assignments").insert(
          tagIds.map((tagId) => ({
            business_id: businessId,
            client_id: id!,
            tag_id: tagId,
          })),
        );
        if (error) throw error;
      }

      // One address per client: upsert the local value, or clear it if removed.
      if (address) {
        const { error } = await supabase.from("client_addresses").upsert(
          {
            client_id: id!,
            business_id: businessId,
            address_type: address.address_type,
            address_name: address.address_name,
            street_address: address.street_address,
            apartment_suite: address.apartment_suite || null,
            district: address.district || null,
            city: address.city || null,
            region: address.region || null,
            postcode: address.postcode || null,
            country: address.country,
          },
          { onConflict: "client_id" },
        );
        if (error) throw error;
      } else if (isEdit) {
        const { error } = await supabase
          .from("client_addresses")
          .delete()
          .eq("client_id", id!);
        if (error) throw error;
      }
      return id;
    },
    onSuccess: (id) => {
      toast.success(isEdit ? "Client updated" : "Client added");
      queryClient.invalidateQueries({ queryKey: ["clients", businessId] });
      queryClient.invalidateQueries({ queryKey: ["client-address", clientId] });
      if (onSaved) {
        onSaved(id);
        return;
      }
      navigate({ to: "/clients" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const firstNameError = touched["firstName"] && !firstName.trim();
  const lastNameError = touched["lastName"] && !lastName.trim();

  const onSave = () => {
    setTouched({ firstName: true, lastName: true });
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    save.mutate();
  };

  if (isEdit && clientQuery.isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <SkeletonFormPage label="Loading client" />
      </div>
    );
  }

  const tags = tagsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-3 px-8 py-4">
          <Button
            variant="outline"
            className="h-11 rounded-full border-input bg-white px-6 text-base font-semibold text-foreground hover:bg-white hover:text-foreground"
            onClick={() => (onClose ? onClose() : navigate({ to: "/clients" }))}
          >
            Close
          </Button>
          <Button
            className="h-11 rounded-full bg-ink px-7 text-base font-semibold text-ink-foreground hover:bg-ink/90"
            onClick={onSave}
            disabled={save.isPending}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-8 pb-24">
        <h1 className="text-display font-semibold leading-9 text-foreground">
          {isEdit ? "Edit client" : "Add a new client"}
        </h1>

        <div className="mt-10 grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Left navigation */}
          <nav className="h-fit space-y-1 rounded-2xl border border-border bg-white p-3">
            <p className="px-3 py-2 text-body font-semibold text-foreground">Personal</p>
            <button
              type="button"
              onClick={() => setSection("profile")}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-left text-body font-medium transition-colors",
                section === "profile"
                  ? "bg-accent/40 text-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => setSection("addresses")}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-left text-body font-medium transition-colors",
                section === "addresses"
                  ? "bg-accent/40 text-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Addresses
            </button>
            <button
              type="button"
              onClick={() => toast("Coming soon")}
              className="w-full rounded-lg px-3 py-2 text-left text-body font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Emergency contacts
            </button>
            <div className="my-2 h-px bg-border" />
            <button
              type="button"
              onClick={() => toast("Coming soon")}
              className="w-full rounded-lg px-3 py-2 text-left text-body font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Settings
            </button>
          </nav>

          {/* Right content */}
          <div className="max-w-2xl space-y-10">
            {section === "addresses" ? (
              <ClientAddressesPanel
                value={address}
                onChange={setAddress}
                defaultCountry={country || business?.country || "US"}
              />
            ) : null}
            <section className={cn("space-y-6", section !== "profile" && "hidden")}>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Profile</h2>
                <p className="mt-1 text-body text-muted-foreground">
                  Manage your client&apos;s personal profile
                </p>
              </div>

              <div className="relative w-fit">
                <div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-accent/40">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="size-full object-cover" />
                  ) : (
                    <User size={34} className="text-primary" weight="regular" />
                  )}
                </div>
                <label className="absolute -bottom-1 right-0 flex size-7 cursor-pointer items-center justify-center rounded-full border border-input bg-white">
                  <PencilSimple size={13} className="text-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadAvatar(file);
                    }}
                  />
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    placeholder="e.g. John"
                    className={cn(FIELD, firstNameError && "border-destructive")}
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
                  />
                  {firstNameError ? (
                    <p className="text-body text-destructive">First name is required</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input
                    id="last-name"
                    placeholder="e.g. Hancock"
                    className={cn(FIELD, lastNameError && "border-destructive")}
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, lastName: true }))}
                  />
                  {lastNameError ? (
                    <p className="text-body text-destructive">Last name is required</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@domain.com"
                    className={FIELD}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <div className="flex gap-2">
                    <Select value={dial} onValueChange={setDial}>
                      <SelectTrigger className={cn(FIELD, "w-28 shrink-0")}>
                        <SelectValue placeholder="Code" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.dial}>
                            {flagEmoji(c.code)} +{c.dial}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="phone"
                      inputMode="tel"
                      placeholder="e.g. +1 234 567 8901"
                      className={cn(FIELD, "flex-1")}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px]">
                <div className="space-y-2">
                  <Label>Birthday</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={birthDay} onValueChange={setBirthDay}>
                      <SelectTrigger className={FIELD}>
                        <SelectValue placeholder="Day" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={String(day)}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={birthMonth} onValueChange={setBirthMonth}>
                      <SelectTrigger className={FIELD}>
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {MONTHS.map((month, index) => (
                          <SelectItem key={month} value={String(index + 1)}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birth-year">Year</Label>
                  <Input
                    id="birth-year"
                    inputMode="numeric"
                    placeholder="Year"
                    className={FIELD}
                    value={birthYear}
                    onChange={(event) =>
                      setBirthYear(event.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger className={FIELD}>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pronouns</Label>
                  <Select value={pronouns} onValueChange={setPronouns}>
                    <SelectTrigger className={FIELD}>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRONOUNS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <div className="h-px bg-border" />

            <section className={cn("space-y-6", section !== "profile" && "hidden")}>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Additional info
                </h2>
                <p className="mt-1 text-body text-muted-foreground">
                  Edit additional information about the client
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Client source</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger className={FIELD}>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_SOURCES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-caption text-muted-foreground">
                    Choose how this client found your business.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Referred by</Label>
                    <button
                      type="button"
                      onClick={() => setQuickAddOpen((v) => !v)}
                      className="text-body font-semibold text-primary"
                    >
                      Add
                    </button>
                  </div>
                  <Select value={referredBy} onValueChange={setReferredBy}>
                    <SelectTrigger className={FIELD}>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {referralOptions.length === 0 ? (
                        <div className="px-3 py-2 text-body text-muted-foreground">
                          No other clients
                        </div>
                      ) : (
                        referralOptions.map((row) => (
                          <SelectItem key={row.id} value={row.id}>
                            {[row.first_name, row.last_name].filter(Boolean).join(" ")}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {quickAddOpen ? (
                    <div className="flex gap-2">
                      <Input
                        className={cn(FIELD, "flex-1")}
                        placeholder="Client name"
                        value={quickAddName}
                        onChange={(event) => setQuickAddName(event.target.value)}
                      />
                      <Button
                        variant="outline"
                        className="h-12 rounded-xl border-input bg-white px-4 font-semibold text-foreground hover:bg-white hover:text-foreground"
                        disabled={!quickAddName.trim() || quickAddClient.isPending}
                        onClick={() => quickAddClient.mutate(quickAddName.trim())}
                      >
                        Save
                      </Button>
                    </div>
                  ) : null}
                  <p className="text-caption text-muted-foreground">
                    Choose who referred this client to your business.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Preferred language</Label>
                    <button
                      type="button"
                      onClick={() => setAddLanguageOpen((v) => !v)}
                      className="text-body font-semibold text-primary"
                    >
                      Add
                    </button>
                  </div>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className={FIELD}>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {languageOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {addLanguageOpen ? (
                    <div className="flex gap-2">
                      <Input
                        className={cn(FIELD, "flex-1")}
                        placeholder="Language name"
                        value={newLanguage}
                        onChange={(event) => setNewLanguage(event.target.value)}
                      />
                      <Button
                        variant="outline"
                        className="h-12 rounded-xl border-input bg-white px-4 font-semibold text-foreground hover:bg-white hover:text-foreground"
                        disabled={!newLanguage.trim()}
                        onClick={() => {
                          const value = newLanguage.trim();
                          setExtraLanguages((list) =>
                            list.includes(value) ? list : [...list, value],
                          );
                          setLanguage(value);
                          setNewLanguage("");
                          setAddLanguageOpen(false);
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  ) : null}
                  <p className="text-caption text-muted-foreground">
                    Set the language of automated client notifications.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="occupation">Occupation</Label>
                    <span className="text-caption text-muted-foreground">{occupation.length}/255</span>
                  </div>
                  <Input
                    id="occupation"
                    className={FIELD}
                    maxLength={255}
                    placeholder="Enter client job information"
                    value={occupation}
                    onChange={(event) => setOccupation(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger className={FIELD}>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {flagEmoji(c.code)} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="additional-email">Additional email</Label>
                  <Input
                    id="additional-email"
                    type="email"
                    placeholder="example+1@domain.com"
                    className={FIELD}
                    value={additionalEmail}
                    onChange={(event) => setAdditionalEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="additional-phone">Additional phone</Label>
                  <div className="flex gap-2">
                    <Select value={additionalDial} onValueChange={setAdditionalDial}>
                      <SelectTrigger className={cn(FIELD, "w-28 shrink-0")}>
                        <SelectValue placeholder="Code" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.dial}>
                            {flagEmoji(c.code)} +{c.dial}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="additional-phone"
                      inputMode="tel"
                      placeholder="e.g. +1 234 567 8901"
                      className={cn(FIELD, "flex-1")}
                      value={additionalPhone}
                      onChange={(event) => setAdditionalPhone(event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const active = tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          setTagIds((ids) =>
                            active ? ids.filter((id) => id !== tag.id) : [...ids, tag.id],
                          )
                        }
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-body font-medium transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input text-foreground hover:bg-muted",
                        )}
                      >
                        {active ? <Check size={14} weight="bold" /> : null}
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Input
                    className={cn(FIELD, "flex-1")}
                    placeholder="Select or create a tag"
                    value={newTag}
                    onChange={(event) => setNewTag(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="h-12 gap-2 rounded-xl border-input bg-white px-5 font-semibold text-foreground hover:bg-white hover:text-foreground"
                    disabled={!newTag.trim() || !businessId || createTag.isPending}
                    onClick={() => createTag.mutate(newTag.trim())}
                  >
                    <Plus size={16} weight="bold" />
                    Add
                  </Button>
                </div>
                <p className="text-caption text-muted-foreground">
                  Add tags to group clients and filter them across the platform.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Client notes</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  className="rounded-xl border border-input bg-transparent text-base"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

