// src/pages/CalendarPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'https://dental-booking-api-k2v1.onrender.com';

// =============================================
// 【4】治療内容別カラー定義
// =============================================
const TREATMENT_COLORS = {
  '定期検診':   { bg: '#4A90D9', light: '#EBF4FF', text: '#1a5fa8', border: '#2171c7' },
  '虫歯治療':   { bg: '#E8534A', light: '#FFF0EF', text: '#c0392b', border: '#c0392b' },
  '歯周病治療': { bg: '#27AE60', light: '#EDFAF1', text: '#1e8449', border: '#1e8449' },
  '抜歯':       { bg: '#8E44AD', light: '#F5EEF8', text: '#6c3483', border: '#6c3483' },
  '根管治療':   { bg: '#D35400', light: '#FEF5EC', text: '#b7440b', border: '#b7440b' },
  'セラミック': { bg: '#16A085', light: '#E8F8F5', text: '#0e6655', border: '#0e6655' },
  '矯正':       { bg: '#F39C12', light: '#FEF9E7', text: '#d68910', border: '#d68910' },
  'ホワイトニング': { bg: '#2980B9', light: '#EBF5FB', text: '#1f618d', border: '#1f618d' },
  '入れ歯':     { bg: '#7F8C8D', light: '#F2F3F4', text: '#566573', border: '#566573' },
  'その他':     { bg: '#95A5A6', light: '#F4F6F6', text: '#717d7e', border: '#717d7e' },
};
const DEFAULT_COLOR = { bg: '#4A90D9', light: '#EBF4FF', text: '#1a5fa8', border: '#2171c7' };

function getTreatmentColor(treatmentType) {
  return TREATMENT_COLORS[treatmentType] || DEFAULT_COLOR;
}

