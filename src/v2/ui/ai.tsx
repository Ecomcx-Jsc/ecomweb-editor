import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useEditor } from "../context";
import { inlineText, makeBlock, type BNode } from "../core/model";
import { Modal } from "./options";
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

/**
 * Lệnh /ai: hộp "Viết bằng AI" — gõ yêu cầu, xem kết quả, rồi chèn (thay khối chứa "/ai" nếu gọi từ lệnh gạch chéo).
 * Một bước hoàn tác; không tự chèn khi chưa bấm.
 */
export function AiWrite() {
  const { host, labels, store, ui } = useEditor();
  const [at, setAt] = useState<{ blockId?: string; docId: string; parentId: string | null; index: number } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<{ loading: boolean; text?: string; error?: string }>({ loading: false });
  useEffect(() => { ui.openAiWrite = (a) => { setAt(a); setPrompt(""); setState({ loading: false }); }; return () => { ui.openAiWrite = null; }; }, [ui]);
  if (!at || !host.ai) return null;
  const run = async () => {
    if (!prompt.trim()) return;
    setState({ loading: true });
    try { setState({ loading: false, text: await host.ai!.run("write", prompt.trim(), {}) }); }
    catch (e) { setState({ loading: false, error: (e as Error).message }); }
  };
  const paragraphs = (state.text ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const insert = () => {
    if (!paragraphs.length) return;
    const nodes = paragraphs.map((p) => makeBlock("paragraph", {}, p));
    store.batch(() => {
      if (at.blockId && store.block(at.blockId)) store.replace(at.blockId, nodes);
      else store.insert(at.docId, at.parentId, at.index, nodes);
    });
    setAt(null);
  };
  return (
    <Modal title={labels.aiWrite} onClose={() => setAt(null)} wide>
      <div className="ecx-ai-body" data-ecx-ai-write>
        <textarea className="ecx-input" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={labels.aiWritePrompt} data-ai-write-prompt
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void run(); } }} />
        {state.loading && <p className="ecx-ai-wait" role="status">{labels.aiWorking}</p>}
        {state.error && <p className="ecx-ai-error" role="alert">{state.error}</p>}
        {state.text && <div className="ecx-ai-text" data-ecx-ai-result>{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>}
        <p className="ecx-ai-note">{labels.aiNote}</p>
        <div className="ecx-popover-actions">
          <button type="button" className="ecx-btn" onClick={() => setAt(null)}>{labels.cancel}</button>
          <button type="button" className="ecx-btn" onClick={() => void run()} disabled={state.loading || !prompt.trim()} data-ai-write-run>{state.text ? labels.aiRetry : labels.aiWriteRun}</button>
          {state.text && <button type="button" className="ecx-btn ecx-btn-primary" onClick={insert} data-ai-write-insert>{labels.aiInsert}</button>}
        </div>
      </div>
    </Modal>
  );
}
