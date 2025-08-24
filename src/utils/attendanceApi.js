// src/utils/attendanceApi.js
import { db } from '../firebase'; // ← 프로젝트 경로에 맞게 확인 (예: '../pages/firebase')
import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, where, deleteDoc, writeBatch } from 'firebase/firestore';

export function isYMD(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

/** 기존: attendances 컬렉션에서 조회 */
export async function getAttendanceDates(memberId, opts = {}) {
  if (!memberId) throw new Error('memberId가 필요합니다.');
  const { start, end } = opts;

  const cons = [where('memberId', '==', memberId)];
  if (start && end) {
    if (!isYMD(start) || !isYMD(end)) throw new Error('start/end는 YYYY-MM-DD 형식이어야 합니다.');
    cons.push(where('date', '>=', start));
    cons.push(where('date', '<=', end));
  }
  cons.push(orderBy('date'));

  const snap = await getDocs(query(collection(db, 'attendances'), ...cons));
  return snap.docs.map((d) => d.data().date).filter(Boolean);
}

/** 🔹보조: events 컬렉션에서 attendeesIds 기반으로 조회 */
export async function getAttendanceDatesFromEvents(memberId, opts = {}) {
  if (!memberId) throw new Error('memberId가 필요합니다.');
  const { start, end } = opts;

  const cons = [where('attendeesIds', 'array-contains', memberId)];
  // 범위가 있으면 date 범위 + 정렬 (필요 시 콘솔 안내대로 복합 색인 생성)
  if (start && end) {
    if (!isYMD(start) || !isYMD(end)) throw new Error('start/end는 YYYY-MM-DD 형식이어야 합니다.');
    cons.push(where('date', '>=', start));
    cons.push(where('date', '<=', end));
    cons.push(orderBy('date'));
  }

  const snap = await getDocs(query(collection(db, 'events'), ...cons));
  const dates = snap.docs.map((d) => d.data().date).filter(Boolean);
  // 중복 방지 + 정렬
  return Array.from(new Set(dates)).sort((a, b) => a.localeCompare(b));
}

/** 🔸스마트: attendances가 비어있으면 events에서 뽑기 */
export async function getAttendanceDatesSmart(memberId, opts = {}) {
  const a = await getAttendanceDates(memberId, opts);
  if (a.length) return a;
  return getAttendanceDatesFromEvents(memberId, opts);
}

/** 출석 체크/취소/씨딩: 그대로 */
export async function markAttendance(memberId, date, { eventId = null, status = 'present' } = {}) {
  if (!memberId) throw new Error('memberId가 필요합니다.');
  if (!isYMD(date)) throw new Error(`date는 'YYYY-MM-DD' 형식이어야 합니다. (입력값: ${date})`);
  const id = `${memberId}_${date}`;
  await setDoc(doc(db, 'attendances', id), { memberId, date, eventId, status, createdAt: serverTimestamp() }, { merge: true });
}

export async function unmarkAttendance(memberId, date) {
  if (!memberId) throw new Error('memberId가 필요합니다.');
  if (!isYMD(date)) throw new Error(`date는 'YYYY-MM-DD' 형식이어야 합니다. (입력값: ${date})`);
  const id = `${memberId}_${date}`;
  await deleteDoc(doc(db, 'attendances', id));
}

export async function seedAttendance(memberId, dates = []) {
  if (!memberId) throw new Error('memberId가 필요합니다.');
  const batch = writeBatch(db);
  dates.forEach((date) => {
    if (!isYMD(date)) throw new Error(`잘못된 날짜: ${date}`);
    const id = `${memberId}_${date}`;
    batch.set(doc(db, 'attendances', id), { memberId, date, status: 'present', createdAt: serverTimestamp() }, { merge: true });
  });
  await batch.commit();
}
