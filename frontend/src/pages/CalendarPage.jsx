// src/pages/CalendarPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from '../api';

const TREATMENT_COLORS = {
  '定期検診':           { bg: '#4A90D9', light: '#EBF4FF', text: '#1a5fa8', border: '#2171c7' },
  'クリーニング(PMTC)': { bg: '#27AE60', light: '#EDFAF1', text: '#1e8449', border: '#1e8449' },
  '虫歯治療':           { bg: '#E8534A', light: '#FFF0EF', text: '#c0392b', border: '#c0392b' },
  '抜歯':               { bg: '#8E44AD', light: '#F5EEF8', text: '#6c3483', border: '#6c3483' },
  'クラウン・補綴':     { bg: '#D35400', light: '#FEF5EC', text: '#b7440b', border: '#b7440b' },
  'ホワイトニング':     { bg: '#2980B9', light: '#EBF5FB', text: '#1f618d', border: '#1f618d' },
  'インプラント相談':   { bg: '#16A085', light: '#E8F8F5', text: '#0e6655', border: '#0e6655' },
  '歯周病治療':         { bg: '#F39C12', light: '#FEF9E7', text: '#d68910', border: '#d68910' },
  'その他':             { bg: '#95A5A6', light: '#F4F6F6', text: '#717d7e', border: '#717d7e' },
};
const DEFAULT_COLOR = { bg: '#4A90D9', light: '#EBF4FF', text: '#1a5fa8', border: '#2171c7' };

