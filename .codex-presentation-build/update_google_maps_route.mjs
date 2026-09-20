import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "D:/projek UMKM/gis-umkm-mapping-main";
const skillDir = "C:/Users/TUF GAMING/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const runtimePython = "C:/Users/TUF GAMING/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
const sourcePath = path.join(workspaceDir, "Presentasi_Skripsi_Putra_Febrian_12_Slide_Menarik_YBLI (1).pptx");
const finalPath = path.join(workspaceDir, "output", "Presentasi_Skripsi_Putra_Febrian_12_Slide_Menarik_YBLI_pembaruan_google_maps_rute.pptx");
const stagingDir = path.join(workspaceDir, ".codex-finalizer");
const candidatePath = path.join(stagingDir, "presentasi-ybli-google-maps-rute-candidate.pptx");

const { finalizePresentation, makeNativeBulletParagraphs } = await import(
  pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href,
);

if (await fs.stat(finalPath).then(() => true).catch(() => false)) {
  throw new Error(`Output already exists: ${finalPath}`);
}

await fs.mkdir(stagingDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));

const evaluationSlide = presentation.resolve("sl/jetc3ut0");
const evaluationChart = presentation.resolve("ch/nqxsbmpo");
const evaluationPreview = await evaluationSlide.export({ format: "png", scale: 1 });
const evaluationChartImage = await sharp(Buffer.from(await evaluationPreview.arrayBuffer()))
  .extract({ left: 82, top: 139, width: 677, height: 418 })
  .png()
  .toBuffer();
evaluationSlide.charts.deleteById(evaluationChart.id);
evaluationSlide.images.add({
  blob: evaluationChartImage,
  contentType: "image/png",
  alt: "Grafik evaluasi nilai K dari slide asli",
  fit: "cover",
  position: { left: 81.6, top: 139.2, width: 676.8, height: 417.6 },
});
evaluationSlide.speakerNotes.append(
  "\nGrafik evaluasi nilai K dipertahankan sebagai gambar dari slide asli agar visualnya tidak berubah pada pembaruan ini.",
);

const problemSlide = presentation.resolve("sl/ofy9wn61");
const problemList = presentation.resolve("sh/m5cra54z");
const problemSummary = presentation.resolve("sh/n2l4fq98");

problemList.text = makeNativeBulletParagraphs([
  "Data UMKM yang hanya berbentuk tabel sulit menunjukkan pola persebaran.",
  "Peta interaktif membantu pengguna melihat lokasi, mencari, dan memfilter UMKM.",
  "Masalah utama penelitian adalah kualitas koordinat yang belum semuanya presisi.",
  "Sistem perlu membedakan data untuk tampilan peta dan data untuk analisis.",
  "Mitra mempertimbangkan Google Maps, tetapi biaya layanan dinilai tinggi.",
], {
  marginLeftPoints: 18,
  hangingPoints: 9,
  spaceAfterPoints: 4,
});
problemList.text.style = {
  typeface: "Aptos",
  fontSize: 24,
  color: "#1E2D36",
  autoFit: "shrinkText",
};
problemSummary.text.replace(
  "Inti masalah: data UMKM perlu dibaca secara spasial, bukan hanya administratif.",
  "Inti masalah: YBLI membutuhkan peta dan rute yang informatif serta terjangkau.",
);
problemSlide.speakerNotes.append(
  "\nTambahan masalah: YBLI mempertimbangkan Google Maps untuk menampilkan sebaran UMKM, tetapi biaya layanan dinilai tinggi. Sistem menyediakan peta interaktif dan fitur rute sebagai solusi.\nSumber tambahan: hasil diskusi dengan mitra YBLI yang disampaikan oleh penulis.",
);

const solutionSlide = presentation.resolve("sl/i107q5of");
const solutionBanner = presentation.resolve("sh/l4bupwny");
const publicDescription = presentation.resolve("sh/w32dkbuh");

solutionBanner.text.replace(
  "Aplikasi menghubungkan data UMKM, peta interaktif, pengajuan publik, verifikasi lokasi, dan analisis K-Means.",
  "Aplikasi menghubungkan data UMKM, peta interaktif, rute, pengajuan publik, verifikasi lokasi, dan analisis K-Means.",
);
publicDescription.text.replace(
  "Melihat peta, mencari UMKM, filter kategori, melihat rute, menemukan UMKM terdekat, berbagi tautan, dan mengajukan UMKM baru.",
  "Melihat peta, mencari UMKM, filter kategori, memakai fitur rute, menemukan UMKM terdekat, berbagi tautan, dan mengajukan UMKM baru.",
);
solutionSlide.speakerNotes.append(
  "\nFitur rute membantu pengguna menuju lokasi UMKM tanpa YBLI bergantung pada layanan peta berbiaya tinggi.",
);

await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const referenceSha256 = crypto.createHash("sha256").update(await fs.readFile(sourcePath)).digest("hex");
const result = await finalizePresentation({
  explicitTotalSlideCount: 12,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "12192000,6858000",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
  ],
  fontPolicy: {
    basis: "reference",
    families: ["Aptos", "Aptos Display"],
    referencePath: sourcePath,
    referenceSha256,
  },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "presentasi-ybli-google-maps-rute.validation.json"),
});

console.log(JSON.stringify({ finalPath, result }, null, 2));
