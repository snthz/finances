"use client";

import { Check, Copy, Download, Plus, TriangleAlert } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { setEmailAccountMailbox } from "@/actions/settings";
import { Field, Switch, TagInput } from "@/components/form/controls";
import { Select } from "@/components/form/select";
import { buildGmailFilterXml, gmailSearchQuery, KNOWN_SENDERS, normalizeSender } from "@/lib/email/gmail-filter";
import { fmt, useT } from "@/i18n/client";

type Account = { id: number; label: string; address: string; mailbox: string };
type Seen = { accountId: number | null; address: string; count: number };

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "finanzas";

/** Arma un filtro de Gmail (remitentes → etiqueta) y lo descarga como .xml para importarlo. */
export function GmailFilterGenerator({ accounts, seen, defaultAccountId }: { accounts: Account[]; seen: Seen[]; defaultAccountId?: number }) {
  const t = useT();
  const f = t.email.filter;
  const sendersFor = (id: number | null) => seen.filter((s) => s.accountId === id).map((s) => s.address);
  const first = accounts.find((a) => a.id === defaultAccountId) ?? accounts[0];

  const [accountId, setAccountId] = useState(first ? String(first.id) : "");
  const account = accounts.find((a) => String(a.id) === accountId);
  const [label, setLabel] = useState(first?.mailbox ?? "Finanzas");
  const [senders, setSenders] = useState<string[]>(first ? sendersFor(first.id) : []);
  const [neverSpam, setNeverSpam] = useState(true);
  const [skipInbox, setSkipInbox] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; text: string } | null>(null);

  const cleanLabel = label.trim();
  const knownLabels = Array.from(new Set(["Finanzas", ...accounts.map((a) => a.mailbox)]));

  // Sugerencias: lo que ya llegó a la app y los bancos conocidos, sin repetir lo elegido
  const suggestions = useMemo(() => {
    const groups: { title: string; items: { address: string; hint?: string }[] }[] = [
      {
        title: f.seenInApp,
        items: Array.from(new Map(seen.map((s) => [s.address, s])).values()).map((s) => ({
          address: s.address,
          hint: accounts.find((a) => a.id === s.accountId)?.label,
        })),
      },
      { title: f.knownBanks, items: KNOWN_SENDERS.flatMap((b) => b.addresses.map((address) => ({ address, hint: b.bank }))) },
    ];
    const taken = new Set(senders);
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => !taken.has(i.address) && (taken.add(i.address), true)) }))
      .filter((g) => g.items.length);
  }, [seen, accounts, senders, f]);

  const ready = senders.length > 0 && cleanLabel.length > 0;
  const labelMismatch = account && cleanLabel && account.mailbox !== cleanLabel;

  function download() {
    const xml = buildGmailFilterXml({ senders, label: cleanLabel, neverSpam, skipInbox });
    const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fmt(f.fileName, { slug: slug(cleanLabel) });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyQuery() {
    await navigator.clipboard.writeText(gmailSearchQuery(senders));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function applyLabelToAccount() {
    if (!account) return;
    startTransition(async () => {
      const r = await setEmailAccountMailbox(account.id, cleanLabel);
      setResult(r?.error ? { text: r.error } : { ok: true, text: r?.message ?? f.done });
    });
  }

  return (
    <div className="space-y-5">
      {accounts.length > 0 && (
        <Field label={f.account} hint={f.accountHint}>
          <Select
            value={accountId}
            onChange={(v) => {
              setAccountId(v);
              setResult(null);
              const acc = accounts.find((a) => String(a.id) === v);
              if (acc) {
                setLabel(acc.mailbox);
                setSenders(sendersFor(acc.id));
              }
            }}
            options={accounts.map((a) => ({ value: String(a.id), label: a.label, hint: a.address }))}
          />
        </Field>
      )}

      <Field label={f.label} htmlFor="filter-label" hint={f.labelHint}>
        <input id="filter-label" value={label} onChange={(e) => (setLabel(e.target.value), setResult(null))} placeholder="Finanzas" className="input" />
        {knownLabels.length > 1 || knownLabels[0] !== cleanLabel ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {knownLabels.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => (setLabel(l), setResult(null))}
                className={`h-8 rounded-lg px-3 text-xs font-medium transition ${l === cleanLabel ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3"}`}
              >
                {l}
              </button>
            ))}
          </div>
        ) : null}
      </Field>

      {labelMismatch && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warn/12 px-4 py-3 text-sm">
          <TriangleAlert className="size-4 shrink-0 text-warn" />
          <span className="min-w-0 flex-1 text-ink-2">
            {fmt(f.mismatchBefore, { account: account.label })}
            <strong className="text-ink">“{account.mailbox}”</strong>
            {f.mismatchAfter}
          </span>
          <button type="button" onClick={applyLabelToAccount} disabled={pending} className="btn-subtle h-8 bg-surface text-xs">
            {pending ? t.common.actions.saving : fmt(f.use, { label: cleanLabel })}
          </button>
        </div>
      )}
      {result && <p className={`text-sm ${result.ok ? "text-ink-2" : "text-bad"}`}>{result.text}</p>}

      <Field label={f.senders} hint={f.sendersHint}>
        <TagInput name="senders" value={senders} onChange={setSenders} normalize={normalizeSender} placeholder={f.sendersPlaceholder} mono />
      </Field>

      {suggestions.map((g) => (
        <div key={g.title} className="-mt-2 space-y-2">
          <p className="text-xs font-medium text-muted">{g.title}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((s) => (
              <button
                key={s.address}
                type="button"
                onClick={() => setSenders((x) => [...x, s.address])}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 text-xs text-ink-2 transition hover:bg-surface-3 hover:text-ink"
              >
                <Plus className="size-3" />
                <span className="font-mono">{s.address}</span>
                {s.hint && <span className="text-muted">· {s.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="card divide-y divide-line px-4 shadow-none">
        <div className="py-2">
          <Switch checked={neverSpam} onChange={setNeverSpam} label={f.neverSpam} hint={f.neverSpamHint} />
        </div>
        <div className="py-2">
          <Switch checked={skipInbox} onChange={setSkipInbox} label={f.skipInbox} hint={f.skipInboxHint} />
        </div>
      </div>

      {ready && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted">{f.equivalentSearch}</p>
          <pre className="overflow-x-auto rounded-xl bg-surface-2 px-3 py-2.5 font-mono text-xs whitespace-pre-wrap text-ink-2">{gmailSearchQuery(senders)}</pre>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={download} disabled={!ready} className="btn-primary h-11 flex-1 sm:flex-none sm:px-6">
          <Download className="size-4" /> {f.download}
        </button>
        <button type="button" onClick={copyQuery} disabled={!ready} className="btn-subtle h-11">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? f.copied : f.copySearch}
        </button>
      </div>

      <ol className="space-y-3 border-t border-line pt-5 text-sm text-ink-2">
        {[
          <>
            {f.steps.s1Before}
            <strong className="text-ink">{f.steps.s1Bold}</strong>
            {f.steps.s1After}
          </>,
          <>
            {f.steps.s2Before}
            <strong className="text-ink">{f.steps.s2Bold1}</strong>
            {f.steps.s2Middle}
            <strong className="text-ink">{f.steps.s2Bold2}</strong>
            {f.steps.s2After}
          </>,
          <>
            {f.steps.s3Before}
            <strong className="text-ink">{f.steps.s3Bold1}</strong>
            {f.steps.s3Middle}
            <strong className="text-ink">{f.steps.s3Bold2}</strong>
            {f.steps.s3After}
          </>,
          <>{f.steps.s4}</>,
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink">{i + 1}</span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
