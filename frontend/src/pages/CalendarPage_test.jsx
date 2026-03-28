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