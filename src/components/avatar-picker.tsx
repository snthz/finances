"use client";

import { Camera, Check, ImageUp } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { saveAvatar } from "@/actions/settings";
import { useT } from "@/i18n/client";
import { useToastState } from "./action-form";
import { Avatar, AVATAR_ICONS } from "./avatar";
import { Modal } from "./form/modal";

const SIZE = 256;

/** Recorta al centro y reduce la imagen a 256×256 para guardarla como data URL. */
async function toAvatarDataUrl(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.85);
  // Safari antiguo no codifica WebP y devuelve PNG
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}

/** Avatar actual con botón que abre un modal para subir foto o elegir uno predeterminado. */
export function AvatarPicker({ name, email, avatar }: { name: string; email: string; avatar: string | null }) {
  const t = useT().forms.avatar;
  const tc = useT().common.actions;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(avatar ?? "");
  const [photo, setPhoto] = useState(avatar?.startsWith("data:") ? avatar : "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(saveAvatar, null);
  useToastState(state);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  function save() {
    const fd = new FormData();
    fd.set("avatar", value);
    startTransition(() => action(fd));
  }

  function show() {
    setValue(avatar ?? "");
    setPhoto(avatar?.startsWith("data:") ? avatar : "");
    setOpen(true);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await toAvatarDataUrl(file);
      setPhoto(url);
      setValue(url);
    } catch {
      toast.error(t.readError);
    }
  }

  const option = (v: string, label: string) => {
    const selected = value === v;
    return (
      <button
        key={v || "initials"}
        type="button"
        onClick={() => setValue(v)}
        aria-label={label}
        aria-pressed={selected}
        title={label}
        className={`relative rounded-full p-0.5 transition ${selected ? "ring-2 ring-ink" : "ring-1 ring-transparent hover:ring-line-strong"}`}
      >
        <Avatar name={name} avatar={v} size={44} />
        {selected && (
          <span className="absolute -right-0.5 -bottom-0.5 flex size-4.5 items-center justify-center rounded-full border-2 border-surface bg-ink text-bg">
            <Check className="size-2.5" strokeWidth={3} />
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <button type="button" onClick={show} aria-label={t.change} className="group relative shrink-0 rounded-full">
          <Avatar name={name} avatar={avatar} size={64} className="transition group-hover:opacity-85" />
          <span className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full border-2 border-surface bg-ink text-bg">
            <Camera className="size-3.5" />
          </span>
        </button>
        <div className="min-w-0">
          <p className="truncate font-medium">{name}</p>
          <p className="truncate text-sm text-muted">{email}</p>
          <button type="button" onClick={show} className="mt-1 text-sm font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            {t.change}
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.title}
        description={t.description}
        footer={
          <>
            {value && (
              <button type="button" onClick={() => setValue("")} className="btn h-10 text-ink-2 hover:bg-surface-2">
                {t.remove}
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="btn-subtle ml-auto h-10">
              {tc.cancel}
            </button>
            <button type="button" onClick={save} disabled={pending} className="btn-primary h-10 px-6">
              {pending ? tc.saving : tc.save}
            </button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-4 pt-2 pb-5">
          <Avatar name={name} avatar={value} size={112} />
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-subtle h-10">
            <ImageUp className="size-4" /> {t.upload}
          </button>
        </div>
        <p className="label">{t.presets}</p>
        <div className="grid grid-cols-5 justify-items-center gap-2 sm:grid-cols-6">
          {option("", t.initials)}
          {photo && option(photo, t.yourPhoto)}
          {Object.keys(AVATAR_ICONS).map((k) => option(`icon:${k}`, t.icons[k] ?? k))}
        </div>
      </Modal>
    </>
  );
}
