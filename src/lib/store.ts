import fs from "node:fs/promises";
import path from "node:path";
import { CONTENT_VERSION, emptyContent, type ContentFile } from "@/lib/content-types";

// The ONLY module allowed to touch content.json (see AGENTS.md).
// The file lives OUTSIDE the build directory so deploys never destroy it:
//   dev: ./data/content.json     prod: /srv/edit/shared/content.json (env CONTENT_FILE)

export function contentFilePath(): string {
  return path.resolve(
    // turbopackIgnore: runtime-only path, must not be traced into the build output
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.CONTENT_FILE ?? "./data/content.json"
  );
}

// Cache and write queue are parked on globalThis for the same reason a database
// client would be: a dev hot-reload re-evaluates this module, and dropping the
// queue mid-flight would let two writers race on a read-modify-write.
type StoreState = { cache?: ContentFile; queue?: Promise<unknown> };
const globalForStore = globalThis as unknown as { __contentStore?: StoreState };
const state: StoreState = (globalForStore.__contentStore ??= {});

async function loadFromDisk(): Promise<ContentFile> {
  const file = contentFilePath();
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (error) {
    // Fresh install: behave like an empty catalogue rather than crashing, and
    // let the first write create the file.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyContent();
    throw error;
  }

  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as ContentFile).version !== CONTENT_VERSION ||
    !Array.isArray((parsed as ContentFile).books)
  ) {
    throw new Error(
      `Unsupported content file at ${file} — expected { "version": ${CONTENT_VERSION}, "books": [] }`
    );
  }
  return parsed as ContentFile;
}

/**
 * Reads the whole content file (cached in memory after the first call).
 * The returned object is shared — treat it as read-only. To change anything,
 * go through mutateContent.
 */
export async function readContent(): Promise<ContentFile> {
  state.cache ??= await loadFromDisk();
  return state.cache;
}

async function writeToDisk(content: ContentFile): Promise<void> {
  const target = contentFilePath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  // Write next to the target (same filesystem) then rename: an interrupted write
  // leaves the previous file intact instead of a truncated one.
  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(content, null, 2), "utf8");
  await fs.rename(temp, target);
}

/**
 * Applies a mutation to the content file and persists it atomically.
 * Mutations are serialised: the whole file is a read-modify-write, so a second
 * writer starting from a stale draft would silently drop the first one.
 */
export async function mutateContent<T>(
  mutator: (draft: ContentFile) => T | Promise<T>
): Promise<T> {
  const run = async (): Promise<T> => {
    // Work on a copy: a mutator that throws must not leave the cache half-edited.
    const draft = structuredClone(await readContent());
    const result = await mutator(draft);
    await writeToDisk(draft);
    state.cache = draft;
    return result;
  };

  // Chain onto the previous mutation whether it settled or failed.
  const next = (state.queue ?? Promise.resolve()).then(run, run);
  state.queue = next.catch(() => undefined);
  return next;
}
