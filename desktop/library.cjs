const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { JournalStore } = require("./store.cjs");

// journal.json remains the active, recoverable journal. Inactive graphs are
// checkpointed before a switch; no existing graph is deleted by creation.
class GraphLibrary {
  constructor(directory, validate) {
    this.store = new JournalStore(directory, validate);
    this.validate = validate;
    this.graphs = path.join(directory, "graphs");
    this.deleted = path.join(directory, "deleted-graphs");
    this.deletedIds = new Set();
    this.queue = Promise.resolve();
  }
  get current() {
    return this.store.current;
  }
  get directory() {
    return this.store.directory;
  }
  get backups() {
    return this.store.backups;
  }
  async init() {
    await fs.mkdir(this.graphs, { recursive: true });
    await fs.mkdir(this.deleted, { recursive: true });
    this.deletedIds = new Set(
      (await fs.readdir(this.deleted)).filter((n) =>
        /^[a-f0-9]{64}\.json$/.test(n),
      ),
    );
    const result = await this.store.init();
    await this.reconcileDeletion();
    await this.purgeExpired();
    if (this.current) await this.archive(this.current);
    return { ...result, journal: this.current };
  }
  filename(id) {
    if (typeof id !== "string" || !id || id.length > 100)
      throw new Error("Некорректный график");
    return path.join(
      this.graphs,
      createHash("sha256").update(id).digest("hex") + ".json",
    );
  }
  async archive(journal) {
    const file = this.filename(journal.id),
      temp = file + ".tmp";
    const handle = await fs.open(temp, "w");
    try {
      await handle.writeFile(JSON.stringify(journal, null, 2), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temp, file);
  }
  isDeleted(id) {
    return this.deletedIds.has(path.basename(this.filename(id)));
  }
  async purgeExpired(now = Date.now()) {
    for (const name of this.deletedIds) {
      const file = path.join(this.deleted, name);
      const stat = await fs.stat(file);
      if (now - stat.mtimeMs < 30 * 86400000) continue;
      const raw = JSON.parse(await fs.readFile(file, "utf8"));
      if (raw.expired) continue;
      // Retain a small tombstone so an old active backup cannot resurrect it.
      await fs.unlink(path.join(this.graphs, name)).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
      await fs.writeFile(
        file + ".tmp",
        JSON.stringify({
          id: raw.id,
          expired: true,
          deletedAt: stat.mtime.toISOString(),
        }),
      );
      await fs.rename(file + ".tmp", file);
    }
  }
  trash() {
    return this.enqueue(async () => {
      await this.purgeExpired();
      const entries = [];
      for (const name of this.deletedIds) {
        const file = path.join(this.deleted, name);
        try {
          const j = this.validate(JSON.parse(await fs.readFile(file, "utf8")));
          const stat = await fs.stat(file);
          entries.push({
            id: j.id,
            name: j.settings.name,
            events: j.events.filter((e) => !e.deletedAt).length,
            expiresAt: new Date(stat.mtimeMs + 30 * 86400000).toISOString(),
          });
        } catch {
          /* Expired tombstones and damaged snapshots are not restorable. */
        }
      }
      return entries;
    });
  }
  restore(id) {
    return this.enqueue(async () => {
      await this.purgeExpired();
      if (!this.isDeleted(id)) throw new Error("График уже восстановлен");
      const file = path.join(this.deleted, path.basename(this.filename(id)));
      const next = this.validate(JSON.parse(await fs.readFile(file, "utf8")));
      if (next.id !== id) throw new Error("Повреждён файл графика");
      if (this.current) await this.archive(this.current);
      await this.archive(next);
      // Remove marker before switching: a crash leaves a visible inactive graph.
      await fs.unlink(file);
      this.deletedIds.delete(path.basename(file));
      return this.store.save(next, this.current?.revision ?? 0, true);
    });
  }
  async reconcileDeletion() {
    if (!this.current || !this.isDeleted(this.current.id)) return;
    for (const name of (await fs.readdir(this.graphs)).sort()) {
      if (!/^[a-f0-9]{64}\.json$/.test(name) || this.deletedIds.has(name))
        continue;
      let next;
      try {
        next = this.validate(
          JSON.parse(await fs.readFile(path.join(this.graphs, name), "utf8")),
        );
      } catch {
        continue;
      }
      if (this.isDeleted(next.id)) continue;
      await this.store.save(next, this.current.revision, true);
      return;
    }
    await fs.unlink(this.store.file).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    this.store.current = null;
  }
  remove(id) {
    return this.enqueue(async () => {
      if (this.isDeleted(id)) throw new Error("График уже удалён");
      const target =
        id === this.current?.id
          ? this.current
          : this.validate(
              JSON.parse(await fs.readFile(this.filename(id), "utf8")),
            );
      if (target.id !== id) throw new Error("Повреждён файл графика");
      // The durable recovery copy is also the deletion marker. Startup finishes
      // an interrupted switch; archived snapshots can never resurrect this id.
      const file = path.join(this.deleted, path.basename(this.filename(id)));
      const handle = await fs.open(file + ".tmp", "w");
      try {
        await handle.writeFile(JSON.stringify(target, null, 2), "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(file + ".tmp", file);
      this.deletedIds.add(path.basename(file));
      await this.reconcileDeletion();
      return this.current;
    });
  }
  enqueue(work) {
    const task = this.queue.then(work);
    this.queue = task.catch(() => {});
    return task;
  }
  save(data, expected, replace = false) {
    return this.enqueue(async () => {
      if (this.isDeleted(data.id) && !replace)
        throw new Error("Этот график удалён");
      if (!replace && this.current && data.id !== this.current.id)
        throw new Error("График уже переключён");
      if (!replace) {
        const { assertPriceChange } = await import("../src/price-policy.mjs");
        assertPriceChange(this.current, this.validate(data));
      }
      if (replace && this.current) await this.archive(this.current);
      const saved = await this.store.save(data, expected, replace);
      if (replace && this.isDeleted(saved.id)) {
        await fs.unlink(
          path.join(this.deleted, path.basename(this.filename(saved.id))),
        );
        this.deletedIds.delete(path.basename(this.filename(saved.id)));
      }
      return saved;
    });
  }
  async list() {
    await this.queue;
    const entries = new Map();
    for (const name of await fs.readdir(this.graphs)) {
      if (!/^[a-f0-9]{64}\.json$/.test(name) || this.deletedIds.has(name))
        continue;
      const file = path.join(this.graphs, name);
      try {
        const j = this.validate(JSON.parse(await fs.readFile(file, "utf8")));
        if (!this.isDeleted(j.id)) entries.set(j.id, j);
      } catch {
        /* Invalid inactive files remain on disk, never overwritten here. */
      }
    }
    if (this.current && !this.isDeleted(this.current.id))
      entries.set(this.current.id, this.current);
    return [...entries.values()].map((j) => ({
      id: j.id,
      name: j.settings.name,
      initial: j.settings.initial,
      events: j.events.filter((e) => !e.deletedAt).length,
      updatedAt: j.updatedAt,
      active: j.id === this.current?.id,
    }));
  }
  create(data) {
    return this.enqueue(async () => {
      const { assertPriceChange } = await import("../src/price-policy.mjs");
      assertPriceChange(null, this.validate(data));
      const next = this.validate(data);
      if (this.isDeleted(next.id))
        throw new Error(
          "Этот график удалён. Для восстановления используй импорт.",
        );
      if (next.id === this.current?.id)
        throw new Error("График уже существует");
      if (next.events.length || next.days.length)
        throw new Error("Новый график должен быть пустым");
      try {
        await fs.access(this.filename(next.id));
        throw new Error("График уже существует");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      if (this.current) await this.archive(this.current);
      return this.store.save(next, this.current?.revision ?? 0, false);
    });
  }
  open(id) {
    return this.enqueue(async () => {
      if (this.isDeleted(id)) throw new Error("Этот график удалён");
      if (id === this.current?.id) return this.current;
      const next = this.validate(
        JSON.parse(await fs.readFile(this.filename(id), "utf8")),
      );
      if (next.id !== id) throw new Error("Повреждён файл графика");
      if (this.current) await this.archive(this.current);
      return this.store.save(next, this.current?.revision ?? 0, true);
    });
  }
}
module.exports = { GraphLibrary };