function getTreatmentColor(treatmentType) {
  return TREATMENT_COLORS[treatmentType] || DEFAULT_COLOR;
}
function toMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.toString().substring(0, 5).split(':').map(Number);
  return h * 60 + m;
}
function toTimeStr(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

// =============================================
// メインコンポーネント
// =============================================
export default function CalendarPage() {
  const [searchParams] = useSearchParams();  // 先に定義
  const [viewType, setViewType]           = useState(() => {
    const v = searchParams.get('view')
    return (v === 'month' || v === 'week' || v === 'week5') ? v : 'day'
  });  // 'month' | 'week' | 'week5' | 'day'
  const [viewMode, setViewMode]           = useState('chair'); // 'chair' | 'doctor'
  const [selectedDate, setSelectedDate]   = useState(
    searchParams.get('date') || new Date().toISOString().split('T')[0]
  );
  const [currentMonth, setCurrentMonth]   = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [calendarData, setCalendarData]   = useState(null);
  const [monthData, setMonthData]         = useState({});
  const [weekData, setWeekData]           = useState({});  // { 'YYYY-MM-DD': calendarData }
  const [loading, setLoading]             = useState(false);
  const [dragging, setDragging]           = useState(null);
  const [dragOver, setDragOver]           = useState(null);
  const [newApptModal, setNewApptModal]   = useState(null);
  const [detailModal, setDetailModal]     = useState(null);
  const [allStaff, setAllStaff]           = useState([]);
  const [now, setNow]                     = useState(new Date());
  const timelineRef                       = useRef(null);  // D&D用

  // 週の開始日（月曜）を計算
  function getWeekStart(dateStr) {
    const d = new Date(dateStr);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow; // 月曜始まり
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }
  function getWeekDates(dateStr) {
    const start = getWeekStart(dateStr);
    return Array.from({length: 7}, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 日別データ取得
  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/appointments/calendar/${selectedDate}`);
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

  // 月別データ取得
  const fetchMonth = useCallback(async () => {
    try {
      const [year, month] = currentMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const promises = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        promises.push(
          axios.get(`/api/appointments/calendar/${dateStr}`)
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

  useEffect(() => { if (viewType === 'month') fetchMonth(); }, [viewType, fetchMonth]);

  // 週別データ取得
  const fetchWeek = useCallback(async () => {
    setLoading(true);
    try {
      const dates = getWeekDates(selectedDate);
      const results = await Promise.all(
        dates.map(d =>
          axios.get(`/api/appointments/calendar/${d}`)
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

  useEffect(() => { if (viewType === 'week' || viewType === 'week5') fetchWeek(); }, [viewType, fetchWeek]);

  // ── 月カレンダービュー ──────────────────────────
  if (viewType === 'month') {
    return (
      <MonthView
        currentMonth={currentMonth}
        monthData={monthData}
        onPrevMonth={() => {
          const [y, m] = currentMonth.split('-').map(Number);
          const d = new Date(y, m-2, 1);
          setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
        }}
        onNextMonth={() => {
          const [y, m] = currentMonth.split('-').map(Number);
          const d = new Date(y, m, 1);
          setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
        }}
        onSelectDate={date => { setSelectedDate(date); setViewType('day'); }}
        onSwitchToDay={(v) => setViewType(v || 'day')}
      />
    );
  }

  // ── 週表示ビュー ──────────────────────────────────
  if (viewType === 'week' || viewType === 'week5') {
    return (
      <WeekView
        selectedDate={selectedDate}
        weekData={weekData}
        viewMode={viewMode}
        allStaff={allStaff}
        loading={loading}
        now={now}
        weekOnly={viewType === 'week5'}
        onSelectDate={date => { setSelectedDate(date); setViewType('day'); }}
        onPrevWeek={() => {
          const d = new Date(selectedDate); d.setDate(d.getDate() - 7);
          setSelectedDate(d.toISOString().split('T')[0]);
        }}
        onNextWeek={() => {
          const d = new Date(selectedDate); d.setDate(d.getDate() + 7);
          setSelectedDate(d.toISOString().split('T')[0]);
        }}
        onSwitchView={v => setViewType(v)}
        onViewModeChange={m => setViewMode(m)}
        onRefresh={fetchWeek}
      />
    );
  }

  // ── 日別ビュー ──────────────────────────────────
  if (!calendarData) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  const { settings, chairs, slots: clinicSlots, appointments, blocks } = calendarData;

  // 表示時間（診療時間外含む）※ 先に定義
  const displayStart   = settings.displayStart || settings.openTime;
  const displayEnd     = settings.displayEnd   || settings.closeTime;
  const openMin        = toMinutes(displayStart);
  const closeMin       = toMinutes(displayEnd);

  // 曜日別カスタム時間を考慮した診療時間（グレーアウト判定用）
  const dow = new Date(selectedDate).getDay();
  const customHour = settings.customHours?.[dow];
  let clinicOpenMin, clinicCloseMin;
  if (customHour) {
    try {
      const parsed = typeof customHour === 'string' ? JSON.parse(customHour) : customHour;
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

  // 休診日判定（open_daysに含まれない曜日 = 終日グレーアウト）
  const openDays   = settings.openDays || [1,2,3,4,5,6];
  const isClosedDay = !openDays.includes(dow);

  // 診療時間外のスロットも生成してslotsを拡張
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
    selectedDate === new Date().toISOString().split('T')[0];

  const lunchTop    = slotTop(settings.lunchStart);
  const lunchHeight = durationPx(toMinutes(settings.lunchEnd) - toMinutes(settings.lunchStart));

  // 表示列（ドクターモードは全スタッフ表示）
  const columns = viewMode === 'chair'
    ? chairs.map(c => ({ id: c.id, label: c.name, type: 'chair' }))
    : allStaff.map(s => ({ id: s.id, label: s.name, type: 'doctor' }));

  function getApptsForColumn(col) {
    if (col.type === 'chair') return appointments.filter(a => a.chair_id === col.id);
    return appointments.filter(a => a.staff_id === col.id);
  }

  // =============================================
  // 【1】D&D: ピクセル位置から5分単位で時刻計算
  // =============================================
  function pixelToTime(e, containerEl) {
    const rect = containerEl.getBoundingClientRect();
    const y    = e.clientY - rect.top;
    const rawMin = openMin + (y / MIN_PX);
    // 5分単位にスナップ
    const snapped = Math.round(rawMin / 5) * 5;
    return toTimeStr(Math.max(openMin, Math.min(snapped, closeMin - 5)));
  }

  function handleDragStart(e, appt) {
    setDragging({ appointment: appt });
    e.dataTransfer.effectAllowed = 'move';
    // ドラッグ開始位置のオフセットを記録（予約ブロック内のどこを掴んだか）
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetMin = (e.clientY - rect.top) / MIN_PX;
    e.dataTransfer.setData('offsetMin', String(Math.round(offsetMin)));
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
    if (viewMode === 'chair') body.chair_id = colId;
    else body.staff_id = colId;
    moveAppointment(appt.id, body);
    setDragging(null); setDragOver(null);
  }

  function handleDragEnd() { setDragging(null); setDragOver(null); }

  async function moveAppointment(id, body) {
    try {
      await axios.put(`/api/appointments/${id}`, body);
      fetchCalendar();
    } catch (err) { alert(err.response?.data?.error || '移動に失敗しました'); }
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ヘッダー固定【3】 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm px-4 py-3" style={{ marginLeft: 224 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-800">📅 診療カレンダー</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 月/週/5日/日切替 */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {[['month','月'], ['week','週'], ['week5','5日'], ['day','日']].map(([v, label]) => (
              <button key={v} onClick={() => setViewType(v)}
                className={`px-3 py-2 text-sm font-medium transition-colors
                  ${viewType === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {label}表示
              </button>
            ))}
          </div>

          {/* 日付ナビ */}
          <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2">
            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toISOString().split('T')[0]); }}
              className="text-gray-500 hover:text-blue-600">◀</button>
            <div className="flex items-center gap-1.5">
              <input type="date" value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="text-sm font-semibold text-gray-700 outline-none cursor-pointer" />
              <span className={`text-sm font-bold px-1.5 py-0.5 rounded-md
                ${new Date(selectedDate).getDay() === 0 ? 'text-red-600 bg-red-50' :
                  new Date(selectedDate).getDay() === 6 ? 'text-blue-600 bg-blue-50' :
                  'text-gray-600 bg-gray-50'}`}>
                （{'日月火水木金土'[new Date(selectedDate).getDay()]}）
              </span>
            </div>
            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d.toISOString().split('T')[0]); }}
              className="text-gray-500 hover:text-blue-600">▶</button>
          </div>

          {/* チェア/ドクター切替【3】 */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {[['chair','🦷 チェア'], ['doctor','👨‍⚕️ ドクター']].map(([v, label]) => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-2 text-sm font-medium transition-colors
                  ${viewMode === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>

          <button onClick={fetchCalendar}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 shadow-sm">
            🔄 更新
          </button>
          </div>
        </div>
        {/* 治療凡例 */}
        <div className="flex flex-wrap gap-1.5 mt-2 items-center">
          {Object.entries(TREATMENT_COLORS).map(([name, color]) => (
            <span key={name} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: color.light, color: color.text, border: `1px solid ${color.border}` }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color.bg }} />{name}
            </span>
          ))}
          <span style={{ fontSize:11, color:'var(--color-text-secondary)', marginLeft:8 }}>
            ｜ 列色=曜日識別　バー: 🟢空き 🔵普通 🔴混雑
          </span>
        </div>
      </div>{/* /fixed header */}

      {/* スクロール領域（ヘッダー高さ分パディング） */}
      <div className="px-4 py-3" style={{ paddingTop: 120 }}>
      {loading && <div className="text-center py-4 text-gray-400 text-sm animate-pulse">読み込み中...</div>}

      {/* ドクターモードで予約なし */}
      {viewMode === "doctor" && allStaff.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
          本日の予約はありません
        </div>
      )}

      {/* タイムライン */}
      {(viewMode === 'chair' || columns.length > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex" style={{ minWidth: '700px' }}>
            {/* 時刻軸 */}
            <div className="w-16 flex-shrink-0 bg-gray-50 border-r border-gray-100">
              <div style={{ height: HEADER_HEIGHT }} className="border-b border-gray-100" />
              <div className="relative" style={{ height: timelineHeight }}>
                {slots.map(slot => (
                  <div key={slot} className="absolute left-0 right-0 flex items-start justify-end pr-2"
                    style={{ top: slotTop(slot), height: SLOT_HEIGHT }}>
                    <span className="text-xs text-gray-400 font-mono leading-none pt-1">{slot}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 列 */}
            <div className="flex-1 overflow-x-auto">
              <div className="flex">
                {columns.map((col, colIdx) => (
                  <div key={col.id} className="flex-1 min-w-[160px] border-r border-gray-100 last:border-r-0">
                    <div style={{ height: HEADER_HEIGHT }}
                      className="flex items-center justify-center border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
                      <span className="text-sm font-bold text-gray-700">
                        {viewMode === 'chair' ? '🦷' : '👨‍⚕️'} {col.label}
                      </span>
                    </div>

                    <div className="relative" style={{ height: timelineHeight }}
                      onDragOver={e => {
                        e.preventDefault();
                        const time = pixelToTime(e, e.currentTarget);
                        setDragOver({ slot: time, colId: col.id });
                      }}
                      onDrop={e => {
                        e.preventDefault();
                        if (!dragging) return;
                        const appt = dragging.appointment;
                        const time = pixelToTime(e, e.currentTarget);
                        const durationMin = toMinutes(appt.end_time) - toMinutes(appt.start_time);
                        const newEndTime  = toTimeStr(toMinutes(time) + durationMin);
                        const body = { appointment_date: selectedDate, start_time: time, end_time: newEndTime };
                        if (viewMode === 'chair') body.chair_id = col.id;
                        else body.staff_id = col.id;
                        moveAppointment(appt.id, body);
                        setDragging(null); setDragOver(null);
                      }}>
                      {/* 昼休み */}
                      <div className="absolute left-0 right-0 bg-yellow-50 border-y border-yellow-100 z-10"
                        style={{ top: lunchTop, height: lunchHeight }}>
                        <span className="text-xs text-yellow-500 font-medium pl-2 pt-1 block">🍱 昼休み</span>
                      </div>

                      {/* 現在時刻ライン */}
                      {showNowLine && colIdx === 0 && (
                        <div className="pointer-events-none z-30"
                          style={{ position: 'absolute', top: nowTop, left: -64,
                            width: `calc(${columns.length} * (100% + 1px) + 64px)` }}>
                          <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 56, right: 0, height: 2, background: '#ef4444', boxShadow: '0 1px 3px rgba(239,68,68,0.4)' }} />
                            <div style={{ position: 'absolute', left: 48, top: -6, width: 12, height: 12, borderRadius: '50%', background: '#ef4444', boxShadow: '0 1px 4px rgba(239,68,68,0.5)' }} />
                            <span style={{ position: 'absolute', left: 60, top: -12, fontSize: 11, color: '#ef4444', fontWeight: 700, background: '#fff', padding: '0 4px', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                              {now.getHours().toString().padStart(2,'0')}:{now.getMinutes().toString().padStart(2,'0')}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 予約ブロック */}
                      {getApptsForColumn(col).map(appt => {
                        const top    = (toMinutes(appt.start_time) - openMin) * MIN_PX;
                        const height = (toMinutes(appt.end_time) - toMinutes(appt.start_time)) * MIN_PX;
                        const color  = getTreatmentColor(appt.treatment_type);
                        return (
                          <div key={appt.id}
                            draggable
                            onDragStart={e => { handleDragStart(e, appt); }}
                            onDragEnd={handleDragEnd}
                            onClick={e => { if (!dragging) setDetailModal(appt); }}
                            className={`absolute left-1 right-1 rounded-lg cursor-grab active:cursor-grabbing
                              shadow-sm transition-all select-none z-20
                              ${dragging?.appointment?.id === appt.id ? 'opacity-40 scale-95' : 'hover:shadow-md hover:-translate-y-0.5'}`}
                            style={{ top: top+2, height: height-4,
                              background: color.light, borderLeft: `4px solid ${color.bg}`,
                              border: `1px solid ${color.border}`, borderLeftWidth: 4 }}>
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

                      {/* D&Dプレビューライン（5分単位） */}
                      {dragOver?.colId === col.id && (
                        <div className="absolute left-0 right-0 pointer-events-none z-30"
                          style={{ top: slotTop(dragOver.slot), height: 2, background: '#3b82f6' }}>
                          <div style={{ position: 'absolute', left: 0, top: -4, width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                          <span style={{ position: 'absolute', left: 12, top: -10, fontSize: 10, color: '#3b82f6', fontWeight: 700, background: '#fff', padding: '0 2px', borderRadius: 3 }}>
                            {dragOver.slot}
                          </span>
                        </div>
                      )}

                      {/* 空きスロット（時間外グレーアウト対応）*/}
                      {slots.map(slot => {
                        const slotMin    = toMinutes(slot);
                        const slotEndMin = slotMin + settings.slotDuration;
                        const isLunch    = slotMin >= toMinutes(settings.lunchStart) && slotMin < toMinutes(settings.lunchEnd);
                        if (isLunch) return null;
                        const hasAppt = getApptsForColumn(col).some(a =>
                          toMinutes(a.start_time) < slotEndMin && toMinutes(a.end_time) > slotMin
                        );
                        if (hasAppt) return null;
                        const isDragTarget  = dragOver?.slot === slot && dragOver?.colId === col.id;
                        // 診療時間外判定（休診日 or 時間外）
                        const isOutOfHours = isClosedDay || slotMin < clinicOpenMin || slotMin >= clinicCloseMin;
                        return (
                          <div key={slot}
                            className={`absolute left-0 right-0 border-b cursor-pointer transition-colors group
                              ${isOutOfHours
                                ? 'bg-gray-50/80 border-gray-100 hover:bg-orange-50/50'
                                : isDragTarget
                                  ? 'bg-blue-50 border-blue-200'
                                  : 'border-gray-50 hover:bg-blue-50/50'}`}
                            style={{ top: slotTop(slot), height: SLOT_HEIGHT }}
                            onDragOver={e => e.preventDefault()}
                            onClick={() => setNewApptModal({
                              slot, chairId: col.type === 'chair' ? col.id : chairs[0]?.id,
                              isOutOfHours
                            })}>
                            {/* 時間外ラベル */}
                            {isOutOfHours && colIdx === 0 && (
                              <div className="absolute left-1 top-0.5 text-xs text-gray-300 font-medium select-none"
                                style={{ fontSize: 9 }}>時間外</div>
                            )}
                            {isDragTarget && (
                              <div className="absolute inset-1 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center">
                                <span className="text-xs text-blue-500 font-medium">ここに移動</span>
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className={`text-xs ${isOutOfHours ? 'text-orange-400' : 'text-blue-400'}`}>
                                {isOutOfHours ? '＋ 時間外予約' : '＋ 予約追加'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {newApptModal && (
        <NewAppointmentModal
          slot={newApptModal.slot}
          chairId={newApptModal.chairId}
          chairs={chairs}
          date={selectedDate}
          settings={settings}
          onClose={() => setNewApptModal(null)}
          onSave={() => { setNewApptModal(null); fetchCalendar(); }}
        />
      )}
      {detailModal && (
        <AppointmentDetailModal
          appt={detailModal}
          onClose={() => setDetailModal(null)}
          onUpdate={() => { setDetailModal(null); fetchCalendar(); }}
        />
      )}
      </div>{/* /content */}
    </div>
  );
}

// =============================================
// 週表示カレンダー（案B）
// =============================================
function WeekView({ selectedDate, weekData, viewMode, allStaff, loading, now,
  weekOnly,  // trueなら平日(月〜金)のみ表示
  onSelectDate, onPrevWeek, onNextWeek, onSwitchView, onViewModeChange, onRefresh }) {

  const [dragging, setDragging]       = useState(null);
  const [dragOver, setDragOver]       = useState(null);
  const [newApptModal, setNewApptModal] = useState(null);
  const [detailModal, setDetailModal]   = useState(null);

  // 週の日付リスト（月〜日）
  function getWeekStart(ds) {
    const d = new Date(ds); const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    return d.toISOString().split('T')[0];
  }
  const weekStart = getWeekStart(selectedDate);
  const allWeekDates = Array.from({length: 7}, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });
  // 5日表示なら土日を除外
  const weekDates = weekOnly
    ? allWeekDates.filter(ds => { const dow = new Date(ds).getDay(); return dow >= 1 && dow <= 5; })
    : allWeekDates;

  // 設定は最初の有効な日から取得
  const firstData  = Object.values(weekData).find(d => d?.settings);
  const settings   = firstData?.settings;
  const chairs     = firstData?.chairs || [];
  const today      = new Date().toISOString().split('T')[0];

  if (!settings) return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    </div>
  );

  const openDays   = settings.openDays || [1,2,3,4,5,6];
  const displayStart = settings.displayStart || settings.openTime;
  const displayEnd   = settings.displayEnd   || settings.closeTime;
  const openMin    = toMinutes(displayStart);
  const closeMin   = toMinutes(displayEnd);
  const totalMin   = closeMin - openMin;

  const SLOT_H     = 48;
  const MIN_PX     = SLOT_H / settings.slotDuration;
  const HEADER_H   = 72;
  const COL_W      = weekOnly ? 160 : 120;  // 5日表示は列幅を広く
  const TIME_W     = 48;
  const timelineH  = totalMin * MIN_PX;

  // チェア別カラー（最大8チェア対応）
  const CHAIR_COLORS = [
    { bg: '#3b82f6', light: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' }, // blue
    { bg: '#10b981', light: '#f0fdf4', border: '#a7f3d0', text: '#065f46' }, // green
    { bg: '#f59e0b', light: '#fffbeb', border: '#fde68a', text: '#92400e' }, // amber
    { bg: '#8b5cf6', light: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' }, // violet
    { bg: '#ef4444', light: '#fef2f2', border: '#fecaca', text: '#991b1b' }, // red
    { bg: '#06b6d4', light: '#ecfeff', border: '#a5f3fc', text: '#155e75' }, // cyan
    { bg: '#ec4899', light: '#fdf2f8', border: '#fbcfe8', text: '#9d174d' }, // pink
    { bg: '#84cc16', light: '#f7fee7', border: '#d9f99d', text: '#3f6212' }, // lime
  ];

  // 週全体の最大予約数（稼働率バーの基準）
  const weekMaxAppts = Math.max(
    ...weekDates.map(ds => (weekData[ds]?.appointments?.length || 0)), 1
  );

  function slotTop(t) { return (toMinutes(t) - openMin) * MIN_PX; }
  function durPx(m)   { return m * MIN_PX; }

  // スロット生成（全日共通）
  function genSlots(oMin, cMin, dur) {
    const s = []; let c = oMin;
    while (c + dur <= cMin) { s.push(toTimeStr(c)); c += dur; }
    return s;
  }
  const allSlots = genSlots(openMin, closeMin, settings.slotDuration);

  // 診療時間（曜日別カスタム考慮）
  function getClinicHours(dateStr) {
    const dow = new Date(dateStr).getDay();
    const ch  = settings.customHours?.[dow];
    if (ch) {
      try {
        const p = typeof ch === 'string' ? JSON.parse(ch) : ch;
        return { open: toMinutes(p.open || settings.openTime), close: toMinutes(p.close || settings.closeTime) };
      } catch {}
    }
    return { open: toMinutes(settings.openTime), close: toMinutes(settings.closeTime) };
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMin - openMin) * MIN_PX;
  const showNow = nowMin >= openMin && nowMin <= closeMin && weekDates.includes(today);
  const todayColIdx = weekDates.indexOf(today);

  // =============================================
  // 【1+2】週表示: ピクセルD&D + 日またぎ対応
  // =============================================
  function weekPixelToTime(e, containerEl) {
    const rect = containerEl.getBoundingClientRect();
    const y    = e.clientY - rect.top;
    const rawMin = openMin + (y / MIN_PX);
    const snapped = Math.round(rawMin / 5) * 5;
    return toTimeStr(Math.max(openMin, Math.min(snapped, closeMin - 5)));
  }

  function handleDragStart(e, appt, fromDate) {
    setDragging({ appt, fromDate });
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleDragEnd() { setDragging(null); setDragOver(null); }

  // 【2】同時刻の予約を重なり表示するレイアウト計算
  function calcOverlapLayout(appts) {
    if (!appts.length) return [];
    const sorted = [...appts].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));

    // 各予約に「列」を割り当てる（Googleカレンダー方式）
    const cols = []; // cols[i] = その列に最後に入れた予約のend_time(分)
    const colIdx = {}; // appt.id → 列インデックス

    sorted.forEach(appt => {
      const start = toMinutes(appt.start_time);
      const end   = toMinutes(appt.end_time);
      // 空いている列を探す
      let placed = false;
      for (let i = 0; i < cols.length; i++) {
        if (cols[i] <= start) { // この列は空いている
          cols[i] = end;
          colIdx[appt.id] = i;
          placed = true;
          break;
        }
      }
      if (!placed) { // 新しい列を追加
        colIdx[appt.id] = cols.length;
        cols.push(end);
      }
    });

    const totalCols = cols.length;

    // 各予約が重なるグループを検出してwidth調整
    // 単純に: 同じ時間帯に重なる予約の最大列数に合わせてwidthを決める
    return sorted.map(appt => {
      const col = colIdx[appt.id];
      const aStart = toMinutes(appt.start_time);
      const aEnd   = toMinutes(appt.end_time);
      // この予約と重なる全予約を取得
      const overlapping = sorted.filter(b =>
        toMinutes(b.start_time) < aEnd && toMinutes(b.end_time) > aStart
      );
      const maxCol = Math.max(...overlapping.map(b => colIdx[b.id])) + 1;
      return {
        appt,
        left:   (col / maxCol) * 100,
        width:  (1 / maxCol) * 100,
        zIndex: 20 + col,
      };
    });
  }

  // 週の範囲表示
  const wStart = new Date(weekDates[0]);
  const wEnd   = new Date(weekDates[weekDates.length - 1]);
  const rangeStr = weekOnly
    ? `${wStart.getMonth()+1}/${wStart.getDate()}(月) 〜 ${wEnd.getMonth()+1}/${wEnd.getDate()}(金)`
    : `${wStart.getMonth()+1}/${wStart.getDate()} 〜 ${wEnd.getMonth()+1}/${wEnd.getDate()}`;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 週ヘッダー fixed */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm" style={{ marginLeft: 224 }}>
        <div className="px-4 py-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-xl font-bold text-gray-800">📅 診療カレンダー</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                {[['month','月'], ['week','週'], ['week5','5日'], ['day','日']].map(([v, label]) => (
                  <button key={v} onClick={() => onSwitchView(v)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors
                      ${(v === 'week' && !weekOnly) || (v === 'week5' && weekOnly)
                        ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    {label}表示
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-1.5">
                <button onClick={onPrevWeek} className="text-gray-500 hover:text-blue-600 text-sm">◀</button>
                <span className="text-sm font-semibold text-gray-700 min-w-28 text-center">{rangeStr}</span>
                <button onClick={onNextWeek} className="text-gray-500 hover:text-blue-600 text-sm">▶</button>
              </div>
              {/* 週表示はチェア/ドクター切替不要のためコメントアウト */}
              <button onClick={onRefresh}
                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 shadow-sm">
                🔄 更新
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {Object.entries(TREATMENT_COLORS).map(([name, color]) => (
              <span key={name} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: color.light, color: color.text, border: `1px solid ${color.border}` }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color.bg }} />{name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* コンテンツ（ヘッダー分パディング） */}
      <div className="px-4" style={{ paddingTop: 110 }}>
      {loading && <div className="text-center py-4 text-gray-400 text-sm animate-pulse">読み込み中...</div>}

      {/* 週グリッド */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <div style={{ minWidth: TIME_W + COL_W * 7 }}>

          {/* 曜日ヘッダー（週サマリーバー + チェア別カラー） */}
          <div className="flex border-b border-gray-200" style={{ height: HEADER_H }}>
            {/* 時刻軸ヘッダー */}
            <div style={{ width: TIME_W, flexShrink: 0 }}
              className="bg-gray-50 border-r border-gray-100 flex flex-col items-center justify-end pb-1.5">
              <span className="text-gray-400" style={{ fontSize: 9 }}>時刻</span>
            </div>

            {weekDates.map((dateStr, colIdx) => {
              const d        = new Date(dateStr);
              const dow      = d.getDay();
              const isToday  = dateStr === today;
              // customHoursが設定されている場合はopenDaysになくても診療あり
              const hasCustomHours = !!(settings.customHours?.[dow]);
              const isClosed = !openDays.includes(dow) && !hasCustomHours;
              // 部分診療判定（openDaysにあるがcustomHoursで短縮されている）
              const isPartialDay = hasCustomHours && openDays.includes(dow);
              const dayAppts = weekData[dateStr]?.appointments || [];
              const DOW_LABEL = ['日','月','火','水','木','金','土'];
              const count    = dayAppts.length;
              const barPct   = Math.round((count / weekMaxAppts) * 100);
              // 混雑度カラー
              const barColor = isClosed ? '#e5e7eb'
                : barPct >= 80 ? '#ef4444'
                : barPct >= 50 ? '#3b82f6'
                : '#22c55e';
              // チェアカラー（列インデックスでなく日付ベースで固定）
              const chColor = isClosed ? { bg:'#9ca3af', light:'#f9fafb', border:'#e5e7eb', text:'#6b7280' }
                : CHAIR_COLORS[colIdx % CHAIR_COLORS.length];

              return (
                <div key={dateStr}
                  onClick={() => onSelectDate(dateStr)}
                  style={{
                    width: COL_W, flexShrink: 0,
                    borderLeft: `3px solid ${isClosed ? '#e5e7eb' : chColor.bg}`,
                    background: isToday ? chColor.light : isClosed ? '#f9fafb' : '#fff',
                    cursor: 'pointer',
                  }}
                  className="border-r border-gray-100 last:border-r-0 flex flex-col px-2 py-1.5 hover:brightness-95 transition-all">

                  {/* 上段: 曜日 + 日付 */}
                  <div className="flex items-center justify-between mb-1">
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: isClosed ? '#9ca3af'
                        : dow === 0 ? '#ef4444'
                        : dow === 6 ? '#3b82f6'
                        : chColor.bg
                    }}>
                      {DOW_LABEL[dow]}
                    </span>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      background: isToday ? chColor.bg : 'transparent',
                      color: isToday ? '#fff' : isClosed ? '#9ca3af' : '#374151',
                    }}>
                      {d.getDate()}
                    </span>
                  </div>

                  {/* 下段: サマリーバー + 件数 */}
                  {isClosed ? (
                    <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 2 }}>休診</div>
                  ) : isPartialDay ? (
                    <>
                      <div style={{ background: '#f3f4f6', borderRadius: 3, height: 5, overflow: 'hidden', marginBottom: 2 }}>
                        <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>
                          {count > 0 ? `${count}件` : '午前のみ'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ background: '#f3f4f6', borderRadius: 3, height: 5, overflow: 'hidden', marginBottom: 2 }}>
                        <div style={{
                          width: `${barPct}%`, height: '100%',
                          background: barColor, borderRadius: 3,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: barColor, fontWeight: 600 }}>
                          {count > 0 ? `${count}件` : '空き'}
                        </span>
                        {barPct >= 80 && (
                          <span style={{ fontSize: 9, background: '#fef2f2', color: '#dc2626', borderRadius: 3, padding: '0 3px', fontWeight: 600 }}>
                            混
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* タイムライン */}
          <div className="flex">
            {/* 時刻軸 */}
            <div className="bg-gray-50 border-r border-gray-100 relative flex-shrink-0"
              style={{ width: TIME_W, height: timelineH }}>
              {allSlots.map(slot => (
                <div key={slot} className="absolute right-1 text-right"
                  style={{ top: slotTop(slot), height: SLOT_H }}>
                  <span className="text-gray-400 font-mono" style={{ fontSize: 10 }}>{slot}</span>
                </div>
              ))}
            </div>

            {/* 各日列 */}
            {weekDates.map((dateStr, dayIdx) => {
              const dow         = new Date(dateStr).getDay();
              const hasCustomH  = !!(settings.customHours?.[dow]);
              const isClosed    = !openDays.includes(dow) && !hasCustomH;
              const dayData     = weekData[dateStr];
              const dayAppts    = dayData?.appointments || [];
              const clinicH     = getClinicHours(dateStr);
              const isToday     = dateStr === today;
              const lunchS      = slotTop(settings.lunchStart);
              const lunchH2     = durPx(toMinutes(settings.lunchEnd) - toMinutes(settings.lunchStart));
              const layout      = calcOverlapLayout(dayAppts);
              const chColor     = isClosed
                ? { bg:'#e5e7eb', light:'#f9fafb', border:'#e5e7eb', text:'#9ca3af' }
                : CHAIR_COLORS[dayIdx % CHAIR_COLORS.length];

              return (
                <div key={dateStr}
                  style={{
                    width: COL_W, flexShrink: 0, height: timelineH,
                    borderLeft: `2px solid ${chColor.border}`,
                    background: isToday ? chColor.light + '60' : 'transparent',
                  }}
                  className="relative border-r border-gray-100 last:border-r-0">

                  {/* 休診日オーバーレイ */}
                  {isClosed && (
                    <div className="absolute inset-0 bg-gray-100/70 z-10 flex items-center justify-center">
                      <span className="text-gray-400 text-xs font-medium" style={{ writingMode: 'vertical-rl' }}>休診日</span>
                    </div>
                  )}

                  {/* 時間外グレーアウト（上） */}
                  {!isClosed && clinicH.open > openMin && (
                    <div className="absolute left-0 right-0 bg-gray-50/80"
                      style={{ top: 0, height: (clinicH.open - openMin) * MIN_PX, zIndex: 1 }} />
                  )}
                  {/* 時間外グレーアウト（下） */}
                  {!isClosed && clinicH.close < closeMin && (
                    <div className="absolute left-0 right-0 bg-gray-50/80"
                      style={{ top: (clinicH.close - openMin) * MIN_PX, bottom: 0, zIndex: 1 }} />
                  )}

                  {/* 昼休み */}
                  <div className="absolute left-0 right-0 bg-yellow-50 border-y border-yellow-100 z-10"
                    style={{ top: lunchS, height: lunchH2 }}>
                    {dayIdx === 0 && <span className="text-yellow-400 pl-1" style={{ fontSize: 9 }}>昼休み</span>}
                  </div>

                  {/* 現在時刻ライン */}
                  {showNow && dayIdx === 0 && (
                    <div className="pointer-events-none z-30"
                      style={{ position: 'absolute', top: nowTop, left: 0, width: COL_W * 7, height: 2, background: '#ef4444' }}>
                      <div style={{ position: 'absolute', left: -4, top: -4, width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                    </div>
                  )}

                  {/* 【2】重なり対応予約ブロック */}
                  {layout.map(({ appt, left, width, zIndex }) => {
                    const top    = (toMinutes(appt.start_time) - openMin) * MIN_PX;
                    const height = (toMinutes(appt.end_time) - toMinutes(appt.start_time)) * MIN_PX;
                    const color  = getTreatmentColor(appt.treatment_type);
                    const isDrag = dragging?.appt?.id === appt.id;
                    return (
                      <div key={appt.id}
                        draggable
                        onDragStart={e => handleDragStart(e, appt, dateStr)}
                        onDragEnd={handleDragEnd}
                        onClick={() => { if (!dragging) setDetailModal({ appt, dateStr }); }}
                        className={`absolute rounded cursor-grab active:cursor-grabbing select-none overflow-hidden transition-all
                          ${isDrag ? 'opacity-40' : 'hover:shadow-lg'}`}
                        style={{
                          top: top + 1, height: Math.max(height - 2, 18),
                          left: `${left + 0.5}%`, width: `${width - 1}%`,
                          zIndex: isDrag ? 5 : zIndex,
                          background: color.light,
                          borderLeft: `3px solid ${color.bg}`,
                          border: `0.5px solid ${color.border}`,
                          borderLeftWidth: 3,
                        }}>
                        <div className="px-1 py-0.5 h-full flex flex-col overflow-hidden">
                          <div style={{ display:'flex', alignItems:'center', gap:2, marginBottom:1 }}>
                            <div className="font-bold leading-tight truncate" style={{ color: color.text, fontSize: 10, flex:1 }}>
                              {appt.name_kana || appt.patient_name}
                            </div>
                            {appt.chair_name && (
                              <span style={{
                                fontSize: 8, padding: '0 3px', borderRadius: 3, flexShrink: 0,
                                background: color.bg, color: '#fff', fontWeight: 700, lineHeight: '14px',
                              }}>{appt.chair_name.replace('チェア','C')}</span>
                            )}
                          </div>
                          {height > 30 && (
                            <div style={{ color: color.bg, fontSize: 9 }} className="leading-tight">{appt.treatment_type}</div>
                          )}
                          {height > 44 && (
                            <div style={{ color: color.text, fontSize: 9, opacity: 0.7 }}>{appt.start_time?.substring(0,5)}〜</div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* ドロップゾーン */}
                  {!isClosed && (
                    <div className="absolute inset-0" style={{ zIndex: 2 }}
                      onDragOver={e => {
                        e.preventDefault();
                        const time = weekPixelToTime(e, e.currentTarget);
                        setDragOver({ slot: time, dateStr });
                      }}
                      onDrop={async e => {
                        e.preventDefault();
                        if (!dragging) return;
                        const { appt } = dragging;
                        const time = weekPixelToTime(e, e.currentTarget);
                        const durMin = toMinutes(appt.end_time) - toMinutes(appt.start_time);
                        const newEnd = toTimeStr(toMinutes(time) + durMin);
                        setDragging(null); setDragOver(null);
                        try {
                          await axios.put(`/api/appointments/${appt.id}`, { appointment_date: dateStr, start_time: time, end_time: newEnd });
                          onRefresh();
                        } catch (err) { alert(err.response?.data?.error || '移動に失敗しました'); }
                      }}
                      onClick={e => {
                        if (dragging) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const rawMin = openMin + ((e.clientY - rect.top) / MIN_PX);
                        const snapped = Math.round(rawMin / settings.slotDuration) * settings.slotDuration;
                        const time = toTimeStr(Math.max(openMin, Math.min(snapped, closeMin - settings.slotDuration)));
                        const firstChair = weekData[dateStr]?.chairs?.[0];
                        setNewApptModal({ slot: time, chairId: firstChair?.id, date: dateStr });
                      }}
                    />
                  )}

                  {/* D&Dプレビューライン */}
                  {dragOver?.dateStr === dateStr && (
                    <div className="absolute left-0 right-0 pointer-events-none" style={{ top: slotTop(dragOver.slot), zIndex: 40 }}>
                      <div style={{ height: 2, background: '#3b82f6', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                        <span style={{ position: 'absolute', left: 8, top: -10, fontSize: 10, color: '#3b82f6', fontWeight: 700, background: 'white', padding: '0 2px', borderRadius: 3 }}>
                          {dragOver.slot}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* スロット罫線 */}
                  {allSlots.map(slot => {
                    const isHour = toMinutes(slot) % 60 === 0;
                    return (
                      <div key={slot} className="absolute left-0 right-0 pointer-events-none"
                        style={{ top: slotTop(slot), height: SLOT_H,
                          borderTop: isHour ? '0.5px solid #e5e7eb' : '0.5px solid #f3f4f6',
                          zIndex: 0 }} />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 新規予約モーダル */}
      {newApptModal && (
        <NewAppointmentModal
          slot={newApptModal.slot}
          chairId={newApptModal.chairId}
          chairs={weekData[newApptModal.date]?.chairs || []}
          date={newApptModal.date}
          settings={settings}
          onClose={() => setNewApptModal(null)}
          onSave={() => { setNewApptModal(null); onRefresh(); }}
        />
      )}

      {/* 詳細モーダル */}
      {detailModal && (
        <AppointmentDetailModal
          appt={detailModal.appt}
          onClose={() => setDetailModal(null)}
          onUpdate={() => { setDetailModal(null); onRefresh(); }}
        />
      )}
      </div>
    </div>
  );
}


// =============================================
// 【月カレンダー強化版】
// =============================================
function MonthView({ currentMonth, monthData, onPrevMonth, onNextMonth, onSelectDate, onSwitchToDay }) {
  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth   = new Date(year, month, 0).getDate();
  const firstDow      = new Date(year, month-1, 1).getDay();
  const today         = new Date().toISOString().split('T')[0];

  // 月合計統計
  const monthStats = Object.values(monthData).reduce((acc, data) => {
    if (!data) return acc;
    acc.total += data.appointments?.length || 0;
    return acc;
  }, { total: 0 });

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  }

  // チェア稼働率計算（その日の最大チェア数に対する割合）
  function getOccupancyRate(appts, maxChairs = 3) {
    if (!appts || appts.length === 0) return 0;
    // 簡易計算：予約数 / (営業スロット数 * チェア数) 
    return Math.min(100, Math.round((appts.length / (16 * maxChairs)) * 100));
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">📅 診療カレンダー</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <button className="px-3 py-2 text-sm font-medium bg-blue-600 text-white">月表示</button>
            <button onClick={() => onSwitchToDay('week')} className="px-3 py-2 text-sm font-medium bg-white text-gray-600 hover:bg-gray-50">週表示</button>
            <button onClick={() => onSwitchToDay('week5')} className="px-3 py-2 text-sm font-medium bg-white text-gray-600 hover:bg-gray-50">5日表示</button>
            <button onClick={() => onSwitchToDay('day')} className="px-3 py-2 text-sm font-medium bg-white text-gray-600 hover:bg-gray-50">日表示</button>
          </div>
        </div>
      </div>

      {/* 月間サマリー */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: '月間予約数', value: `${monthStats.total}件`, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '診療日数', value: `${Object.values(monthData).filter(d => d?.appointments?.length > 0).length}日`, color: 'text-green-600', bg: 'bg-green-50' },
          { label: '平均/日', value: `${Object.values(monthData).filter(d => d?.appointments?.length > 0).length > 0 ? Math.round(monthStats.total / Object.values(monthData).filter(d => d?.appointments?.length > 0).length) : 0}件`, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* 月ナビ */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button onClick={onPrevMonth} className="p-2 rounded-lg hover:bg-gray-50 text-gray-500">◀</button>
          <h2 className="text-lg font-bold text-gray-800">{year}年{month}月</h2>
          <button onClick={onNextMonth} className="p-2 rounded-lg hover:bg-gray-50 text-gray-500">▶</button>
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {['日','月','火','水','木','金','土'].map((d, i) => (
            <div key={d} className={`py-2 text-center text-xs font-bold
              ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7">
          {cells.map((dateStr, idx) => {
            if (!dateStr) return (
              <div key={`empty-${idx}`} className="h-28 border-b border-r border-gray-50 bg-gray-50/30" />
            );
            const data     = monthData[dateStr];
            const appts    = data?.appointments || [];
            const settings = data?.settings;
            const dow      = new Date(dateStr).getDay();
            const isToday  = dateStr === today;
            const isPast   = dateStr < today;
            const isHoliday = data && settings && !data.slots?.length;

            // 治療カラードット用（重複除去）
            const treatmentColors = [...new Set(appts.map(a => a.treatment_type))]
              .slice(0, 5)
              .map(t => getTreatmentColor(t).bg);

            // 稼働率バー
            const maxChairs = settings?.maxChairs || 3;
            const occupancy = getOccupancyRate(appts, maxChairs);

            return (
              <div key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className={`h-28 border-b border-r border-gray-100 p-1.5 cursor-pointer transition-all group
                  ${isToday ? 'bg-blue-50 border-blue-100' : ''}
                  ${isPast && !isToday ? 'bg-gray-50/40' : ''}
                  ${!isPast && !isToday ? 'hover:bg-blue-50/20' : ''}`}>

                {/* 日付 + 件数バッジ */}
                <div className="flex items-center justify-between mb-1">
                  <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0
                    ${isToday ? 'bg-blue-600 text-white' :
                      dow === 0 ? 'text-red-500' :
                      dow === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
                    {new Date(dateStr).getDate()}
                  </div>
                  {appts.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-800 rounded-full px-1.5 py-0.5 font-medium leading-none flex-shrink-0">
                      {appts.length}件
                    </span>
                  )}
                </div>

                {/* 稼働率バー */}
                {appts.length > 0 && (
                  <div className="h-1 bg-gray-100 rounded-full mb-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${occupancy}%`,
                        background: occupancy >= 80 ? '#ef4444' : occupancy >= 50 ? '#3b82f6' : '#22c55e'
                      }} />
                  </div>
                )}

                {/* 治療カラードット */}
                {treatmentColors.length > 0 && (
                  <div className="flex gap-1 mb-1">
                    {treatmentColors.map((c, i) => (
                      <div key={i} className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />
                    ))}
                  </div>
                )}

                {/* 予約プレビュー */}
                <div className="space-y-0.5 overflow-hidden">
                  {appts.slice(0, 2).map(a => {
                    const color = getTreatmentColor(a.treatment_type);
                    return (
                      <div key={a.id} className="text-xs px-1 py-0.5 rounded truncate leading-tight"
                        style={{ background: color.light, color: color.text, borderLeft: `2px solid ${color.bg}` }}>
                        {a.start_time?.substring(0,5)} {a.name_kana || a.patient_name}
                      </div>
                    );
                  })}
                  {appts.length > 2 && (
                    <div className="text-xs text-gray-400 pl-1 leading-tight">
                      +{appts.length - 2}件
                    </div>
                  )}
                </div>

                {/* 予約なし・休診 */}
                {appts.length === 0 && (
                  <div className="text-xs text-gray-300 text-center mt-2">
                    {dow === 0 ? '休診' : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 凡例 */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <div className="w-8 h-1 rounded-full bg-green-400" />少ない
          </span>
          <span className="flex items-center gap-1">
            <div className="w-8 h-1 rounded-full bg-blue-400" />普通
          </span>
          <span className="flex items-center gap-1">
            <div className="w-8 h-1 rounded-full bg-red-400" />混んでいる
          </span>
          <span className="ml-auto text-gray-400">バーは稼働率を表示</span>
        </div>
      </div>
    </div>
  );
}

// =============================================
// 新規予約モーダル【4修正: データ取得を修正】
// =============================================
function NewAppointmentModal({ slot, chairId, chairs, date, settings, onClose, onSave }) {
  const [patients, setPatients]               = useState([]);
  const [patientSearch, setPatientSearch]     = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPatientList, setShowPatientList] = useState(false);
  const [treatments, setTreatments]           = useState([]);
  const [staffList, setStaffList]             = useState([]);
  const [selectedTreatment, setSelectedTreatment] = useState(null);
  const [selectedChairId, setSelectedChairId] = useState(chairId);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [duration, setDuration]               = useState(settings.slotDuration);
  const [notes, setNotes]                     = useState('');
  const [saving, setSaving]                   = useState(false);
  const [newPatientMode, setNewPatientMode]   = useState(false);
  const [newPatient, setNewPatient]           = useState({ name: '', name_kana: '', phone: '' });
  const [kanaError, setKanaError]             = useState('');

  const endTime = toTimeStr(toMinutes(slot) + duration);

  useEffect(() => {
    const load = async () => {
      try {
        const [tr, st] = await Promise.all([
          axios.get('/api/treatments'),
          axios.get('/api/staff')
        ]);
        // 【4修正】レスポンス形式に対応
        const treatList = tr.data?.treatments || tr.data || [];
        const staffArr  = st.data?.staff      || st.data || [];
        setTreatments(Array.isArray(treatList) ? treatList : []);
        setStaffList(Array.isArray(staffArr) ? staffArr : []);
        if (treatList.length) { setSelectedTreatment(treatList[0]); setDuration(treatList[0].duration || settings.slotDuration); }
      } catch (err) { console.error('load error:', err); }
    };
    load();
  }, []);

  useEffect(() => {
    if (patientSearch.length < 1) { setShowPatientList(false); return; }
    const search = async () => {
      try {
        const res = await axios.get(`/api/patients?q=${patientSearch}`);
        setPatients(res.data.patients || res.data || []);
        setShowPatientList(true);
      } catch {}
    };
    search();
  }, [patientSearch]);

  function validateKana(val) {
    if (!val) { setKanaError('フリガナは必須です'); return false; }
    if (!/^[ァ-ヶー　\s]+$/.test(val)) { setKanaError('カタカナで入力してください'); return false; }
    setKanaError(''); return true;
  }

  async function handleSave() {
    setSaving(true);
    try {
      let patientId = selectedPatient?.id;
      if (newPatientMode) {
        if (!newPatient.name || !validateKana(newPatient.name_kana)) { setSaving(false); return; }
        const pr = await axios.post('/api/patients', newPatient);
        patientId = pr.data.id;
      }
      if (!patientId) { alert('患者を選択してください'); setSaving(false); return; }
      if (!selectedTreatment) { alert('治療内容を選択してください'); setSaving(false); return; }

      await axios.post('/api/appointments', {
        patient_id: patientId, appointment_date: date,
        start_time: slot, end_time: endTime,
        treatment_id: selectedTreatment.id,
        chair_id: selectedChairId,
        staff_id: selectedStaffId || null,
        notes, source: 'staff'
      });
      onSave();
    } catch (err) {
      alert(err.response?.data?.error || '保存に失敗しました');
    } finally { setSaving(false); }
  }

  const color = selectedTreatment ? getTreatmentColor(selectedTreatment.name) : DEFAULT_COLOR;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between" style={{ background: color.light }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: color.text }}>新規予約追加</h2>
            <p className="text-sm opacity-75" style={{ color: color.text }}>📅 {date} ⏰ {slot} → {endTime}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* 患者 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">患者 *</label>
            {!newPatientMode ? (
              <>
                <div className="relative">
                  <input type="text" placeholder="氏名・フリガナ・電話番号で検索..."
                    value={selectedPatient ? `${selectedPatient.name_kana||''} ${selectedPatient.name}` : patientSearch}
                    onChange={e => { setPatientSearch(e.target.value); setSelectedPatient(null); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {showPatientList && patients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto mt-1">
                      {patients.map(p => (
                        <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0"
                          onClick={() => { setSelectedPatient(p); setPatientSearch(''); setShowPatientList(false); }}>
                          <span className="font-medium">{p.name_kana}</span>
                          <span className="text-gray-500 ml-1">{p.name}</span>
                          <span className="text-gray-400 ml-2 text-xs">{p.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedPatient && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg text-sm flex items-center justify-between">
                    <span><span className="font-bold text-blue-700">{selectedPatient.name_kana}</span> <span className="text-blue-600">{selectedPatient.name}</span></span>
                    <button onClick={() => setSelectedPatient(null)} className="text-blue-400">×</button>
                  </div>
                )}
                <button onClick={() => setNewPatientMode(true)} className="mt-2 text-xs text-blue-600 hover:underline">＋ 新患登録</button>
              </>
            ) : (
              <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
                <p className="text-xs font-bold text-blue-700">新患登録</p>
                <input placeholder="氏名 *" value={newPatient.name}
                  onChange={e => setNewPatient(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                <div>
                  <input placeholder="フリガナ（カタカナ）*" value={newPatient.name_kana}
                    onChange={e => { setNewPatient(p => ({ ...p, name_kana: e.target.value })); validateKana(e.target.value); }}
                    className={`w-full border rounded px-2 py-1.5 text-sm ${kanaError ? 'border-red-400' : 'border-gray-200'}`} />
                  {kanaError && <p className="text-xs text-red-500 mt-0.5">{kanaError}</p>}
                </div>
                <input placeholder="電話番号" value={newPatient.phone}
                  onChange={e => setNewPatient(p => ({ ...p, phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
                <button onClick={() => setNewPatientMode(false)} className="text-xs text-gray-500 hover:underline">← 既存患者を選択</button>
              </div>
            )}
          </div>

          {/* 治療内容 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">治療内容 *</label>
            <div className="grid grid-cols-2 gap-1.5">
              {treatments.map(t => {
                const c = getTreatmentColor(t.name);
                const selected = selectedTreatment?.id === t.id;
                return (
                  <button key={t.id}
                    onClick={() => { setSelectedTreatment(t); setDuration(t.duration || settings.slotDuration); }}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all border text-left"
                    style={{ background: selected ? c.bg : c.light, color: selected ? '#fff' : c.text, borderColor: selected ? c.bg : c.border }}>
                    {t.name} <span className="opacity-70">{t.duration}分</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 所要時間 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">所要時間</label>
            <div className="flex items-center gap-3">
              <select value={duration} onChange={e => setDuration(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1">
                {[15,30,45,60,90,120].map(m => <option key={m} value={m}>{m}分</option>)}
              </select>
              <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                終了: <span className="font-bold text-gray-800">{endTime}</span>
              </div>
            </div>
          </div>

          {/* チェア */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">チェア</label>
            <select value={selectedChairId} onChange={e => setSelectedChairId(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {chairs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* 担当スタッフ */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">担当スタッフ</label>
            <select value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">未設定</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* 申し送り */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">📋 申し送り <span className="text-gray-400 font-normal text-xs">（任意）</span></label>
            <textarea placeholder="次回スタッフへの申し送り事項..." value={notes}
              onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">キャンセル</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: color.bg }}>
            {saving ? '保存中...' : '予約を追加'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// 予約詳細モーダル【1】患者編集対応
// =============================================
function AppointmentDetailModal({ appt, onClose, onUpdate }) {
  const [notes, setNotes]             = useState(appt.notes || '');
  const [saving, setSaving]           = useState(false);
  const [editPatient, setEditPatient] = useState(false);
  const [reschedule, setReschedule]   = useState(false); // 日程変更モード
  const color = getTreatmentColor(appt.treatment_type);

  async function handleSave() {
    setSaving(true);
    try { await axios.put(`/api/appointments/${appt.id}`, { notes }); onUpdate(); }
    catch { alert('更新に失敗しました'); } finally { setSaving(false); }
  }
  async function handleCancel() {
    if (!window.confirm('この予約をキャンセルしますか？')) return;
    try { await axios.delete(`/api/appointments/${appt.id}`); onUpdate(); }
    catch { alert('キャンセルに失敗しました'); }
  }

  if (editPatient) {
    return (
      <PatientEditModal
        patientId={appt.patient_id}
        onClose={() => setEditPatient(false)}
        onSave={() => { setEditPatient(false); onUpdate(); }}
      />
    );
  }

  if (reschedule) {
    return (
      <RescheduleModal
        appt={appt}
        onClose={() => setReschedule(false)}
        onSave={() => { setReschedule(false); onUpdate(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 rounded-t-2xl" style={{ background: color.light }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-lg font-bold" style={{ color: color.text }}>{appt.name_kana || appt.patient_name}</div>
                <button onClick={() => setEditPatient(true)}
                  className="p-1 rounded-lg hover:bg-black/10 transition-colors" title="患者情報を編集">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
              <div className="text-sm opacity-75" style={{ color: color.text }}>{appt.patient_name}</div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-400">日付</div>
              <div className="font-bold text-gray-800">{appt.appointment_date}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-400">時間</div>
              <div className="font-bold text-gray-800">{appt.start_time?.substring(0,5)}〜{appt.end_time?.substring(0,5)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-400">治療</div>
              <div className="font-bold" style={{ color: color.text }}>{appt.treatment_type}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-400">チェア</div>
              <div className="font-bold text-gray-800">{appt.chair_name}</div>
            </div>
          </div>

          {/* 日程変更ボタン */}
          <button onClick={() => setReschedule(true)}
            className="w-full border border-blue-200 text-blue-600 rounded-xl py-2 text-sm font-medium hover:bg-blue-50 flex items-center justify-center gap-2 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            日程・時間を変更する
          </button>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">📋 申し送り</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="申し送り事項を入力..." />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={handleCancel} className="flex-1 border border-red-200 text-red-500 rounded-xl py-2 text-sm hover:bg-red-50">キャンセル</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-xl py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: color.bg }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// 日程変更モーダル（案A）
// =============================================
function RescheduleModal({ appt, onClose, onSave }) {
  const durationMin = toMinutes(appt.end_time) - toMinutes(appt.start_time);
  const [newDate, setNewDate]       = useState(appt.appointment_date);
  const [newTime, setNewTime]       = useState(appt.start_time?.substring(0,5));
  const [newChairId, setNewChairId] = useState(appt.chair_id);
  const [chairs, setChairs]         = useState([]);
  const [slots, setSlots]           = useState([]);
  const [saving, setSaving]         = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const color = getTreatmentColor(appt.treatment_type);

  // チェア一覧取得
  useEffect(() => {
    axios.get('/api/appointments/calendar/' + newDate)
      .then(r => { setChairs(r.data?.chairs || []); })
      .catch(() => {});
  }, []);

  // 日付変更時に空き枠を取得
  useEffect(() => {
    setLoadingSlots(true);
    axios.get(`/api/appointments/available-slots/${newDate}`)
      .then(r => {
        // 自分以外の枠を取得
        const allSlots = r.data?.slots || [];
        setSlots(allSlots);
      })
      .catch(() => { setSlots([]); })
      .finally(() => setLoadingSlots(false));
  }, [newDate]);

  const newEndTime = toTimeStr(toMinutes(newTime) + durationMin);

  async function handleSave() {
    setSaving(true);
    try {
      await axios.put(`/api/appointments/${appt.id}`, {
        appointment_date: newDate,
        start_time: newTime,
        end_time:   newEndTime,
        chair_id:   newChairId,
      });
      onSave();
    } catch (err) {
      alert(err.response?.data?.error || '変更に失敗しました');
    } finally { setSaving(false); }
  }

  const isChanged = newDate !== appt.appointment_date ||
    newTime !== appt.start_time?.substring(0,5) ||
    newChairId !== appt.chair_id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-800">日程・時間を変更</h2>
            <p className="text-xs text-gray-500 mt-0.5">{appt.name_kana} / {appt.treatment_type}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* 現在の予約 */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm">
            <div className="text-xs text-orange-500 font-medium mb-1">変更前</div>
            <div className="text-orange-800 font-medium">
              {appt.appointment_date} &nbsp;
              {appt.start_time?.substring(0,5)}〜{appt.end_time?.substring(0,5)}
            </div>
          </div>

          {/* 新しい日付 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">新しい日付</label>
            <input type="date" value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* 新しい時間（空き枠から選択） */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              新しい時間
              <span className="ml-1 font-normal text-gray-400">（所要時間: {durationMin}分 → 終了: {newEndTime}）</span>
            </label>
            {loadingSlots ? (
              <div className="text-xs text-gray-400 text-center py-3">読み込み中...</div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto">
                {slots.map(slot => {
                  const isAvailable = slot.available || slot.time === appt.start_time?.substring(0,5);
                  const isSelected  = slot.time === newTime;
                  return (
                    <button key={slot.time} type="button"
                      onClick={() => isAvailable && setNewTime(slot.time)}
                      disabled={!isAvailable}
                      className={`py-1.5 rounded-lg text-xs font-medium border transition-all
                        ${isSelected ? 'bg-blue-600 text-white border-blue-600' :
                          isAvailable ? 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-300' :
                          'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'}`}>
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* チェア選択 */}
          {chairs.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">チェア</label>
              <div className="grid grid-cols-3 gap-2">
                {chairs.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => setNewChairId(c.id)}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all
                      ${newChairId === c.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50'}`}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 変更後プレビュー */}
          {isChanged && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
              <div className="text-xs text-blue-500 font-medium mb-1">変更後</div>
              <div className="text-blue-800 font-medium">
                {newDate} &nbsp; {newTime}〜{newEndTime}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50">
            戻る
          </button>
          <button onClick={handleSave} disabled={saving || !isChanged}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 transition-colors"
            style={{ background: isChanged ? color.bg : '#9ca3af' }}>
            {saving ? '変更中...' : '変更を保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// 患者編集モーダル（カレンダーから開く）
// =============================================
function PatientEditModal({ patientId, onClose, onSave }) {
  const [patient, setPatient] = useState(null);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [kanaError, setKanaError] = useState('');

  useEffect(() => {
    axios.get(`/api/patients/${patientId}`)
      .then(r => { setPatient(r.data); setForm(r.data); })
      .catch(() => alert('患者情報の取得に失敗しました'));
  }, [patientId]);

  // 年代を生年月日から自動計算
  function calcAgeGroup(birthDate) {
    if (!birthDate) return null;
    const age = Math.floor((new Date() - new Date(birthDate)) / (1000 * 60 * 60 * 24 * 365.25));
    return `${Math.floor(age / 10) * 10}代`;
  }

  function validateKana(val) {
    if (!val) { setKanaError('フリガナは必須です'); return false; }
    if (!/^[ァ-ヶー　\s]+$/.test(val)) { setKanaError('カタカナで入力してください'); return false; }
    setKanaError(''); return true;
  }

  async function handleSave() {
    if (!validateKana(form.name_kana)) return;
    setSaving(true);
    try {
      // 生年月日があれば年代を自動更新
      const age_group = form.birth_date ? calcAgeGroup(form.birth_date) : form.age_group;
      await axios.put(`/api/patients/${patientId}`, { ...form, age_group });
      onSave();
    } catch (err) {
      alert(err.response?.data?.error || '保存に失敗しました');
    } finally { setSaving(false); }
  }

  if (!patient) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" /></div>
    </div>
  );

  const AGE_GROUPS = ['10代','20代','30代','40代','50代','60代','70代','80代','90代以上'];
  const autoAgeGroup = form.birth_date ? calcAgeGroup(form.birth_date) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">患者情報編集</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">氏名 *</label>
              <input value={form.name || ''} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">フリガナ *</label>
              <input value={form.name_kana || ''}
                onChange={e => { setForm(f => ({...f, name_kana: e.target.value})); validateKana(e.target.value); }}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${kanaError ? 'border-red-400' : 'border-gray-200'}`} />
              {kanaError && <p className="text-xs text-red-500 mt-0.5">{kanaError}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">電話番号</label>
              <input value={form.phone || ''} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">性別</label>
              <select value={form.gender || ''} onChange={e => setForm(f => ({...f, gender: e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">未設定</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
              </select>
            </div>
          </div>

          {/* 【2】年代フィールド */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              年代
              {autoAgeGroup && <span className="ml-2 text-blue-500 font-normal">（生年月日から自動: {autoAgeGroup}）</span>}
            </label>
            {autoAgeGroup ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700 font-medium">
                {autoAgeGroup}（生年月日から自動計算）
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1">
                {AGE_GROUPS.map(ag => (
                  <button key={ag} type="button"
                    onClick={() => setForm(f => ({...f, age_group: ag}))}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-all border
                      ${form.age_group === ag ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50'}`}>
                    {ag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">生年月日</label>
            <input type="date" value={form.birth_date?.substring(0,10) || ''}
              onChange={e => setForm(f => ({...f, birth_date: e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-gray-400 mt-0.5">入力すると年代が自動計算されます</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">備考・アレルギー</label>
            <textarea value={form.notes || ''} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
              rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50">キャンセル</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}
