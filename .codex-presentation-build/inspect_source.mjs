import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "D:/projek UMKM/gis-umkm-mapping-main";
const sourcePath = path.join(workspaceDir, "Presentasi_Skripsi_Putra_Febrian_12_Slide_Menarik_YBLI (1).pptx");
const outputDir = path.join(workspaceDir, ".codex-presentation-build", "source-review");

await fs.mkdir(outputDir, { recursive: true });

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const snapshot = await presentation.inspect({
  kind: "deck,slide,textbox,shape,image,table,chart,notes,layout",
  include: "id,slide,name,title,text,textPreview,textChars,textLines,bbox,bboxUnit,isPlaceholder,placeholders",
  maxChars: 30000,
});
await fs.writeFile(path.join(outputDir, "inspect.ndjson"), snapshot.ndjson);

const problemSlide = presentation.resolve("sl/ofy9wn61");
const problemLayout = await problemSlide.export({ format: "layout" });
await fs.writeFile(path.join(outputDir, "slide-03.layout.json"), await problemLayout.text());

const solutionSlide = presentation.resolve("sl/i107q5of");
const solutionLayout = await solutionSlide.export({ format: "layout" });
await fs.writeFile(path.join(outputDir, "slide-05.layout.json"), await solutionLayout.text());

const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
await fs.writeFile(path.join(outputDir, "montage.webp"), new Uint8Array(await montage.arrayBuffer()));

for (let index = 0; index < presentation.slides.items.length; index += 1) {
  const slide = presentation.slides.getItem(index);
  const preview = await slide.export({ format: "png", scale: 1 });
  await fs.writeFile(
    path.join(outputDir, `slide-${String(index + 1).padStart(2, "0")}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}

console.log(snapshot.ndjson);
