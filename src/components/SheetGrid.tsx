import { memo, useCallback, useMemo, useRef } from "react";
import { colLetter } from "../lib/sheet.js";
import { cssRgb, luminance, paint, shadowsFor, stickyOffsets } from "../lib/grid.js";

/* The sheet as the Google Sheets app draws it: column letters across the top, row numbers down the side, the frozen rows and
   columns held in place while the rest scrolls, each cell in its own colour, bold, size and alignment, merged cells as one,
   a heavier line where the freeze stops, a dog-ear on cells that carry a note. Tapping a cell selects it. Hidden rows and
   columns are already left out of the model. `model` is what lib/grid.js built. */
export const HEAD_W = 34, HEAD_H = 22;

type Props = { model: any; zoom: number; dark: boolean; height: string; onSelect: (r: number, c: number) => void };

function SheetGrid({ model, zoom, dark, height, onSelect }: Props) {
  const off = useMemo(() => stickyOffsets(model, HEAD_W, HEAD_H, zoom), [model, zoom]);
  const totalW = useMemo(() => HEAD_W * zoom + model.colW.reduce((a: number, b: number) => a + b, 0) * zoom, [model, zoom]);
  const selected = useRef<HTMLElement | null>(null);
  const gridline = dark ? "#3c4043" : "#e1e3e6", freeze = dark ? "#9aa0a6" : "#80868b";

  // selection is moved by hand (not through React state) so tapping a cell does not redraw thousands of cells
  const click = useCallback((e: React.MouseEvent) => {
    const td = (e.target as HTMLElement).closest("td") as HTMLElement | null;
    if (!td || td.dataset.r == null) return;
    selected.current?.classList.remove("gs-sel");
    td.classList.add("gs-sel"); selected.current = td;
    onSelect(Number(td.dataset.r), Number(td.dataset.c));
  }, [onSelect]);

  const px = (n: number) => Math.max(1, Math.round(n * zoom));
  return (
    <div className="gs-scroll" style={{ height }} role="region" aria-label="Spreadsheet" tabIndex={0}>
      <table className="gs-table" style={{ width: totalW }}>
        <colgroup>
          <col style={{ width: px(HEAD_W) }} />
          {model.colIdx.map((c: number, i: number) => <col key={c} style={{ width: px(model.colW[i]) }} />)}
        </colgroup>
        <thead>
          <tr style={{ height: px(HEAD_H) }}>
            <th style={{ left: 0, top: 0, zIndex: 7 }} aria-hidden><div className="gs-in" style={{ height: px(HEAD_H) }} /></th>
            {model.colIdx.map((c: number, i: number) => {
              const f = i < model.frozenCols;
              return <th key={c} style={{ top: 0, left: f ? off.left[i] : undefined, zIndex: f ? 6 : 5, fontSize: 11 * zoom, boxShadow: i === model.frozenCols - 1 ? `inset -2px -1px 0 0 ${freeze}` : undefined }}><div className="gs-in" style={{ height: px(HEAD_H), justifyContent: "center" }}>{colLetter(c + 1)}</div></th>;
            })}
          </tr>
        </thead>
        <tbody onClick={click}>
          {model.rowIdx.map((r: number, ri: number) => {
            const frow = ri < model.frozenRows;
            const lastFrow = frow && ri === model.frozenRows - 1;
            return (
              <tr key={r} style={{ height: px(model.rowH[ri]) }}>
                <th scope="row" style={{ left: 0, top: frow ? off.top[ri] : undefined, zIndex: frow ? 6 : 4, fontSize: 11 * zoom, boxShadow: lastFrow ? `inset 0 -2px 0 0 ${freeze}, inset -1px 0 0 0 ${gridline}` : undefined }}><div className="gs-in" style={{ height: px(model.rowH[ri]), justifyContent: "center" }}>{r + 1}</div></th>
                {model.colIdx.map((c: number, ci: number) => {
                  const key = `${r},${c}`;
                  if (model.covered.has(key)) return null;
                  const cell = model.cell(r, c);
                  const p = paint(cell, dark);
                  const sp = model.span.get(key);
                  const fcol = ci < model.frozenCols;
                  const lastFcol = fcol && ci === model.frozenCols - 1;
                  const wrap = cell?.wrap === "wrap";
                  let innerH = px(model.rowH[ri]);                                     // a merged cell is as tall as the rows it covers
                  if (sp) { innerH = 0; for (let k = 0; k < sp.rs; k++) innerH += px(model.rowH[ri + k] || 0); }
                  const deco = [cell?.underline ? "underline" : "", cell?.strike ? "line-through" : ""].filter(Boolean).join(" ");
                  return (
                    <td key={c} data-r={r} data-c={c} rowSpan={sp?.rs} colSpan={sp?.cs}
                      style={{
                        background: cssRgb(p.bg), color: cssRgb(p.fg),
                        fontSize: (cell?.size || 10) * 1.333 * zoom, fontWeight: cell?.bold ? 700 : 400, fontStyle: cell?.italic ? "italic" : "normal",
                        textDecoration: deco || undefined,
                        position: fcol || frow ? "sticky" : undefined, left: fcol ? off.left[ci] : undefined, top: frow ? off.top[ri] : undefined,
                        zIndex: fcol && frow ? 3 : fcol || frow ? 2 : undefined,
                        boxShadow: shadowsFor(cell, { grid: !model.hideGridlines, gridline, freezeRight: lastFcol ? freeze : "", freezeBottom: lastFrow ? freeze : "" }) || undefined,
                      }}>
                      <div className="gs-in" style={{ height: innerH, justifyContent: cell?.va === "top" ? "flex-start" : cell?.va === "middle" ? "center" : "flex-end", textAlign: cell?.ha || "left" }}>
                        <div className="gs-txt" style={{ whiteSpace: wrap ? "pre-wrap" : "nowrap", wordBreak: wrap ? "break-word" : undefined }}>
                          {cell?.link ? <span style={{ color: dark ? "#8ab4f8" : "#1a0dab", textDecoration: "underline" }}>{cell.v}</span> : cell?.v}
                        </div>
                      </div>
                      {cell?.note ? <span className="gs-note" style={{ color: cell.bg && luminance(cell.bg) < 0.5 ? "#fff" : "#000" }} aria-hidden /> : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export default memo(SheetGrid);
