import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "../api";

const TREATMENT_COLORS = {
  "定期検診":           { bg: "#4A90D9", light: "#EBF4FF", text: "#1a5fa8", border: "#2171c7" },
  "クリーニング(PMTC)": { bg: "#27AE60", light: "#EDFAF1", text: "#1e8449", border: "#1e8449" },
  "虫歯治療":           { bg: "#E8534A", light: "#FFF0EF", text: "#c0392b", border: "#c0392b" },
  "抜歯":               { bg: "#8E44AD", light: "#F5EEF8", text: "#6c3483", border: "#6c3483" },
  "クラウン・補綴":     { bg: "#D35400", light: "#FEF5EC", text: "#b7440b", border: "#b7440b" },
  "ホワイトニング":     { bg: "#2980B9", light: "#EBF5FB", text: "#1f618d", border: "#1f618d" },
  "インプラント相談":   { bg: "#16A085", light: "#E8F8F5", text: "#0e6655", border: "#0e6655" },
  "歯周病治療":         { bg: "#F39C12", light: "#FEF9E7", text: "#d68910", border: "#d68910" },
  "その他":             { bg: "#95A5A6", light: "#F4F6F6", text: "#717d7e", border: "#717d7e" },
};
const DEFAULT_COLOR = { bg: "#4A90D9", light: "#EBF4FF", text: "#1a5fa8", border: "#2171c7" };

