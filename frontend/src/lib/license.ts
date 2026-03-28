// ============================================================
// lib/license.ts
// ライセンス管理ユーティリティ（Vite + React + axios 対応版）
// ============================================================

import { useEffect, useState } from 'react'
import React from 'react'
import api from '../api'

// -------------------------------------------------------
// プラン定義
// -------------------------------------------------------
export type Plan = 'basic' | 'standard' | 'pro'

export const PLAN_LABELS: Record<Plan, string> = {
  basic:    'ベーシック',
  standard: 'スタンダード',
  pro:      'プロ',
}

export const PLAN_PRICES: Record<Plan, string> = {
  basic:    '¥9,800 / 月',
  standard: '¥19,800 / 月',
  pro:      '¥29,800〜 / 月',
}

// -------------------------------------------------------
// 機能フラグ定義
// -------------------------------------------------------
export const FEATURES = {
  // 予約・来院
  APPOINTMENT_CALENDAR:     'basic',
  LINE_BOOKING:             'basic',
  LINE_QUESTIONNAIRE:       'basic',
  REMINDER_AUTO_SEND:       'standard',
  CHECKUP_REMINDER:         'standard',
  POST_TREATMENT_FOLLOWUP:  'standard',

  // 患者管理・ナーチャリング
  PATIENT_MANAGEMENT:       'basic',
  PATIENT_TAGS_SEGMENTS:    'standard',
  BIRTHDAY_MESSAGE:         'standard',
  NURTURING_SCENARIO:       'pro',

  // マーケティング
  COUPON:                   'standard',
  SURVEY:                   'standard',
  CAMPAIGN_BROADCAST:       'pro',
  REVIEW_PROMOTION:         'pro',

  // AI・自動化
  AI_FAQ:                   'pro',
  AI_TRIAGE:                'pro',
  AI_SYMPTOM_ADVICE:        'pro',

  // 分析
  DASHBOARD_BASIC:          'basic',
  DASHBOARD_ADVANCED:       'standard',
  CHURN_ALERT:              'standard',
  LINE_ROI_ANALYSIS:        'pro',
  MULTI_CLINIC_DASHBOARD:   'pro',

  // スタッフ・設定
  STAFF_MANAGEMENT:         'basic',
  CLINIC_SETTINGS:          'basic',
} as const

export type FeatureKey = keyof typeof FEATURES

// プランの優先順位
const PLAN_RANK: Record<Plan, number> = {
  basic:    1,
  standard: 2,
  pro:      3,
}

// -------------------------------------------------------
// 機能チェック関数
// -------------------------------------------------------
export function canUse(currentPlan: Plan, feature: FeatureKey): boolean {
  const required = FEATURES[feature] as Plan
  return PLAN_RANK[currentPlan] >= PLAN_RANK[required]
}

export function requiredPlan(feature: FeatureKey): Plan {
  return FEATURES[feature] as Plan
}

// -------------------------------------------------------
// ライセンス情報の型
// -------------------------------------------------------
export interface LicenseInfo {
  plan: Plan
  isValid: boolean
  expiresAt: string | null
}

// -------------------------------------------------------
// ライセンス取得（バックエンドAPIから）
// -------------------------------------------------------
export async function fetchLicense(clinicId = 'default'): Promise<LicenseInfo> {
  try {
    const response = await api.get(`/api/licenses/${clinicId}`)
    const data = response.data
    return {
      plan:      data.plan as Plan,
      isValid:   data.is_valid,
      expiresAt: data.expires_at,
    }
  } catch {
    // 取得失敗時はBasicにフォールバック
    return { plan: 'basic', isValid: true, expiresAt: null }
  }
}

// -------------------------------------------------------
// React Hook
// -------------------------------------------------------
export function useLicense() {
  const [license, setLicense] = useState<LicenseInfo>({
    plan: 'basic',
    isValid: true,
    expiresAt: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLicense().then((l) => {
      setLicense(l)
      setLoading(false)
    })
  }, [])

  const check = (feature: FeatureKey) => canUse(license.plan, feature)

  return { license, loading, canUse: check }
}

// -------------------------------------------------------
// FeatureGate コンポーネント
// -------------------------------------------------------
interface FeatureGateProps {
  feature: FeatureKey
  plan: Plan
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function FeatureGate({ feature, plan, children, fallback }: FeatureGateProps) {
  if (canUse(plan, feature)) return <>{children}</>
  return fallback ? <>{fallback}</> : null
}

// -------------------------------------------------------
// UpgradeBadge
// -------------------------------------------------------
interface UpgradeBadgeProps {
  feature: FeatureKey
  className?: string
}

export function UpgradeBadge({ feature, className }: UpgradeBadgeProps) {
  const needed = requiredPlan(feature)
  const label  = PLAN_LABELS[needed]
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 20,
        background: '#EEEDFE',
        color: '#534AB7',
        whiteSpace: 'nowrap',
      }}
    >
      🔒 {label}以上
    </span>
  )
}