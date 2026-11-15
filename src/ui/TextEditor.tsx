import { useEffect, useRef } from "react";
import { worldOf } from "../doc/geometry";
import { nodes, setProps, transact } from "../doc/store";
import { fontFamilyCss } from "../doc/text";
import { camera, editor, setEditing } from "../editor/state";
import { stopColor } from "../render/paint";
import { useFrame, useNodeVersion } from "./hooks";

const SLACK = 4;

function TextField({ id }: { id: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useNodeVersion(id);
  useFrame(() => `${camera.x},${camera.y},${camera.zoom}`);
  const node = nodes.get(id);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  if (!node) return null;
  const auto = node.textSizing === "width";
  const slack = auto ? node.fontSize * SLACK : 0;
  const shift = node.textAlign === "left" ? 0 : node.textAlign === "center" ? -slack / 2 : -slack;
  const m = worldOf(id);
  const zoom = camera.zoom;
  const fill = node.fill;

  return (
    <textarea
      ref={ref}
      aria-label="Text"
      spellCheck={false}
      value={node.text}
      onChange={(event) => transact(() => setProps(id, { text: event.target.value }), `text:${id}`)}
      onBlur={() => setEditing("")}
      onKeyDown={(event) => {
        if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
          event.preventDefault();
          setEditing("");
        }
      }}
      style={{
        width: Math.max(1, node.width) + slack,
        height: Math.max(node.height, node.fontSize * node.lineHeight),
        transform: `matrix(${m[0] * zoom},${m[1] * zoom},${m[2] * zoom},${m[3] * zoom},${m[4] * zoom + camera.x},${m[5] * zoom + camera.y}) translate(${shift}px,0)`,
        fontFamily: fontFamilyCss(node.fontFamily),
        fontSize: node.fontSize,
        fontWeight: node.fontWeight,
        lineHeight: node.lineHeight,
        letterSpacing: node.letterSpacing,
        textAlign: node.textAlign,
        whiteSpace: auto ? "pre" : "pre-wrap",
        color: fill ? stopColor({ offset: 0, color: fill.color, opacity: fill.opacity }) : "#000000",
      }}
      className="absolute top-0 left-0 m-0 block origin-top-left resize-none overflow-hidden border-0 bg-transparent p-0 wrap-break-word outline-none"
    />
  );
}

export function TextEditor() {
  const id = useFrame(() => (nodes.get(editor.editing)?.kind === "text" ? editor.editing : ""));
  return id ? <TextField key={id} id={id} /> : null;
}
