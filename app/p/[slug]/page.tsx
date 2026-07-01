// Real Artifact Pipeline (#5): the PUBLIC share page. No auth — anyone with the
// link sees one piece of finished work, presented on warm paper. Only renders
// when the artifact exists AND has been explicitly marked shared. No student PII
// beyond the work's own title.

import { notFound } from "next/navigation";
import { getArtifactBySlug } from "@/lib/artifacts/store";

export const dynamic = "force-dynamic";

function isImage(mimeType: string | null): boolean {
  return !!mimeType && mimeType.startsWith("image/");
}

export default async function SharedArtifactPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artifact = await getArtifactBySlug(slug);
  if (!artifact || !artifact.shared) notFound();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-passionfruit-paper px-4 py-10">
      <main className="w-full max-w-2xl">
        {/* brand */}
        <div className="mb-6 flex items-center gap-2">
          <span className="h-[22px] w-[22px] rounded-[7px] bg-passionfruit-accent" />
          <span className="font-display text-[19px] font-semibold text-passionfruit-ink">
            Passionfruit
          </span>
        </div>

        <article className="card-sheet">
          <span className="eyebrow">Shared work</span>
          <h1 className="mt-1 font-display text-[24px] font-semibold leading-tight text-passionfruit-ink">
            {artifact.title}
          </h1>

          {artifact.text && artifact.text !== artifact.title && (
            <p className="mt-2 text-[14px] leading-[1.55] text-passionfruit-muted">
              {artifact.text}
            </p>
          )}

          {artifact.url && (
            <div className="mt-4">
              {isImage(artifact.mimeType) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={artifact.url}
                  alt={artifact.title}
                  className="w-full rounded-2xl border border-passionfruit-line"
                />
              ) : (
                <a
                  href={artifact.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-sm"
                >
                  Open the work ↗
                </a>
              )}
            </div>
          )}
        </article>

        <footer className="mt-6 text-center text-[12px] text-passionfruit-faint">
          Made with Passionfruit 🌱
        </footer>
      </main>
    </div>
  );
}
