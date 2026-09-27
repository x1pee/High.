import { localizeUI } from "./i18n.mjs";
export const CHART_PHRASES = [
  localizeUI("Одна красная свеча не отменяет весь твой рост."),
  localizeUI("Коррекция — тоже часть пути."),
  localizeUI("Не каждый день обязан закрываться в плюс."),
  localizeUI("За каждой свечой — больше, чем число."),
  localizeUI("Твой темп важнее чужого графика."),
  localizeUI("Маленькие шаги тоже меняют траекторию."),
  localizeUI("Пауза не обнуляет пройденный путь."),
  localizeUI("Один день — только часть большой истории."),
  localizeUI("Сегодняшний спад не определяет завтрашний день."),
  localizeUI("Необязательно обновлять максимум каждый день."),
  localizeUI("Ты больше, чем итог на графике."),
  localizeUI("Тихие дни тоже заслуживают места в истории."),
  localizeUI("Важное не всегда выглядит как большой скачок."),
  localizeUI("За небольшим плюсом может стоять большая работа."),
  localizeUI("Отдых тоже помогает двигаться дальше."),
  localizeUI("У каждого участка пути свой ритм."),
  localizeUI("На длинной дистанции видны даже маленькие перемены."),
  localizeUI("Сохраняй моменты, к которым захочется вернуться."),
  localizeUI("Можно начать новый день с небольшой победы."),
  localizeUI("График хранит твою историю, а не выставляет оценку."),
];

export function nextChartPhrase(previous, random = Math.random) {
  const choices = CHART_PHRASES.filter((p) => p !== previous);
  return choices[Math.floor(random() * choices.length)];
}
