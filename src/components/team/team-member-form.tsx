import { useEffect, useMemo, useState } from "react";
import { CalendarBlank, Check, PencilSimple, User } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { sendTeamInvite } from "@/lib/team-invites";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";
import {
  reconcileTeamMemberServices,
  TeamMemberServicesSection,
  useBusinessServices,
} from "./team-member-services";

const FIELD = "h-12 rounded-xl border border-border bg-transparent text-base";

/** Fixed calendar palette — this colour tints the member's appointments. */
export const CALENDAR_COLORS = [
  "#A5D8F3",
  "#8FC9EE",
  "#8FB6F0",
  "#A3AEF2",
  "#A79BF0",
  "#B79AEE",
  "#CB9AEC",
  "#E79AD3",
  "#F0A0AE",
  "#F2A97E",
  "#F5B96B",
  "#F7C662",
  "#F6DC6B",
  "#DFE87A",
  "#A8E0B4",
  "#7FD2C8",
] as const;

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const PRONOUNS = ["She/her", "He/him", "They/them", "Prefer not to say"];
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contractor", "Freelance", "Intern"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;




function toISODate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

/** Date picker pair: a day/month popover plus a matching year input. */
function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: Date | undefined;
  onChange: (next: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const year = value ? String(value.getFullYear()) : "";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-4">
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              className={cn(
                FIELD,
                "w-full justify-between px-4 font-normal hover:bg-transparent",
                !value && "text-muted-foreground",
              )}
            >
              {value ? format(value, "EEE, MMM d") : "Day and month"}
              <CalendarBlank size={18} className="text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={(next) => {
                onChange(next ?? undefined);
                setOpen(false);
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-year`}>Year</Label>
        <Input
          id={`${id}-year`}
          inputMode="numeric"
          maxLength={4}
          placeholder="Year"
          className={FIELD}
          value={year}
          onChange={(event) => {
            const raw = event.target.value.replace(/\D/g, "").slice(0, 4);
            if (raw.length < 4) return;
            const next = new Date(value ?? new Date());
            next.setFullYear(Number(raw));
            onChange(next);
          }}
        />
      </div>
    </div>
  );
}

export function TeamMemberForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dial, setDial] = useState("");
  const [phone, setPhone] = useState("");
  const [additionalDial, setAdditionalDial] = useState("");
  const [additionalPhone, setAdditionalPhone] = useState("");
  const [country, setCountry] = useState("");
  const [birthdayDate, setBirthdayDate] = useState<Date | undefined>(undefined);
  const [gender, setGender] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [calendarColor, setCalendarColor] = useState<string>(CALENDAR_COLORS[0]);
  const [jobTitle, setJobTitle] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(() => new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [employmentType, setEmploymentType] = useState("");
  const [externalId, setExternalId] = useState("");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  type Section = "profile" | "services";
  const [section, setSection] = useState<Section>("profile");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const { data: services, isLoading: servicesLoading } = useBusinessServices(businessId);

  // Default dial codes + country to the business's own country.
  useEffect(() => {
    if (!business?.country || dial) return;
    const match = COUNTRIES.find((item) => item.code === business.country);
    if (!match) return;
    setDial(match.dial);
    setAdditionalDial(match.dial);
    setCountry((prev) => prev || match.code);
  }, [business?.country, dial]);

  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => String(i + 1)), []);

  const pickAvatar = (file: File) => {
    setAvatarFile(file);
    setAvatarPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const firstNameError = touched["firstName"] && !firstName.trim();
  const emailError =
    touched["email"] && (!email.trim() || !emailPattern.test(email.trim()));

  const save = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business found");

      const birthday = birthdayDate ? toISODate(birthdayDate) : null;

      const { data, error } = await supabase
        .from("team_members")
        .insert({
          business_id: businessId,
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          phone_country_code: phone.trim() ? dial || null : null,
          additional_phone: additionalPhone.trim() || null,
          additional_phone_country_code: additionalPhone.trim() ? additionalDial || null : null,
          country: country || null,
          birthday,
          gender: gender || null,
          pronouns: pronouns || null,
          calendar_color: calendarColor,
          avatar_color: calendarColor,
          job_title: jobTitle.trim() || null,
          start_date: startDate ? toISODate(startDate) : null,
          end_date: endDate ? toISODate(endDate) : null,
          employment_type: employmentType || null,
          external_team_member_id: externalId.trim() || null,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() || "jpg";
        const path = `${businessId}/${data.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("team-member-photos")
          .upload(path, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        await supabase.from("team_members").update({ avatar_path: path }).eq("id", data.id);
      }

      if (selectedServices.length) {
        await reconcileTeamMemberServices(data.id, selectedServices, []);
      }

      await sendTeamInvite(data.id);
      return data.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["team-members", businessId] });
      queryClient.invalidateQueries({ queryKey: ["service-team-members", businessId] });
      queryClient.invalidateQueries({ queryKey: ["team-member-services", id] });
      toast.success("Invite sent", {
        description: `${firstName.trim()} will get an invite at ${email.trim()}.`,
      });
      navigate({ to: "/team" });
    },
    onError: (error: Error) =>
      toast.error("Couldn't add the team member", { description: error.message }),
  });

  const onSubmit = () => {
    setTouched({ firstName: true, email: true });
    if (!firstName.trim() || !emailPattern.test(email.trim())) {
      toast.error("First name and a valid email are required");
      return;
    }
    save.mutate();
  };

  const navItem = (label: string, badge?: number, target?: Section) => {
    const active = target !== undefined && section === target;
    return (
      <button
        key={label}
        type="button"
        onClick={() => (target ? setSection(target) : toast("Coming soon"))}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-body font-medium transition-colors",
          active
            ? "bg-accent/40 text-foreground"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        <span>{label}</span>
        {badge !== undefined ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-semibold text-foreground">
            {badge}
          </span>
        ) : null}
      </button>
    );
  };


  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-3 px-8 py-4">
          <Button
            variant="outline"
            className="h-11 rounded-full border-[#D3D3D3] bg-white px-6 text-base font-semibold text-foreground hover:bg-white hover:text-foreground"
            onClick={() => navigate({ to: "/team" })}
          >
            Close
          </Button>
          <Button
            className="h-11 rounded-full px-7 text-base font-semibold"
            onClick={onSubmit}
            disabled={save.isPending}
          >
            {save.isPending ? "Adding…" : "Add"}
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-8 pb-24">
        <h1 className="text-display font-semibold leading-9 text-foreground">Add team member</h1>

        <div className="mt-10 grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="h-fit space-y-1 rounded-2xl border border-[#D3D3D3] bg-white p-3">
            <p className="px-3 py-2 text-body font-semibold text-foreground">Personal</p>
            {navItem("Profile", undefined, "profile")}
            {navItem("Addresses")}
            {navItem("Emergency contacts")}

            <div className="my-2 h-px bg-[#D3D3D3]" />
            <p className="px-3 py-2 text-body font-semibold text-foreground">Workspace</p>
            {navItem("Services", selectedServices.length, "services")}
            {navItem("Locations", 1)}
            {navItem("Settings")}

            <div className="my-2 h-px bg-[#D3D3D3]" />
            <p className="px-3 py-2 text-body font-semibold text-foreground">Pay</p>
            {navItem("Wages and timesheets")}
            {navItem("Commissions")}
            {navItem("Pay runs")}
          </nav>

          {section === "services" ? (
            <div className="max-w-2xl">
              <TeamMemberServicesSection
                services={services ?? []}
                loading={servicesLoading}
                selected={selectedServices}
                onChange={setSelectedServices}
                currency={business?.currency ?? "USD"}
                country={business?.country ?? null}
              />
            </div>
          ) : (
          <div className="max-w-2xl space-y-12">
            {/* Profile */}

            <section className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Profile</h2>
                <p className="mt-1 text-body text-muted-foreground">
                  Manage your team member&apos;s personal profile
                </p>
              </div>

              <div className="relative w-fit">
                <div className="flex size-28 items-center justify-center overflow-hidden rounded-full bg-accent/40">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="size-full object-cover" />
                  ) : (
                    <User size={48} className="text-primary" weight="regular" />
                  )}
                </div>
                <label className="absolute bottom-1 right-1 flex size-8 cursor-pointer items-center justify-center rounded-full border border-[#D3D3D3] bg-white">
                  <PencilSimple size={14} className="text-foreground" />
                  <span className="sr-only">Upload photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) pickAvatar(file);
                    }}
                  />
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tm-first">First name *</Label>
                  <Input
                    id="tm-first"
                    maxLength={80}
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
                  <Label htmlFor="tm-last">Last name</Label>
                  <Input
                    id="tm-last"
                    maxLength={80}
                    className={FIELD}
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tm-email">Email *</Label>
                  <Input
                    id="tm-email"
                    type="email"
                    maxLength={255}
                    className={cn(FIELD, emailError && "border-destructive")}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  />
                  {emailError ? (
                    <p className="text-body text-destructive">Enter a valid email address</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tm-phone">Phone number</Label>
                  <div className="flex gap-2">
                    <Select value={dial} onValueChange={setDial}>
                      <SelectTrigger className={cn(FIELD, "w-[110px]")}>
                        <SelectValue placeholder="+" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {COUNTRIES.map((c) => (
                          <SelectItem key={`p-${c.code}`} value={c.dial}>
                            {flagEmoji(c.code)} +{c.dial}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="tm-phone"
                      inputMode="tel"
                      maxLength={20}
                      className={cn(FIELD, "flex-1")}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tm-phone2">Additional phone number</Label>
                  <div className="flex gap-2">
                    <Select value={additionalDial} onValueChange={setAdditionalDial}>
                      <SelectTrigger className={cn(FIELD, "w-[110px]")}>
                        <SelectValue placeholder="+" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {COUNTRIES.map((c) => (
                          <SelectItem key={`ap-${c.code}`} value={c.dial}>
                            {flagEmoji(c.code)} +{c.dial}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="tm-phone2"
                      inputMode="tel"
                      maxLength={20}
                      className={cn(FIELD, "flex-1")}
                      value={additionalPhone}
                      onChange={(event) => setAdditionalPhone(event.target.value)}
                    />
                  </div>
                </div>
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

              <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tm-birthday">Birthday</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="tm-birthday"
                        variant="outline"
                        className={cn(
                          FIELD,
                          "w-full justify-between px-4 font-normal hover:bg-transparent",
                          !birthdayDate && "text-muted-foreground",
                        )}
                      >
                        {birthdayDate ? format(birthdayDate, "EEE, MMM d") : "Day and month"}
                        <CalendarBlank size={18} className="text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={birthdayDate}
                        onSelect={setBirthdayDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tm-birth-year">Year</Label>
                  <Select
                    value={birthdayDate ? String(birthdayDate.getFullYear()) : ""}
                    onValueChange={(year) => {
                      const next = birthdayDate ? new Date(birthdayDate) : new Date();
                      next.setFullYear(Number(year));
                      setBirthdayDate(next);
                    }}
                  >
                    <SelectTrigger id="tm-birth-year" className={FIELD}>
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {Array.from({ length: 101 }, (_, i) => String(new Date().getFullYear() - i)).map(
                        (year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
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
                      {GENDERS.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
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
                      {PRONOUNS.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Calendar color</Label>
                <div className="flex max-w-[430px] flex-wrap gap-3">
                  {CALENDAR_COLORS.map((color) => {
                    const active = calendarColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Calendar color ${color}`}
                        aria-pressed={active}
                        onClick={() => setCalendarColor(color)}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full transition-transform active:scale-95",
                          active && "ring-2 ring-foreground ring-offset-2",
                        )}
                        style={{ backgroundColor: color }}
                      >
                        {active ? <Check size={14} weight="bold" className="text-white" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tm-job">Job title</Label>
                <Input
                  id="tm-job"
                  maxLength={80}
                  className={cn(FIELD, "sm:max-w-[calc(50%-0.625rem)]")}
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                />
                <p className="text-caption text-muted-foreground">Visible to clients online</p>
              </div>
            </section>

            <div className="h-px bg-[#D3D3D3]" />

            {/* Work details */}
            <section className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Work details</h2>
                <p className="mt-1 text-body text-muted-foreground">
                  Manage your team member&apos;s start date, and employment details
                </p>
              </div>

              <DateField
                id="tm-start"
                label="Start date"
                value={startDate}
                onChange={setStartDate}
              />
              <DateField id="tm-end" label="End date" value={endDate} onChange={setEndDate} />

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Employment type</Label>
                  <Select value={employmentType} onValueChange={setEmploymentType}>
                    <SelectTrigger className={FIELD}>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_TYPES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tm-external">Team member ID</Label>
                  <Input
                    id="tm-external"
                    maxLength={60}
                    className={FIELD}
                    value={externalId}
                    onChange={(event) => setExternalId(event.target.value)}
                  />
                  <p className="text-caption text-muted-foreground">
                    An identifier used for external systems like payroll
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tm-notes">Notes</Label>
                  <span className="text-caption text-muted-foreground">{notes.length}/1000</span>
                </div>
                <Textarea
                  id="tm-notes"
                  maxLength={1000}
                  rows={4}
                  placeholder="Add a private note only viewable in the team member list"
                  className="rounded-xl border border-border text-base"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value.slice(0, 1000))}
                />
              </div>
            </section>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
