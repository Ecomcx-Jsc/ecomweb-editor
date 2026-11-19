import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useEditor } from "../context";
import type { RichNode } from "@ecomcx/ecomweb-content";
import { fromRich, inlineText, makeBlock, type BNode } from "../core/model";
import { Modal } from "./options";
import { markdownToNodes } from "./ai-markdown";
import { useMsgs } from "../i18n";
import { Dropdown, MenuItem, ToolButton } from "./toolbar";

type Job = { task: string; label: string; language?: string; instruction?: string };

/**
 * Menu AI trên thanh công cụ của khối chữ: viết lại, rút gọn, mở rộng, sửa chính tả, tóm tắt, dịch, yêu cầu khác.
 * Kết quả hiện trong hộp xem trước — người dùng chọn Thay thế / Chèn bên dưới / Huỷ (một bước hoàn tác).
 */
export function AiTools({ block }: { block: BNode }) {
  const { host, labels, store } = useEditor();
  const [job, setJob] = useState<Job | null>(null);
  const [state, setState] = useState<{ loading: boolean; text?: string; error?: string }>({ loading: false });
  if (!host.ai || !block.inline) return null;
  const source = inlineText(block.inline);
  const run = async (j: Job) => {
    setJob(j); setState({ loading: true });
    try { setState({ loading: false, text: await host.ai!.run(j.task, source, { language: j.language, instruction: j.instruction }) }); }
    catch (e) { setState({ loading: false, error: (e as Error).message }); }
  };
  const ask = () => { const instruction = window.prompt(labels.aiCustomPrompt)?.trim(); if (instruction) void run({ task: "custom", label: labels.aiCustom, instruction }); };
  const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const apply = (mode: "replace" | "below") => {
    const parts = paragraphs(state.text ?? "");
    if (!parts.length) return;
    const loc = store.locate(block.id);
    if (!loc) return;
    store.batch(() => {
      if (mode === "replace") {
        store.replace(block.id, [{ ...block, inline: [{ type: "text", text: parts[0] }] }, ...parts.slice(1).map((p) => makeBlock("paragraph", {}, p))]);
      } else {
        store.insert(loc.docId, loc.parent?.id ?? null, loc.index + 1, parts.map((p) => makeBlock("paragraph", {}, p)));
      }
    });
    setJob(null);
  };
  const items: Job[] = [
    { task: "rewrite", label: labels.aiRewrite }, { task: "shorten", label: labels.aiShorten }, { task: "expand", label: labels.aiExpand },
    { task: "fix", label: labels.aiFix }, { task: "summarize", label: labels.aiSummarize },
    { task: "translate", label: labels.aiTranslateEn, language: "English" }, { task: "translate", label: labels.aiTranslateVi, language: "Vietnamese" },
  ];
  return (
    <>
      <Dropdown label={labels.ai} trigger={<span className="ecx-tool-text"><Sparkles className="ecx-icon" />AI</span>}>
        {(close) => <>
          {items.map((j) => <MenuItem key={j.label} label={j.label} onClick={() => { close(); void run(j); }} />)}
          <MenuItem label={labels.aiCustom} onClick={() => { close(); ask(); }} />
        </>}
      </Dropdown>
      {job && (
        <Modal title={`${labels.ai}: ${job.label}`} onClose={() => setJob(null)} wide>
          <div className="ecx-ai-body" data-ecx-ai-result>
            {state.loading && <p className="ecx-ai-wait" role="status">{labels.aiWorking}</p>}
            {state.error && <p className="ecx-ai-error" role="alert">{state.error}</p>}
            {state.text && <div className="ecx-ai-text">{paragraphs(state.text).map((p, i) => <p key={i}>{p}</p>)}</div>}
            <p className="ecx-ai-note">{labels.aiNote}</p>
            <div className="ecx-popover-actions">
              <button type="button" className="ecx-btn" onClick={() => setJob(null)}>{labels.cancel}</button>
              {state.text && <button type="button" className="ecx-btn" onClick={() => apply("below")} data-ai-apply="below">{labels.aiInsertBelow}</button>}
              {state.text && <button type="button" className="ecx-btn ecx-btn-primary" onClick={() => apply("replace")} data-ai-apply="replace">{labels.aiReplace}</button>}
              {state.error && <button type="button" className="ecx-btn ecx-btn-primary" onClick={() => void run(job)}>{labels.aiRetry}</button>}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Khối Ảnh: nút "Tạo mô tả (alt) bằng AI" trên thanh công cụ (ảnh phải chọn từ thư viện media để biết mediaId). */
export function AiAltButton({ attrs, setAttrs }: { attrs: Record<string, unknown>; setAttrs(a: Record<string, unknown>): void }) {
  const { host, labels } = useEditor();
  const [busy, setBusy] = useState(false);
  if (!host.ai?.altText) return null;
  const id = Number(attrs.mediaId);
  const run = async () => {
    if (!Number.isFinite(id) || id <= 0) { window.alert(labels.aiAltNoMedia); return; }
    setBusy(true);
    try { setAttrs({ alt: (await host.ai!.altText!(id, labels.lang === "vi" ? "Vietnamese" : "English")).trim() }); }
    catch (e) { window.alert((e as Error).message); }
    finally { setBusy(false); }
  };
  return <ToolButton label={labels.aiAlt} onClick={() => void run()} disabled={busy} data-ai-alt><Sparkles className="ecx-icon" /><span className="ecx-tool-text">Alt</span></ToolButton>;
}

const TONES = ["auto", "friendly", "pro", "sell"] as const;
const LENGTHS = ["short", "medium", "long"] as const;
type Tone = (typeof TONES)[number];
type Length = (typeof LENGTHS)[number];
const TONE_HINT: Record<Tone, string> = { auto: "", friendly: "Tone: friendly and warm.", pro: "Tone: professional and precise.", sell: "Tone: persuasive, benefit-led, no exaggeration." };
const LENGTH_HINT: Record<Length, string> = { short: "Length: 1-2 short paragraphs.", medium: "Length: 3-4 paragraphs.", long: "Length: a full section of about 300-400 words with short H2/H3 headings." };

/** Lời nhắc đầy đủ gửi AI: yêu cầu của người dùng + giọng văn / độ dài / định dạng đã chọn. */
function composePrompt(prompt: string, o: { tone: Tone; length: Length; structured: boolean }) {
  const hints = [TONE_HINT[o.tone], LENGTH_HINT[o.length], o.structured ? "Format: use '## ' for section headings, '- ' for bullet lists and **bold** for key words, only where they help." : "Format: plain paragraphs only."].filter(Boolean);
  return `${prompt.trim()}\n\n${hints.join(" ")}`;
}

/** Lỗi từ máy chủ → câu người dùng hiểu và làm theo được (kèm thông báo gốc ngắn để dễ báo lỗi). */
function friendlyError(msg: string, t: Record<string, string>) {
  if (/not_configured|chưa được bật|chưa bật|not configured|thiếu nhà cung cấp/i.test(msg)) return t.aiwErrOff;
  if (/429|too.?fast|quá nhanh|too many/i.test(msg)) return t.aiwErrBusy;
  return `${t.aiwErrOther}${msg ? ` (${msg.slice(0, 160)})` : ""}`;
}

/** Vẽ cây khối AI trả về (tiêu đề, đoạn, danh sách, đậm / nghiêng) đúng như sẽ chèn — không hiện ký hiệu markdown. */
function NodesView({ nodes }: { nodes: RichNode[] }) {
  const inline = (n: RichNode, i: number): React.ReactNode => {
    let el: React.ReactNode = n.text ?? "";
    for (const m of n.marks ?? []) el = m.type === "bold" ? <strong>{el}</strong> : m.type === "italic" ? <em>{el}</em> : el;
    return <span key={i}>{el}</span>;
  };
  const block = (n: RichNode, i: number): React.ReactNode => {
    const kids = (n.content ?? []);
    switch (n.type) {
      case "heading": { const L = (`h${Math.min(4, Math.max(2, Number(n.attrs?.level) || 2))}`) as "h2"; return <L key={i}>{kids.map(inline)}</L>; }
      case "bulletList": return <ul key={i}>{kids.map(block)}</ul>;
      case "orderedList": return <ol key={i}>{kids.map(block)}</ol>;
      case "listItem": return <li key={i}>{kids.map((k, j) => (k.type === "paragraph" ? <span key={j}>{(k.content ?? []).map(inline)}</span> : block(k, j)))}</li>;
      default: return <p key={i}>{kids.map(inline)}</p>;
    }
  };
  return <>{nodes.map(block)}</>;
}

const countWords = (nodes: RichNode[]): number => nodes.reduce((n, x) => n + (x.text ? x.text.trim().split(/\s+/).filter(Boolean).length : 0) + countWords(x.content ?? []), 0);

/**
 * Lệnh /ai: hộp "Viết bằng AI" — gõ yêu cầu (hoặc chọn gợi ý), chọn giọng văn / độ dài, xem kết quả đúng dạng sẽ chèn
 * (tiêu đề, danh sách, chữ đậm thật), rồi chèn (thay khối chứa "/ai" nếu gọi từ lệnh gạch chéo). Một bước hoàn tác; không tự chèn khi chưa bấm.
 */
export function AiWrite() {
  const { host, labels, store, ui } = useEditor();
  const t = useMsgs("blocks") as Record<string, string>;
  const [at, setAt] = useState<{ blockId?: string; docId: string; parentId: string | null; index: number } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState<Tone>("auto");
  const [length, setLength] = useState<Length>("medium");
  const [structured, setStructured] = useState(true);
  const [state, setState] = useState<{ loading: boolean; text?: string; nodes?: RichNode[]; error?: string }>({ loading: false });
  useEffect(() => { ui.openAiWrite = (a) => { setAt(a); setPrompt(""); setState({ loading: false }); }; return () => { ui.openAiWrite = null; }; }, [ui]);
  if (!at || !host.ai) return null;
  const run = async () => {
    if (!prompt.trim() || state.loading) return;
    setState({ loading: true });
    const full = composePrompt(prompt, { tone, length, structured });
    try {
      const r = host.ai!.write ? await host.ai!.write(full) : { text: await host.ai!.run("write", full, {}) };
      const text = (r.text ?? "").trim();
      // Khối dạng lưu của máy chủ (nếu có) thắng; không có thì đọc markdown nhẹ trong chữ AI trả về
      const nodes = Array.isArray(r.nodes) && r.nodes.length ? (r.nodes as RichNode[]) : markdownToNodes(text);
      if (!nodes.length) throw new Error("");
      setState({ loading: false, text, nodes });
    } catch (e) { setState({ loading: false, error: friendlyError((e as Error).message ?? "", t) }); }
  };
  const insert = () => {
    if (!state.nodes?.length) return;
    const nodes = state.nodes.map(fromRich);
    store.batch(() => {
      if (at.blockId && store.block(at.blockId)) store.replace(at.blockId, nodes);
      else store.insert(at.docId, at.parentId, at.index, nodes);
    });
    setAt(null);
  };
  const examples = [t.aiwEx1, t.aiwEx2, t.aiwEx3, t.aiwEx4];
  const toneLabel: Record<Tone, string> = { auto: t.aiwToneAuto, friendly: t.aiwToneFriendly, pro: t.aiwTonePro, sell: t.aiwToneSell };
  const lenLabel: Record<Length, string> = { short: t.aiwLenShort, medium: t.aiwLenMedium, long: t.aiwLenLong };
  return (
    <Modal title={labels.aiWrite} onClose={() => setAt(null)} wide>
      <div className="ecx-ai-body" data-ecx-ai-write>
        <textarea className="ecx-input" rows={3} autoFocus value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={labels.aiWritePrompt} data-ai-write-prompt
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(); } }} />
        {!prompt && !state.text && (
          <div className="ecx-ai-chips" role="group" aria-label={t.aiwTryTitle}>
            {examples.map((x) => <button key={x} type="button" className="ecx-chip" onClick={() => setPrompt(x)}>{x}</button>)}
          </div>
        )}
        <div className="ecx-ai-opts">
          <label className="ecx-ai-opt"><span>{t.aiwTone}</span>
            <select className="ecx-input" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>{TONES.map((k) => <option key={k} value={k}>{toneLabel[k]}</option>)}</select></label>
          <label className="ecx-ai-opt"><span>{t.aiwLength}</span>
            <select className="ecx-input" value={length} onChange={(e) => setLength(e.target.value as Length)}>{LENGTHS.map((k) => <option key={k} value={k}>{lenLabel[k]}</option>)}</select></label>
        </div>
        <label className="ecx-check"><input type="checkbox" checked={structured} onChange={(e) => setStructured(e.target.checked)} />{t.aiwStructured}</label>
        {state.loading && <p className="ecx-ai-wait" role="status">{labels.aiWorking}</p>}
        {state.error && <p className="ecx-ai-error" role="alert">{state.error}</p>}
        {state.nodes && <div className="ecx-ai-text" data-ecx-ai-result aria-label={t.aiwPreview}><NodesView nodes={state.nodes} /></div>}
        {state.nodes && <p className="ecx-ai-note">{countWords(state.nodes)} {t.aiwWords}</p>}
        <p className="ecx-ai-note">{labels.aiNote}</p>
        <div className="ecx-popover-actions">
          <button type="button" className="ecx-btn" onClick={() => setAt(null)}>{labels.cancel}</button>
          <button type="button" className="ecx-btn" onClick={() => void run()} disabled={state.loading || !prompt.trim()} data-ai-write-run>{state.nodes ? labels.aiRetry : labels.aiWriteRun}</button>
          {state.nodes && <button type="button" className="ecx-btn ecx-btn-primary" onClick={insert} data-ai-write-insert>{labels.aiInsert}</button>}
        </div>
      </div>
    </Modal>
  );
}
