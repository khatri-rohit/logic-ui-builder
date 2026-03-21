import {} from "stream";
import { Editor } from "tldraw";

// hooks/useGenerationStream.ts
export function useGenerationStream(editor: Editor) {
  //   const store = useGenerationStore()

  async function generate(prompt: string) {
    const res = await fetch("/api/generate", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
    if(!res.body) return
    console.log(res);
   

    // for await (const chunk of readLines(reader, decoder)) {
    //   const event = JSON.parse(chunk.replace("data: ", ""));
    //   console.log(event);
    //   if (event.type === "spec") {
    //     // Phase 1 → place ghost frames immediately
    //     event.spec.screens.forEach((name: string, i: number) => {
    //       const id = createShapeId();
    //       store.registerFrame(name, id);
    //       editor.createShape<any>({
    //         id,
    //         type: "phone-frame",
    //         x: 60 + i * 240,
    //         y: 80,
    //         props: {
    //           screenName: name,
    //           state: "skeleton",
    //           srcdoc: "",
    //           platform: event.spec.platform,
    //           w: 200,
    //           h: 380,
    //         },
    //       });
    //     });
    //     editor.zoomToFit({ animation: { duration: 400 } });
    //   }

    //   if (event.type === "tree") {
    //     // Phase 2 → confirm positions, update labels
    //     event.tree.forEach((node: any) => {
    //       const id = store.getFrameId(node.screen);
    //       editor.updateShape({ id, x: node.canvasX, y: node.canvasY });
    //     });
    //   }

    //   if (event.type === "code_chunk") {
    //     // Phase 3 → accumulate + compile
    //     store.appendChunk(event.screen, event.delta);
    //     const buffer = store.getBuffer(event.screen);

    //     // Compile in Web Worker (non-blocking)
    //     compilerWorker.postMessage({ screenName: event.screen, code: buffer });
    //   }

    //   if (event.type === "done") {
    //     // Phase 4 → finalize all frames
    //     editor.selectAll();
    //     editor.zoomToFit({ animation: { duration: 600 } });
    //     editor.selectNone();
    //     await saveProject(editor.store.getSnapshot());
    //   }
    // }
  }

  // Web Worker response → update iframe srcdoc
  //   compilerWorker.onmessage = (e) => {
  //     const { screenName, html } = e.data
  //     const id = store.getFrameId(screenName)
  //     editor.updateShape<PhoneFrameShape>({
  //       id,
  //       props: { state: 'done', srcdoc: html }
  //     })
  //   }

  return { generate };
}