// 分 → HH:MM
function toTimeStr(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// HH:MM → 分
function toMinutes(timeStr) {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return h * 60 + m;
}

// =============================================
// メインコンポーネント
// =============================================
export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('chair'); // 'chair' | 'doctor'
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(false);

  // D&D
  const [dragging, setDragging] = useState(null);  // { appointment, origSlot, origChair }
  const [dragOver, setDragOver] = useState(null);  // { slot, chair }

  // モーダル
  const [newApptModal, setNewApptModal] = useState(null); // { slot, chair }
  const [detailModal, setDetailModal] = useState(null);   // appointment

  // 現在時刻
  const [now, setNow] = useState(new Date());
  const timelineRef = useRef(null);

  // 現在時刻を1分毎に更新【5】
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/api/appointments/calendar/${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCalendarData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  if (!calendarData) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  const { settings, slots, appointments, blocks } = calendarData;
  const chairs = Array.from({ length: settings.maxChairs }, (_, i) => i + 1);

  // タイムライン計算
  const openMin = toMinutes(settings.openTime);
  const closeMin = toMinutes(settings.closeTime);
  const totalMin = closeMin - openMin;
  const SLOT_HEIGHT = 72; // px per slotDuration【6】枠の高さを広げる
  const HEADER_HEIGHT = 48;
  const MIN_PX = SLOT_HEIGHT / settings.slotDuration; // px per minute

  function slotTop(timeStr) {
    return (toMinutes(timeStr) - openMin) * MIN_PX;
  }
  function durationPx(minutes) {
    return minutes * MIN_PX;
  }

  const timelineHeight = totalMin * MIN_PX;

  // 現在時刻の位置【5】
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMin - openMin) * MIN_PX;
  const showNowLine = nowMin >= openMin && nowMin <= closeMin &&
    selectedDate === new Date().toISOString().split('T')[0];

  // チェア別予約マップ
  function getApptForChairSlot(chair, slot) {
    return appointments.find(a =>
      a.chair_number === chair && a.time_slot === slot
    );
  }

  // 昼休みブロック
  const lunchTop = slotTop(settings.lunchStart);
  const lunchHeight = durationPx(toMinutes(settings.lunchEnd) - toMinutes(settings.lunchStart));

  // ==========================
  // D&D ハンドラー【2】
  // ==========================
  function handleDragStart(e, appt) {
    setDragging({ appointment: appt, origSlot: appt.time_slot, origChair: appt.chair_number });
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, slot, chair) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver({ slot, chair });
  }

  function handleDrop(e, slot, chair) {
    e.preventDefault();
    if (!dragging) return;
    if (slot === dragging.origSlot && chair === dragging.origChair) {
      setDragging(null);
      setDragOver(null);
      return;
    }
    moveAppointment(dragging.appointment, slot, chair);
    setDragging(null);
    setDragOver(null);
  }

  function handleDragEnd() {
    // キャンセル時は元の位置に戻る（状態リセットのみ）
    setDragging(null);
    setDragOver(null);
  }

  async function moveAppointment(appt, newSlot, newChair) {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/appointments/${appt.id}`, {
        appointment_date: selectedDate,
        time_slot: newSlot,
        chair_number: newChair
      }, { headers: { Authorization: `Bearer ${token}` } });
      fetchCalendar();
    } catch (err) {
      if (err.response?.status === 409) {
        alert('移動先はすでに予約済みです');
      } else {
        alert('移動に失敗しました');
      }
    }
  }

  // ==========================
  // 空きコマクリック【3】
  // ==========================
  function handleEmptySlotClick(slot, chair) {
    setNewApptModal({ slot, chair });
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">📅 診療カレンダー</h1>

        <div className="flex items-center gap-3 flex-wrap">
          {/* 日付ナビゲーション */}
          <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2">
            <button onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }} className="text-gray-500 hover:text-blue-600 transition-colors">◀</button>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-sm font-semibold text-gray-700 outline-none cursor-pointer"
            />
            <button onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }} className="text-gray-500 hover:text-blue-600 transition-colors">▶</button>
          </div>

          {/* 表示切替 */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {['chair', 'doctor'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 text-sm font-medium transition-colors
                  ${viewMode === mode ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {mode === 'chair' ? '🦷 チェア別' : '👨‍⚕️ ドクター別'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchCalendar}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 shadow-sm"
          >
            🔄 更新
          </button>
        </div>
      </div>

      {/* 治療カラー凡例【4】 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(TREATMENT_COLORS).map(([name, color]) => (
          <span key={name} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
            style={{ background: color.light, color: color.text, border: `1px solid ${color.border}` }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: color.bg }} />
            {name}
          </span>
        ))}
      </div>

      {loading && (
        <div className="text-center py-4 text-gray-400 text-sm animate-pulse">読み込み中...</div>
      )}

      {/* タイムライングリッド */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex" style={{ minWidth: '700px' }}>

          {/* 時刻軸 */}
          <div className="w-16 flex-shrink-0 bg-gray-50 border-r border-gray-100">
            <div style={{ height: HEADER_HEIGHT }} className="border-b border-gray-100" />
            <div className="relative" style={{ height: timelineHeight }}>
              {slots.map(slot => (
                <div
                  key={slot}
                  className="absolute left-0 right-0 flex items-start justify-end pr-2"
                  style={{ top: slotTop(slot), height: SLOT_HEIGHT }}
                >
                  <span className="text-xs text-gray-400 font-mono leading-none pt-1">{slot}</span>
                </div>
              ))}
            </div>
          </div>

          {/* チェア列 */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex">
              {chairs.map(chair => (
                <div key={chair} className="flex-1 min-w-[160px] border-r border-gray-100 last:border-r-0">

                  {/* カラムヘッダー */}
                  <div
                    style={{ height: HEADER_HEIGHT }}
                    className="flex items-center justify-center border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white"
                  >
                    <span className="text-sm font-bold text-gray-700">
                      🦷 チェア {chair}
                    </span>
                  </div>

                  {/* タイムラインボディ */}
                  <div
                    className="relative"
                    style={{ height: timelineHeight }}
                    ref={chair === 1 ? timelineRef : null}
                  >
                    {/* 昼休みオーバーレイ */}
                    <div
                      className="absolute left-0 right-0 bg-yellow-50 border-y border-yellow-100 z-10"
                      style={{ top: lunchTop, height: lunchHeight }}
                    >
                      <span className="text-xs text-yellow-500 font-medium pl-2 pt-1 block">🍱 昼休み</span>
                    </div>

                    {/* 【5】現在時刻の赤い横線 */}
                    {showNowLine && chair === 1 && (
                      <div
                        className="absolute left-0 z-30 pointer-events-none"
                        style={{ top: nowTop, width: `${chairs.length * 160 + 64}px`, left: -64 }}
                      >
                        <div className="relative">
                          <div className="absolute left-14 right-0 h-0.5 bg-red-500 shadow-sm" />
                          <div className="absolute left-12 -top-1.5 w-3 h-3 rounded-full bg-red-500 shadow" />
                          <span className="absolute left-16 -top-3 text-xs text-red-500 font-bold bg-white px-1 rounded shadow-sm">
                            {now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* スロットグリッド */}
                    {slots.map(slot => {
                      const appt = getApptForChairSlot(chair, slot);
                      const isDragTarget = dragOver?.slot === slot && dragOver?.chair === chair;
                      const isLunchSlot = toMinutes(slot) >= toMinutes(settings.lunchStart) &&
                        toMinutes(slot) < toMinutes(settings.lunchEnd);

                      if (isLunchSlot) {
                        return (
                          <div key={slot} style={{ height: SLOT_HEIGHT, top: slotTop(slot), position: 'absolute', width: '100%' }} />
                        );
                      }

                      if (appt) {
                        // 先頭スロットのみ描画（複数スロット占有の場合）
                        const isFirst = appt.time_slot === slot;
                        if (!isFirst) return null;

                        const color = getTreatmentColor(appt.treatment_type);
                        const heightPx = durationPx(appt.duration_minutes || settings.slotDuration);

                        return (
                          <AppointmentBlock
                            key={appt.id}
                            appt={appt}
                            color={color}
                            top={slotTop(slot)}
                            height={heightPx}
                            dragging={dragging?.appointment?.id === appt.id}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onClick={() => setDetailModal(appt)}
                          />
                        );
                      }

                      return (
                        <div
                          key={slot}
                          className={`absolute left-0 right-0 border-b border-gray-50 cursor-pointer
                            transition-colors group
                            ${isDragTarget ? 'bg-blue-50 border-blue-200' : 'hover:bg-blue-50/50'}`}
                          style={{ top: slotTop(slot), height: SLOT_HEIGHT }}
                          onDragOver={e => handleDragOver(e, slot, chair)}
                          onDrop={e => handleDrop(e, slot, chair)}
                          onClick={() => handleEmptySlotClick(slot, chair)}
                        >
                          {isDragTarget && (
                            <div className="absolute inset-1 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center">
                              <span className="text-xs text-blue-500 font-medium">ここに移動</span>
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* 新規予約モーダル【3,9】 */}
      {newApptModal && (
        <NewAppointmentModal
          slot={newApptModal.slot}
          chair={newApptModal.chair}
          date={selectedDate}
          settings={settings}
          onClose={() => setNewApptModal(null)}
          onSave={() => { setNewApptModal(null); fetchCalendar(); }}
        />
      )}

      {/* 詳細モーダル */}
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
// 【2,4,6,7】予約ブロックコンポーネント
// =============================================
function AppointmentBlock({ appt, color, top, height, dragging, onDragStart, onDragEnd, onClick }) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, appt)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`absolute left-1 right-1 rounded-lg cursor-grab active:cursor-grabbing
        shadow-sm transition-all select-none z-20
        ${dragging ? 'opacity-40 scale-95' : 'hover:shadow-md hover:-translate-y-0.5'}`}
      style={{
        top: top + 2,
        height: height - 4,
        background: color.light,
        borderLeft: `4px solid ${color.bg}`,
        border: `1px solid ${color.border}`,
        borderLeftWidth: 4,
      }}
    >
      <div className="p-1.5 h-full flex flex-col overflow-hidden">
        {/* 【7】カタカナ名表示 */}
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
          {appt.time_slot} ({appt.duration_minutes || 30}分)
        </div>
        {/* 【6】申し送り表示 */}
        {appt.notes && (
          <div className="text-xs mt-0.5 leading-tight italic opacity-80 truncate" style={{ color: color.text }}>
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
}

// =============================================
// 【3,9】新規予約モーダル
// =============================================
function NewAppointmentModal({ slot, chair, date, settings, onClose, onSave }) {
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [treatmentType, setTreatmentType] = useState('定期検診');
  const [duration, setDuration] = useState(settings.slotDuration);
  const [doctorName, setDoctorName] = useState('');
  const [notes, setNotes] = useState(''); // 【9】申し送り
  const [saving, setSaving] = useState(false);
  const [showPatientList, setShowPatientList] = useState(false);
  const [newPatientMode, setNewPatientMode] = useState(false);

  // 新患フォーム
  const [newPatient, setNewPatient] = useState({ name: '', name_kana: '', phone: '' });
  const [kanaError, setKanaError] = useState('');

  // 終了時間計算【3】
  const endTime = toTimeStr(toMinutes(slot) + duration);
  const color = getTreatmentColor(treatmentType);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API}/api/patients?search=${patientSearch}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPatients(res.data);
        setShowPatientList(true);
      } catch {}
    };
    if (patientSearch.length >= 1) fetchPatients();
    else setShowPatientList(false);
  }, [patientSearch]);

  function validateKana(val) {
    if (!val) { setKanaError('フリガナは必須です'); return false; }
    if (!/^[ァ-ヶー　\s]+$/.test(val)) { setKanaError('カタカナで入力してください'); return false; }
    setKanaError('');
    return true;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      let patientId = selectedPatient?.id;

      // 新患登録【8】
      if (newPatientMode) {
        if (!newPatient.name || !validateKana(newPatient.name_kana)) {
          setSaving(false);
          return;
        }
        const pr = await axios.post(`${API}/api/patients`, newPatient, {
          headers: { Authorization: `Bearer ${token}` }
        });
        patientId = pr.data.id;
      }

      if (!patientId) { alert('患者を選択してください'); setSaving(false); return; }

      await axios.post(`${API}/api/appointments`, {
        patient_id: patientId,
        appointment_date: date,
        time_slot: slot,
        duration_minutes: duration,
        treatment_type: treatmentType,
        treatment_color: color.bg,
        chair_number: chair,
        doctor_name: doctorName,
        notes  // 【9】
      }, { headers: { Authorization: `Bearer ${token}` } });

      onSave();
    } catch (err) {
      alert(err.response?.data?.error || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
          style={{ background: color.light }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: color.text }}>新規予約追加</h2>
            <p className="text-sm opacity-75" style={{ color: color.text }}>
              📅 {date} &nbsp;⏰ {slot} → {endTime} &nbsp;🦷 チェア{chair}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* 患者選択 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">患者 *</label>
            {!newPatientMode ? (
              <>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="氏名・フリガナ・電話番号で検索..."
                    value={selectedPatient ? `${selectedPatient.name_kana} ${selectedPatient.name}` : patientSearch}
                    onChange={e => { setPatientSearch(e.target.value); setSelectedPatient(null); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {showPatientList && patients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto mt-1">
                      {patients.map(p => (
                        <button key={p.id}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0"
                          onClick={() => { setSelectedPatient(p); setPatientSearch(''); setShowPatientList(false); }}>
                          <span className="font-medium text-gray-800">{p.name_kana}</span>
                          <span className="text-gray-500 ml-1">{p.name}</span>
                          <span className="text-gray-400 ml-2 text-xs">{p.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedPatient && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg text-sm flex items-center justify-between">
                    <span>
                      <span className="font-bold text-blue-700">{selectedPatient.name_kana}</span>
                      <span className="text-blue-600 ml-1">{selectedPatient.name}</span>
                      <span className="text-blue-400 ml-2">{selectedPatient.phone}</span>
                    </span>
                    <button onClick={() => setSelectedPatient(null)} className="text-blue-400 hover:text-blue-600">×</button>
                  </div>
                )}
                <button onClick={() => setNewPatientMode(true)}
                  className="mt-2 text-xs text-blue-600 hover:underline">
                  ＋ 新患登録
                </button>
              </>
            ) : (
              <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
                <p className="text-xs font-bold text-blue-700 mb-2">新患登録</p>
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
                <button onClick={() => setNewPatientMode(false)} className="text-xs text-gray-500 hover:underline">
                  ← 既存患者を選択
                </button>
              </div>
            )}
          </div>

          {/* 治療内容【4】 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">治療内容 *</label>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(TREATMENT_COLORS).map(([name, c]) => (
                <button key={name}
                  onClick={() => setTreatmentType(name)}
                  className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all border"
                  style={{
                    background: treatmentType === name ? c.bg : c.light,
                    color: treatmentType === name ? '#fff' : c.text,
                    borderColor: treatmentType === name ? c.bg : c.border,
                    transform: treatmentType === name ? 'scale(1.03)' : 'scale(1)',
                    boxShadow: treatmentType === name ? `0 2px 8px ${c.bg}66` : 'none'
                  }}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* 所要時間【3】終了時間自動計算 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">所要時間</label>
            <div className="flex items-center gap-3">
              <select value={duration} onChange={e => setDuration(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1">
                {[15, 30, 45, 60, 90, 120].map(m => (
                  <option key={m} value={m}>{m}分</option>
                ))}
              </select>
              <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                終了: <span className="font-bold text-gray-800">{endTime}</span>
              </div>
            </div>
          </div>

          {/* ドクター */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">担当ドクター</label>
            <input type="text" placeholder="例: 田中" value={doctorName}
              onChange={e => setDoctorName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* 【9】申し送り入力欄 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
              📋 申し送り <span className="text-gray-400 font-normal text-xs">（任意）</span>
            </label>
            <textarea
              placeholder="次回のスタッフへの申し送り事項、注意事項など..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            キャンセル
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{ background: color.bg }}>
            {saving ? '保存中...' : '予約を追加'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// 予約詳細・編集モーダル
// =============================================
function AppointmentDetailModal({ appt, onClose, onUpdate }) {
  const [notes, setNotes] = useState(appt.notes || '');
  const [saving, setSaving] = useState(false);
  const color = getTreatmentColor(appt.treatment_type);

  async function handleSave() {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/appointments/${appt.id}`, { notes }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onUpdate();
    } catch { alert('更新に失敗しました'); }
    finally { setSaving(false); }
  }

  async function handleCancel() {
    if (!window.confirm('この予約をキャンセルしますか？')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/api/appointments/${appt.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onUpdate();
    } catch { alert('キャンセルに失敗しました'); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 rounded-t-2xl" style={{ background: color.light }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-lg font-bold" style={{ color: color.text }}>{appt.name_kana}</div>
              <div className="text-sm opacity-75" style={{ color: color.text }}>{appt.patient_name}</div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-400">時間</div>
              <div className="font-bold text-gray-800">
                {appt.time_slot} ({appt.duration_minutes}分)
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-400">治療</div>
              <div className="font-bold" style={{ color: color.text }}>{appt.treatment_type}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-400">チェア</div>
              <div className="font-bold text-gray-800">{appt.chair_number}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-400">担当</div>
              <div className="font-bold text-gray-800">{appt.doctor_name || '未設定'}</div>
            </div>
          </div>

          {/* 申し送り編集 */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1 block">📋 申し送り</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              placeholder="申し送り事項を入力..."
            />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={handleCancel}
            className="flex-1 border border-red-200 text-red-500 rounded-xl py-2 text-sm hover:bg-red-50">
            キャンセル
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-xl py-2 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: color.bg }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
