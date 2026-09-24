const fs = require("node:fs/promises");
const path = require("node:path");
class JournalStore {
  constructor(directory, validate) {
    this.directory = directory;
    this.file = path.join(directory, "journal.json");
    this.backups = path.join(directory, "backups");
    this.validate = validate;
    this.queue = Promise.resolve();
    this.current = null;
    this.blocked = false;
  }
  async init() {
    await fs.mkdir(this.backups, { recursive: true });
    try {
      this.current = this.validate(
        JSON.parse(await fs.readFile(this.file, "utf8")),
      );
      return { journal: this.current };
    } catch (e) {
      if (e.code === "ENOENT") return { journal: null };
      const files = (await fs.readdir(this.backups))
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse();
      for (const f of files)
        try {
          this.current = this.validate(
            JSON.parse(await fs.readFile(path.join(this.backups, f), "utf8")),
          );
          await fs.copyFile(
            this.file,
            path.join(this.directory, `damaged-${Date.now()}.json`),
          );
          await this.atomic(this.current);
          return {
            journal: this.current,
            notice:
              "Основной файл повреждён. Данные восстановлены из последней исправной резервной копии.",
          };
        } catch {}
      this.blocked = true;
      return {
        journal: null,
        blocked: true,
        notice:
          "Файл данных повреждён. Оригинал сохранён. Восстановите дневник из JSON через кнопку импорта.",
      };
    }
  }
  async atomic(data) {
    const temp = this.file + ".tmp";
    const handle = await fs.open(temp, "w");
    try {
      await handle.writeFile(JSON.stringify(data, null, 2), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temp, this.file);
  }
  save(data, expected, replace = false) {
    const task = this.queue.then(async () => {
      const next = this.validate(data);
      if (this.blocked && !replace)
        throw new Error("Сначала восстановите данные из резервной копии.");
      if (expected !== (this.current?.revision ?? 0))
        throw new Error(
          "Данные уже изменились. Перезапустите приложение перед сохранением.",
        );
      if (this.current)
        await fs.writeFile(
          path.join(
            this.backups,
            `${new Date().toISOString().replace(/[:.]/g, "-")}-${this.current.revision}.json`,
          ),
          JSON.stringify(this.current, null, 2),
          "utf8",
        );
      else if (this.blocked)
        await fs.copyFile(
          this.file,
          path.join(this.directory, `damaged-${Date.now()}.json`),
        );
      next.revision = (this.current?.revision ?? 0) + 1;
      next.updatedAt = new Date().toISOString();
      await this.atomic(next);
      this.current = next;
      this.blocked = false;
      const names = (await fs.readdir(this.backups))
        .filter((f) => f.endsWith(".json"))
        .sort();
      await Promise.all(
        names
          .slice(0, -30)
          .map((f) => fs.unlink(path.join(this.backups, f)).catch(() => {})),
      );
      return next;
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
module.exports = { JournalStore };
