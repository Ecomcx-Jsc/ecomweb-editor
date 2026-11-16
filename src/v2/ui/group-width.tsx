import { useMsgs } from "../i18n";
import { Row, Section, Seg } from "./style-controls";
import { UnitInput } from "./unit-controls";

type Mode = "fill" | "site" | "custom";

/**
 * Độ rộng của Nhóm ở tab Cài đặt (thay cho nút "Độ rộng" rời + ô tích "giữ chữ theo bề rộng cột chữ"):
 * độ rộng của khối (nội dung / rộng / đầy màn) và độ rộng nội dung bên trong (hết khối / theo website / tự nhập số).
 */
export function GroupWidthSection({ attrs, setAttrs }: { attrs: Record<string, unknown>; setAttrs(a: Record<string, unknown>): void }) {
  const t = useMsgs("layout") as Record<string, string>;
  const align = attrs.align === "wide" || attrs.align === "full" ? (attrs.align as string) : "content";
  const custom = typeof attrs.contentWidth === "string" && attrs.contentWidth !== "";
  const mode: Mode = custom ? "custom" : attrs.constrained === true ? "site" : "fill";
  const setMode = (m: Mode | undefined) => {
    if (m === "custom") setAttrs({ contentWidth: String(attrs.contentWidth || "900px"), constrained: undefined });
    else setAttrs({ contentWidth: undefined, constrained: m === "site" ? true : undefined });
  };
  return (
    <Section title={t.groupWidth} defaultOpen>
      <Row label={t.blockWidth}>
        <Seg label={t.blockWidth} value={align} onChange={(v) => setAttrs({ align: v === "wide" || v === "full" ? v : undefined })}
          options={[["content", t.bwContent, t.bwContent], ["wide", t.bwWide, t.bwWide], ["full", t.bwFull, t.bwFull]]} />
      </Row>
      <Row label={t.contentWidth}>
        <Seg<Mode> label={t.contentWidth} value={mode} onChange={setMode}
          options={[["fill", t.cwFill, t.cwFill], ["site", t.cwSite, t.cwSite], ["custom", t.cwCustom, t.cwCustom]]} />
      </Row>
      {custom && (
        <Row label={t.cwValue} onReset={() => setAttrs({ contentWidth: undefined })}>
          <UnitInput label={t.cwValue} value={String(attrs.contentWidth)} max={1600} units={["px", "rem", "%"]} onChange={(v) => setAttrs({ contentWidth: v })} />
        </Row>
      )}
      <p className="ecx-muted">{t.cwHelp}</p>
    </Section>
  );
}
