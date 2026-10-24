import { Navbar } from "@/components/Navbar";
import { UploadDropzone } from "@/components/UploadDropzone";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <UploadDropzone />
      </main>
      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
        LogLens MVP — Built with Next.js, FastAPI, Gemma 3, Drain3, and HDBSCAN.
      </footer>
    </div>
  );
}
