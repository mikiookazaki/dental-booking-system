// src/pages/CalendarPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [viewType, setViewType]           = useState('day');   // 'month' | 'day'
  const [viewMode, setViewMode]           = useState('chair'); // 'chair' | 'doctor'
  const [selectedDate, setSelectedDate]   = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth]   = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [calendarData, setCalendarData]   = useState(null);
  const [monthData, setMonthData]         = useState({});
  const [loading, setLoading]             = useState(false);
  const [dragging, setDragging]           = useState(null);
  const [dragOver, setDragOver]           = useState(null);
  const [newApptModal, setNewApptModal]   = useState(null);
  const [detailModal, setDetailModal]     = useState(null);
  const [allStaff, setAllStaff]           = useState([]);
  const [now, setNow]                     = useState(new Date());

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
        onSwitchToDay={() => setViewType('day')}
      />
    );
  }

  // ── 日別ビュー ──────────────────────────────────
  if (!calendarData) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  const { settings, chairs, slots, appointments, blocks } = calendarData;
  // 【4】表示時間は displayStart/displayEnd を優先、なければ診療時間を使用
  const displayStart = settings.displayStart || settings.openTime;
  const displayEnd   = settings.displayEnd   || settings.closeTime;
  const openMin  = toMinutes(displayStart);
  const closeMin = toMinutes(displayEnd);
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

  // D&D
  function handleDragStart(e, appt) { setDragging({ appointment: appt }); e.dataTransfer.effectAllowed = 'move'; }
  function handleDragOver(e, slot, colId) { e.preventDefault(); setDragOver({ slot, colId }); }
  function handleDrop(e, slot, colId) {
    e.preventDefault();
    if (!dragging) return;
    const appt = dragging.appointment;
    const durationMin = toMinutes(appt.end_time) - toMinutes(appt.start_time);
    const newEndTime  = toTimeStr(toMinutes(slot) + durationMin);
    const body = { appointment_date: selectedDate, start_time: slot, end_time: newEndTime };
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
    <div className="p-4 bg-gray-50 min-h-screen">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">📅 診療カレンダー</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 月/日切替【1】 */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {[['month','月'], ['day','日']].map(([v, label]) => (
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
            <input type="date" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-sm font-semibold text-gray-700 outline-none cursor-pointer" />
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

      {/* 凡例 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(TREATMENT_COLORS).map(([name, color]) => (
          <span key={name} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
            style={{ background: color.light, color: color.text, border: `1px solid ${color.border}` }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: color.bg }} />{name}
          </span>
        ))}
      </div>

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

                    <div className="relative" style={{ height: timelineHeight }}>
                      {/* 昼休み */}
                      <div className="absolute left-0 right-0 bg-yellow-50 border-y border-yellow-100 z-10"
                        style={{ top: lunchTop, height: lunchHeight }}>
                        <span className="text-xs text-yellow-500 font-medium pl-2 pt-1 block">🍱 昼休み</span>
                      </div>

                      {/* 現在時刻ライン */}
                      {showNowLine && colIdx === 0 && (
                        <div className="absolute z-30 pointer-events-none"
                          style={{ top: nowTop, left: -64, width: `${columns.length * 180 + 64}px` }}>
                          <div className="relative">
                            <div className="absolute left-14 right-0 h-0.5 bg-red-500 shadow-sm" />
                            <div className="absolute left-12 -top-1.5 w-3 h-3 rounded-full bg-red-500 shadow" />
                            <span className="absolute left-16 -top-3 text-xs text-red-500 font-bold bg-white px-1 rounded shadow-sm">
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
                            onDragStart={e => handleDragStart(e, appt)}
                            onDragEnd={handleDragEnd}
                            onClick={() => setDetailModal(appt)}
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

                      {/* 空きスロット */}
                      {slots.map(slot => {
                        const slotMin    = toMinutes(slot);
                        const slotEndMin = slotMin + settings.slotDuration;
                        const isLunch    = slotMin >= toMinutes(settings.lunchStart) && slotMin < toMinutes(settings.lunchEnd);
                        if (isLunch) return null;
                        const hasAppt = getApptsForColumn(col).some(a =>
                          toMinutes(a.start_time) < slotEndMin && toMinutes(a.end_time) > slotMin
                        );
                        if (hasAppt) return null;
                        const isDragTarget = dragOver?.slot === slot && dragOver?.colId === col.id;
                        return (
                          <div key={slot}
                            className={`absolute left-0 right-0 border-b border-gray-50 cursor-pointer transition-colors group
                              ${isDragTarget ? 'bg-blue-50 border-blue-200' : 'hover:bg-blue-50/50'}`}
                            style={{ top: slotTop(slot), height: SLOT_HEIGHT }}
                            onDragOver={e => handleDragOver(e, slot, col.id)}
                            onDrop={e => handleDrop(e, slot, col.id)}
                            onClick={() => setNewApptModal({ slot, chairId: col.type === 'chair' ? col.id : chairs[0]?.id })}>
                            {isDragTarget && (
                              <div className="absolute inset-1 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center">
                                <span className="text-xs text-blue-500 font-medium">ここに移動</span>
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="text-xs text-blue-400">＋ 予約追加</span>
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
    </div>
  );
}

// =============================================
// 【1】月カレンダービュー
// =============================================
function MonthView({ currentMonth, monthData, onPrevMonth, onNextMonth, onSelectDate, onSwitchToDay }) {
  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth   = new Date(year, month, 0).getDate();
  const firstDow      = new Date(year, month-1, 1).getDay();
  const today         = new Date().toISOString().split('T')[0];

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">📅 診療カレンダー</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <button className="px-3 py-2 text-sm font-medium bg-blue-600 text-white">月表示</button>
            <button onClick={onSwitchToDay} className="px-3 py-2 text-sm font-medium bg-white text-gray-600 hover:bg-gray-50">日表示</button>
          </div>
        </div>
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
            if (!dateStr) return <div key={`empty-${idx}`} className="h-24 border-b border-r border-gray-50" />;
            const data   = monthData[dateStr];
            const appts  = data?.appointments || [];
            const dow    = new Date(dateStr).getDay();
            const isToday = dateStr === today;
            const isPast  = dateStr < today;

            return (
              <div key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className={`h-24 border-b border-r border-gray-50 p-1 cursor-pointer transition-colors
                  ${isToday ? 'bg-blue-50' : isPast ? 'bg-gray-50/50' : 'hover:bg-blue-50/30'}`}>
                <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                  ${isToday ? 'bg-blue-600 text-white' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
                  {new Date(dateStr).getDate()}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {appts.slice(0, 3).map(a => {
                    const color = getTreatmentColor(a.treatment_type);
                    return (
                      <div key={a.id} className="text-xs px-1 rounded truncate"
                        style={{ background: color.light, color: color.text, borderLeft: `2px solid ${color.bg}` }}>
                        {a.start_time?.substring(0,5)} {a.name_kana || a.patient_name}
                      </div>
                    );
                  })}
                  {appts.length > 3 && (
                    <div className="text-xs text-gray-400 pl-1">+{appts.length - 3}件</div>
                  )}
                </div>
              </div>
            );
          })}
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
// 予約詳細モーダル
// =============================================
function AppointmentDetailModal({ appt, onClose, onUpdate }) {
  const [notes, setNotes]   = useState(appt.notes || '');
  const [saving, setSaving] = useState(false);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 rounded-t-2xl" style={{ background: color.light }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-lg font-bold" style={{ color: color.text }}>{appt.name_kana || appt.patient_name}</div>
              <div className="text-sm opacity-75" style={{ color: color.text }}>{appt.patient_name}</div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
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
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-400">担当</div>
              <div className="font-bold text-gray-800">{appt.doctor_name || '未設定'}</div>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">📋 申し送り</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="申し送り事項を入力..." />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={handleCancel} className="flex-1 border border-red-200 text-red-500 rounded-xl py-2 text-sm hover:bg-red-50">予約キャンセル</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-xl py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: color.bg }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
