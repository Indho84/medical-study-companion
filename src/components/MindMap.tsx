"use client";

import { useEffect, useRef } from "react";
import type { Markmap } from "markmap-view";

/** Interactive, zoomable mind map rendered from a Markdown outline with markmap. */
export default function MindMap({ markdown }: { markdown: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ Transformer }, { Markmap }] = await Promise.all([import("markmap-lib"), import("markmap-view")]);
      if (cancelled || !svgRef.current) return;
      const { root } = new Transformer().transform(markdown);
      if (!mmRef.current) {
        mmRef.current = Markmap.create(svgRef.current, { initialExpandLevel: 3, duration: 300 });
      }
      await mmRef.current.setData(root);
      await mmRef.current.fit();
    })();
    return () => {
      cancelled = true;
    };
  }, [markdown]);

  useEffect(
    () => () => {
      mmRef.current?.destroy();
      mmRef.current = null;
    },
    [],
  );

  return (
    <div className="stack">
      <div className="mindmap">
        <svg ref={svgRef} />
      </div>
      <div className="row no-print">
        <button onClick={() => mmRef.current?.fit()}>⤢ Fit to screen</button>
        <span className="muted small">Scroll to zoom · drag to pan · click a node to fold/unfold it</span>
      </div>
    </div>
  );
}
