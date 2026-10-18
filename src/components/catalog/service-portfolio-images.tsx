import { useRef, useState } from "react";
import { FileText, Star, Trash } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const MAX_PORTFOLIO_IMAGES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const BUCKET = "service-portfolio-images";

export type PortfolioImage = {
  id: string;
  storage_path: string;
  image_url: string;
  is_primary: boolean;
  signedUrl?: string | undefined;
};

/** Images uploaded while the service was still a draft get attached on save. */
export async function attachDraftPortfolioImages(serviceId: string, draftId: string) {
  const { error } = await supabase
    .from("service_portfolio_images")
    .update({ service_id: serviceId })
    .eq("draft_id", draftId)
    .is("service_id", null);
  if (error) throw error;
}

export function usePortfolioImages(draftId: string, serviceId?: string) {
  return useQuery({
    queryKey: ["service-portfolio-images", serviceId ?? draftId],
    queryFn: async (): Promise<PortfolioImage[]> => {
      const query = supabase
        .from("service_portfolio_images")
        .select("id, storage_path, image_url, is_primary")
        .order("created_at");

      const { data, error } = serviceId
        ? await query.eq("service_id", serviceId)
        : await query.eq("draft_id", draftId);
      if (error) throw error;

      const rows = data ?? [];
      if (rows.length === 0) return [];

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(
          rows.map((row) => row.storage_path),
          60 * 60,
        );

      return rows.map((row, index) => ({
        ...row,
        signedUrl: signed?.[index]?.signedUrl ?? undefined,
      }));
    },
  });
}

type Props = {
  businessId?: string | undefined;
  draftId: string;
  serviceId?: string | undefined;
};

export function PortfolioImagesSection({ businessId, draftId, serviceId }: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PortfolioImage | null>(null);

  const { data: images = [], isLoading } = usePortfolioImages(draftId, serviceId);
  const remaining = MAX_PORTFOLIO_IMAGES - images.length;
  const queryKey = ["service-portfolio-images", serviceId ?? draftId];

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${businessId}/${serviceId ?? draftId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const { error } = await supabase.from("service_portfolio_images").insert({
          business_id: businessId!,
          service_id: serviceId ?? null,
          draft_id: serviceId ? null : draftId,
          storage_path: path,
          image_url: publicUrl.publicUrl,
          is_primary: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Images uploaded");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (image: PortfolioImage) => {
      await supabase.storage.from(BUCKET).remove([image.storage_path]);
      const { error } = await supabase
        .from("service_portfolio_images")
        .delete()
        .eq("id", image.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Image deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setPrimary = useMutation({
    mutationFn: async (image: PortfolioImage) => {
      const others = images.filter((row) => row.id !== image.id && row.is_primary);
      for (const row of others) {
        const { error } = await supabase
          .from("service_portfolio_images")
          .update({ is_primary: false })
          .eq("id", row.id);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("service_portfolio_images")
        .update({ is_primary: true })
        .eq("id", image.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const messages: string[] = [];

    const valid = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        messages.push(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > MAX_FILE_BYTES) {
        messages.push(`${file.name} is larger than 5MB`);
        return false;
      }
      return true;
    });

    const accepted = valid.slice(0, Math.max(remaining, 0));
    const skipped = valid.length - accepted.length;
    if (skipped > 0) {
      messages.push(
        `${skipped} image${skipped === 1 ? "" : "s"} skipped — only ${remaining} slot${remaining === 1 ? "" : "s"} left of ${MAX_PORTFOLIO_IMAGES}`,
      );
    }

    setFileError(messages.length ? messages.join(". ") : null);
    if (accepted.length > 0) upload.mutate(accepted);
  };

  const full = remaining <= 0;

  return (
    <section className="rounded-xl border border-border bg-card px-6 py-8 sm:px-10">
      <h2 className="text-[1.5rem] font-semibold leading-8 text-foreground">Portfolio images</h2>
      <p className="mt-1 text-base text-muted-foreground">
        Add and manage service imagery shown to clients when they browse and book this
        service online.
      </p>

      {full ? (
        <div className="mt-6 rounded-2xl border border-border bg-muted/40 px-6 py-5 text-base text-foreground">
          Maximum of {MAX_PORTFOLIO_IMAGES} images reached — delete one to add another.
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            "mt-6 cursor-pointer rounded-2xl border-2 border-dashed border-border transition-colors",
            dragging && "border-primary bg-primary/5",
            images.length === 0
              ? "flex flex-col items-center justify-center px-6 py-14 text-center"
              : "p-2",
          )}
        >
          {images.length === 0 ? (
            <>
              <FileText size={32} weight="regular" className="text-foreground" />
              <p className="mt-3 text-lg font-semibold text-foreground">
                Add your images here
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 h-11 rounded-full bg-card px-6 text-base font-semibold text-foreground"
                disabled={upload.isPending || !businessId}
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                {upload.isPending ? "Uploading…" : "Choose a file"}
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-6 py-5">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-foreground">
                  Drag and drop your images here
                </p>
                <p className="mt-0.5 text-base text-muted-foreground">
                  Or click to browse
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 rounded-full bg-card px-6 text-base font-semibold text-foreground"
                disabled={upload.isPending || !businessId}
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                {upload.isPending ? "Uploading…" : "Choose a file"}
              </Button>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      )}



      {fileError ? (
        <p className="mt-2 text-body font-medium text-destructive">{fileError}</p>
      ) : null}

      {isLoading ? null : images.length === 0 ? null : (

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((image) => (
            <figure
              key={image.id}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border bg-muted",
                image.is_primary && "ring-2 ring-primary ring-offset-2",
              )}
            >
              <img
                src={image.signedUrl ?? image.image_url}
                alt="Service portfolio"
                loading="lazy"
                className="aspect-square w-full object-cover"
              />

              {image.is_primary ? (
                <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-caption font-semibold text-primary-foreground">
                  Primary
                </span>
              ) : null}

              <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {image.is_primary ? (
                  <span />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPrimary.mutate(image)}
                    className="flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-caption font-semibold text-foreground shadow-sm"
                  >
                    <Star size={14} weight="fill" /> Set as primary
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Delete image"
                  onClick={() => setPendingDelete(image)}
                  className="rounded-full bg-background/95 p-2 text-destructive shadow-sm"
                >
                  <Trash size={16} />
                </button>
              </div>
            </figure>
          ))}
        </div>
      )}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the image from this service permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
