import { ScheduleItem } from "../types";

export function generateIcsCalendar(items: ScheduleItem[]): string {
  const formatIcsDate = (dateStr: string, timeStr?: string) => {
    const cleanDate = dateStr.replace(/-/g, "");
    if (timeStr) {
      const cleanTime = timeStr.replace(/:/g, "") + "00";
      return `${cleanDate}T${cleanTime}`;
    }
    return `${cleanDate}T090000`;
  };

  const nowIcs = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  let icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ELARA AI Assistant//Schedule Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  items.forEach((item) => {
    const start = formatIcsDate(item.date, item.time);
    icsContent.push(
      "BEGIN:VEVENT",
      `UID:elara-${item.id}@elara.assistant`,
      `DTSTAMP:${nowIcs}`,
      `DTSTART:${start}`,
      `SUMMARY:${item.title.replace(/[,;]/g, " ")}`,
      `DESCRIPTION:${(item.notes || "Created by ELARA AI Assistant").replace(/[\n\r]/g, " ")}`,
      `PRIORITY:${item.priority === "urgent" ? "1" : item.priority === "high" ? "3" : "5"}`,
      `CATEGORIES:${item.category.toUpperCase()}`,
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  });

  icsContent.push("END:VCALENDAR");
  return icsContent.join("\r\n");
}

export function downloadIcsFile(items: ScheduleItem[], filename = "elara-schedule.ics") {
  const ics = generateIcsCalendar(items);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