function getTreatmentColor(treatmentType) {
  return TREATMENT_COLORS[treatmentType] || DEFAULT_COLOR;
}
function toMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.toString().substring(0, 5).split(":").map(Number);
  return h * 60 + m;
}
function toTimeStr(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

export default function CalendarPage() {
  const [searchParams] = useSearchParams(); 
  const [viewType, setViewType]           = useState(() => {
    const v = searchParams.get("view")
    return (v === "month" || v === "week" || v === "week5") ? v : "day"
  }); 
  const [viewMode, setViewMode]           = useState("chair");
  const [selectedDate, setSelectedDate]   = useState(
    searchParams.get("date") || new Date().toISOString().split("T")[0]
  );
  const [currentMonth, setCurrentMonth]   = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });
  const [calendarData, setCalendarData]   = useState(null);
  const [monthData, setMonthData]         = useState({});
  const [weekData, setWeekData]           = useState({}); 
  const [loading, setLoading]             = useState(false);
  const [dragging, setDragging]           = useState(null);
  const [dragOver, setDragOver]           = useState(null);
  const [newApptModal, setNewApptModal]   = useState(null);
  const [detailModal, setDetailModal]     = useState(null);
  const [allStaff, setAllStaff]           = useState([]);
  const [now, setNow]                     = useState(new Date());
  const timelineRef                       = useRef(null); 
  const [tooltip, setTooltip]             = useState({ visible: false, appt: null, x: 0, y: 0 });
  const [showManual, setShowManual]       = useState(false);

  function handleManualClick() {
    const mode = localStorage.getItem("manual_display_mode") || "newtab";
    if (mode === "newtab") {
      window.open("/manual.html", "_blank");
    } else {
      setShowManual(prev => !prev);
    }
  }

  function getWeekStart(dateStr) {
    const d = new Date(dateStr);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split("T")[0];
  }
  function getWeekDates(dateStr) {
    const start = getWeekStart(dateStr);
    return Array.from({length: 7}, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/appointments/calendar/" + selectedDate);
      setCalendarData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedDate]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  useEffect(() => {
    axios.get("/api/staff").then(r => {
      const list = r.data?.staff || r.data || [];
      setAllStaff(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  const fetchMonth = useCallback(async () => {
    try {
      const [year, month] = currentMonth.split("-").map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const promises = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        promises.push(
          axios.get("/api/appointments/calendar/" + dateStr)
            .then(r => ({ date: dateStr, data: r.data }))
            .catch(() => ({ date: dateStr, data: null }))
        );
      }
      const results = await Promise.all(promises);
      const map = {};
      results.forEach(({ date, data }) => { map[date] = data; });
      setMonthData(map);
    } catch (err) { console.error(err); }
  }, [currentMonth]);

  useEffect(() => { if (viewType === "month") fetchMonth(); }, [viewType, fetchMonth]);

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    try {
      const dates = getWeekDates(selectedDate);
      const results = await Promise.all(
        dates.map(d =>
          axios.get("/api/appointments/calendar/" + d)
            .then(r => ({ date: d, data: r.data }))
            .catch(() => ({ date: d, data: null }))
        )
      );
      const map = {};
      results.forEach(({ date, data }) => { map[date] = data; });
      setWeekData(map);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedDate]);

  useEffect(() => { if (viewType === "week" || viewType === "week5") fetchWeek(); }, [viewType, fetchWeek, selectedDate]);

  if (viewType === "month") {
    return (
      <MonthView
        currentMonth={currentMonth}
        monthData={monthData}
        onPrevMonth={() => {
          const [y, m] = currentMonth.split("-").map(Number);
          const d = new Date(y, m-2, 1);
          setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
        }}
        onNextMonth={() => {
          const [y, m] = currentMonth.split("-").map(Number);
          const d = new Date(y, m, 1);
          setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
        }}
        onSelectDate={date => { setSelectedDate(date); setViewType("day"); }}
        onSwitchToDay={(v) => setViewType(v || "day")}
      />
    );
  }

  if (viewType === "week" || viewType === "week5") {
    return (
      <WeekView
        selectedDate={selectedDate}
        weekData={weekData}
        viewMode={viewMode}
        allStaff={allStaff}
        loading={loading}
        now={now}
        weekOnly={viewType === "week5"}
        onSelectDate={date => { setSelectedDate(date); setViewType("day"); }}
        onPrevWeek={() => {
          const d = new Date(selectedDate); d.setDate(d.getDate() - 7);
          setSelectedDate(d.toISOString().split("T")[0]);
        }}
        onNextWeek={() => {
          const d = new Date(selectedDate); d.setDate(d.getDate() + 7);
          setSelectedDate(d.toISOString().split("T")[0]);
        }}
        onSwitchView={v => setViewType(v)}
        onViewModeChange={m => setViewMode(m)}
        onRefresh={fetchWeek}
      />
    );
  }

  if (!calendarData) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  const { settings, chairs, slots: clinicSlots, appointments, blocks } = calendarData;

  const displayStart   = settings.displayStart || settings.openTime;
  const displayEnd     = settings.displayEnd   || settings.closeTime;
  const openMin        = toMinutes(displayStart);
  const closeMin       = toMinutes(displayEnd);

  const dow = new Date(selectedDate).getDay();
  const customHour = settings.customHours?.[dow];
  let clinicOpenMin, clinicCloseMin;
  if (customHour) {
    try {
      const parsed = typeof customHour === "string" ? JSON.parse(customHour) : customHour;
      clinicOpenMin  = toMinutes(parsed.open  || settings.openTime);
      clinicCloseMin = toMinutes(parsed.close || settings.closeTime);
    } catch {
      clinicOpenMin  = toMinutes(settings.openTime);
      clinicCloseMin = toMinutes(settings.closeTime);
    }
  } else {
    clinicOpenMin  = toMinutes(settings.openTime);
    clinicCloseMin = toMinutes(settings.closeTime);
  }

  const openDays   = settings.openDays || [1,2,3,4,5,6];
  const isClosedDay = !openDays.includes(dow);

  function genExtraSlots(fromMin, toMin, dur) {
    const s = [];
    let c = fromMin;
    while (c + dur <= toMin) { s.push(toTimeStr(c)); c += dur; }
    return s;
  }
  const extraBefore = genExtraSlots(openMin, clinicOpenMin, settings.slotDuration);
  const extraAfter  = genExtraSlots(clinicCloseMin, closeMin, settings.slotDuration);
  const slots = [...extraBefore, ...clinicSlots, ...extraAfter];
  const totalMin = closeMin - openMin;
  const SLOT_HEIGHT   = 72;
  const HEADER_HEIGHT = 48;
  const MIN_PX        = SLOT_HEIGHT / settings.slotDuration;
  const timelineHeight = totalMin * MIN_PX;

  function slotTop(timeStr)    { return (toMinutes(timeStr) - openMin) * MIN_PX; }
  function durationPx(minutes) { return minutes * MIN_PX; }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMin - openMin) * MIN_PX;
  const showNowLine = nowMin >= openMin && nowMin <= closeMin &&
    selectedDate === new Date().toISOString().split("T")[0];

  const lunchTop    = slotTop(settings.lunchStart);
  const lunchHeight = durationPx(toMinutes(settings.lunchEnd) - toMinutes(settings.lunchStart));

  const columns = viewMode === "chair"
    ? chairs.map(c => ({ id: c.id, label: c.name, type: "chair" }))
    : allStaff.map(s => ({ id: s.id, label: s.name, type: "doctor" }));

  function getApptsForColumn(col) {
    if (col.type === "chair") return appointments.filter(a => a.chair_id === col.id);
    return appointments.filter(a => a.staff_id === col.id);
  }

  function pixelToTime(e, containerEl) {
    const rect = containerEl.getBoundingClientRect();
    const y    = e.clientY - rect.top;
    const rawMin = openMin + (y / MIN_PX);
    const snapped = Math.round(rawMin / 5) * 5;
    return toTimeStr(Math.max(openMin, Math.min(snapped, closeMin - 5)));
  }

  function handleDragStart(e, appt) {
    setDragging({ appointment: appt });
    e.dataTransfer.effectAllowed = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetMin = (e.clientY - rect.top) / MIN_PX;
    e.dataTransfer.setData("offsetMin", String(Math.round(offsetMin)));
  }

  function handleColDragOver(e, colId, containerEl) {
    e.preventDefault();
    const time = pixelToTime(e, containerEl);
    setDragOver({ slot: time, colId });
  }

  function handleColDrop(e, colId, containerEl) {
    e.preventDefault();
    if (!dragging) return;
    const appt = dragging.appointment;
    const time = pixelToTime(e, containerEl);
    const durationMin = toMinutes(appt.end_time) - toMinutes(appt.start_time);
    const newEndTime  = toTimeStr(toMinutes(time) + durationMin);
    const body = { appointment_date: selectedDate, start_time: time, end_time: newEndTime };
    if (viewMode === "chair") body.chair_id = colId;
    else body.staff_id = colId;
    moveAppointment(appt.id, body);
    setDragging(null); setDragOver(null);
  }

  function handleDragEnd() { setDragging(null); setDragOver(null); }

  async function moveAppointment(id, body) {
    try {
      await axios.put("/api/appointments/" + id, body);
      fetchCalendar();
    } catch (err) { alert(err.response?.data?.error || "移動に失敗しました"); }
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm px-4 py-3" style={{ marginLeft: 224 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-800">📅 診療カレンダー</h1>
          <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {[["month","月"], ["week","週"], ["week5","5日"], ["day","日"]].map(([v, label]) => (
              <button key={v} onClick={() => setViewType(v)} className={"px-3 py-2 text-sm font-medium transition-colors " + (viewType === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
                {label}表示
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2">
            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toISOString().split("T")[0]); }} className="text-gray-500 hover:text-blue-600">◀</button>
            <div className="flex items-center gap-1.5">
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="text-sm font-semibold text-gray-700 outline-none cursor-pointer" />
              <span className={"text-sm font-bold px-1.5 py-0.5 rounded-md " + (new Date(selectedDate).getDay() === 0 ? "text-red-600 bg-red-50" : new Date(selectedDate).getDay() === 6 ? "text-blue-600 bg-blue-50" : "text-gray-600 bg-gray-50")}>
                （{"日月火水木金土"[new Date(selectedDate).getDay()]}）
              </span>
            </div>
            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d.toISOString().split("T")[0]); }} className="text-gray-500 hover:text-blue-600">▶</button>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {[["chair","🦷 チェア"], ["doctor","👨‍⚕️ ドクター"]].map(([v, label]) => (
              <button key={v} onClick={() => setViewMode(v)} className={"px-3 py-2 text-sm font-medium transition-colors " + (viewMode === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
                {label}
              </button>
            ))}
          </div>

          <button onClick={fetchCalendar} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 shadow-sm">
            🔄 更新
          </button>
          <button onClick={handleManualClick} className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-sm text-blue-600 hover:bg-blue-100 shadow-sm font-medium">
            📖 マニュアル
          </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2 items-center">
          {Object.entries(TREATMENT_COLORS).map(([name, color]) => (
            <span key={name} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: color.light, color: color.text, border: "1px solid " + color.border }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color.bg }} />{name} </span>
          ))}
          <span style={{ fontSize:11, color:"var(--color-text-secondary)", marginLeft:8 }}>
            ｜ 列色=曜日識別　バー: 🟢空き 🔵普通 🔴混雑
          </span>
        </div>
      </div>

      <div className="px-4 py-3" style={{ paddingTop: 120 }}>
      {loading && <div className="text-center py-4 text-gray-400 text-sm animate-pulse">読み込み中...</div>} {viewMode === "doctor" && allStaff.length === 0 && ( <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
          本日の予約はありません
        </div>
      )}
      {(viewMode === "chair" || columns.length >= 1) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100" style={{ overflowX: "auto", overflowY: "visible" }}>
          <div style={{ display: "flex", minWidth: (64 + columns.length * 160) + "px" }}>
            <div style={{ width: 64, flexShrink: 0, background: "#f9fafb", borderRight: "1px solid #f3f4f6" }}>
              <div style={{ height: HEADER_HEIGHT, position: "sticky", top: 110, zIndex: 20, background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }} />
              <div className="relative" style={{ height: timelineHeight }}>
                {slots.map(slot => (
                  <div key={slot} className="absolute left-0 right-0 flex items-start justify-end pr-2" style={{ top: slotTop(slot), height: SLOT_HEIGHT }}>
                    <span className="text-xs text-gray-400 font-mono leading-none pt-1">{slot}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, display: "flex" }}>
              {columns.map((col, colIdx) => (
                <div key={col.id} style={{ flex: "1 1 160px", minWidth: 160, borderRight: colIdx !== columns.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <div style={{ height: HEADER_HEIGHT, position: "sticky", top: 110, zIndex: 20, background: "#fff", borderBottom: "2px solid #e5e7eb", boxShadow: "0 2px 4px rgba(0,0,0,0.06)" }} className="flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-700">
                        {viewMode === "chair" ? "🦷" : "👨‍⚕️ "}{col.label}
                      </span>
                    </div>

                    <div className="relative" style={{ height: timelineHeight }} onDragOver={e => handleColDragOver(e, col.id, e.currentTarget)} onDrop={e => handleColDrop(e, col.id, e.currentTarget)}>
                      <div className="absolute left-0 right-0 bg-yellow-50 border-y border-yellow-100 z-10" style={{ top: lunchTop, height: lunchHeight }}>
                        <span className="text-xs text-yellow-500 font-medium pl-2 pt-1 block">🍱 昼休み</span>
                      </div>
                      {showNowLine && colIdx === 0 && (
                        <div className="pointer-events-none z-30" style={{ position: "absolute", top: nowTop, left: -64, width: (columns.length * 161 + 64) + "px" }}>
                          <div style={{ position: "relative" }}>
                            <div style={{ position: "absolute", left: 56, right: 0, height: 2, background: "#ef4444", boxShadow: "0 1px 3px rgba(239,68,68,0.4)" }} />
                            <div style={{ position: "absolute", left: 48, top: -6, width: 12, height: 12, borderRadius: "50%", background: "#ef4444", boxShadow: "0 1px 4px rgba(239,68,68,0.5)" }} />
                            <span style={{ position: "absolute", left: 60, top: -12, fontSize: 11, color: "#ef4444", fontWeight: 700, background: "#fff", padding: "0 4px", borderRadius: 4 }}>
                              {now.getHours().toString().padStart(2,"0")}:{now.getMinutes().toString().padStart(2,"0")}
                            </span>
                          </div>
                        </div>
                      )}
                      {getApptsForColumn(col).map(appt => {
                        const top    = (toMinutes(appt.start_time) - openMin) * MIN_PX;
                        const height = (toMinutes(appt.end_time) - toMinutes(appt.start_time)) * MIN_PX;
                        const color  = getTreatmentColor(appt.treatment_type);
                        return (
                          <div
                            key={appt.id}
                            draggable
                            onDragStart={e => { handleDragStart(e, appt); setTooltip({ visible: false, appt: null, x:0, y:0 }); }}
                            onDragEnd={handleDragEnd}
                            onClick={e => { if (!dragging) setDetailModal(appt); }}
                            onMouseEnter={e => setTooltip({ visible: true, appt, x: e.clientX, y: e.clientY })}
                            onMouseMove={e => setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }))}
                            onMouseLeave={() => setTooltip({ visible: false, appt: null, x:0, y:0 })}
                            className={dragging && dragging.appointment && dragging.appointment.id === appt.id ? "absolute left-1 right-1 rounded-lg cursor-grab shadow-sm transition-all select-none z-20 opacity-40 scale-95" : "absolute left-1 right-1 rounded-lg cursor-grab shadow-sm transition-all select-none z-20"}
                            style={{ top: top+2, height: height-4, background: color.light, borderLeft: "4px solid " + color.bg, borderColor: color.border, borderWidth: 1, borderLeftWidth: 4 }}>
                            <div className="p-1.5 h-full flex flex-col overflow-hidden">
                              <div className="font-bold text-xs leading-tight" style={{ color: color.text }}>
                                {appt.name_kana || appt.patient_name}
                              </div>
                              <div className="text-xs opacity-75 leading-tight" style={{ color: color.text }}>
                                {appt.patient_name}
                              </div>
                              <div className="text-xs font-medium mt-0.5 leading-tight" style={{ color: color.bg }}>
                                {appt.treatment_type}
                              </div>
                              <div className="text-xs opacity-60 leading-tight" style={{ color: color.text }}>
                                {appt.start_time?.substring(0,5)}〜{appt.end_time?.substring(0,5)}
                              </div>
                              {appt.notes && (
                                <div className="text-xs mt-0.5 italic opacity-80 truncate" style={{ color: color.text }}>
                                  📋 {appt.notes}
                                </div>
                              )}
                              {appt.doctor_name && (
                                <div className="text-xs opacity-60 mt-auto leading-tight" style={{ color: color.text }}>
                                  Dr. {appt.doctor_name}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {dragOver?.colId === col.id && (
                        <div className="absolute left-0 right-0 pointer-events-none z-30" style={{ top: slotTop(dragOver.slot), height: 2, background: "#3b82f6" }}>
                          <div style={{ position: "absolute", left: 0, top: -4, width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
                          <span style={{ position: "absolute", left: 12, top: -10, fontSize: 10, color: "#3b82f6", fontWeight: 700, background: "#fff", padding: "0 2px", borderRadius: 3 }}>
                            {dragOver.slot}
                          </span>
                        </div>
                      )}
                      {slots.map(slot => {
                        const slotMin = toMinutes(slot);
                        const slotEndMin = slotMin + settings.slotDuration;
                        const lS = toMinutes(settings.lunchStart);
                        const lE = toMinutes(settings.lunchEnd);
                        const isLunch = (slotMin >= lS) && !(slotMin >= lE);
                        if (isLunch) return null;
                        const hasAppt = getApptsForColumn(col).some(a => {
                          const aStart = toMinutes(a.start_time);
                          const aEnd = toMinutes(a.end_time);
                          return !(aEnd <= slotMin || aStart >= slotEndMin);
                        });
                        if (hasAppt) return null;
                        const isDragTarget = dragOver?.slot === slot && dragOver?.colId === col.id;
                        const inRange = (slotMin >= clinicOpenMin) && !(slotMin >= clinicCloseMin);
                        const isOutOfHours = isClosedDay || !inRange;
                        let slotCls = "absolute left-0 right-0 border-b cursor-pointer transition-colors group ";
                        if (isOutOfHours) { slotCls += "bg-gray-100 border-gray-100"; }
                        else if (isDragTarget) { slotCls += "bg-blue-50 border-blue-200"; }
                        else { slotCls += "border-gray-50"; }
                        const handleSlotClick = () => {
                          const fallbackChair = chairs[0] ? chairs[0].id : null;
                          const isChairMode = col.type === "chair";
                          setNewApptModal({ slot, chairId: isChairMode ? col.id : fallbackChair, isOutOfHours });
                        };
                        const spanCls = isOutOfHours ? "text-xs text-orange-400" : "text-xs text-blue-400";
                        const spanTxt = isOutOfHours ? "+ 時間外予約" : "+ 予約追加";
                        return (
                          <div key={slot} className={slotCls} style={{ top: slotTop(slot), height: SLOT_HEIGHT }} onDragOver={e => { e.preventDefault(); }} onClick={handleSlotClick}>
                            {isOutOfHours && colIdx === 0 && (
                              <div className="absolute left-1 top-0.5 text-xs text-gray-300 font-medium select-none" style={{ fontSize: 9 }}>時間外</div>