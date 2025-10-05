// src/pages/EditEventPage.js
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from './firebase';
import { collection, doc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import './CreateEventPage.css';

/** Instagram URL인지 검사 (/p/, /reel/, /tv/ 지원) */
function parseInstagram(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (!['instagram.com', 'instagr.am'].includes(host)) return null;

    // path: /p/{code}/..., /reel/{code}/..., /tv/{code}/...
    const m = u.pathname.match(/^\/(p|reel|tv)\/([^/]+)\/?/i);
    if (!m) return null;
    const type = m[1].toLowerCase();
    const code = m[2];
    // 공식 퍼머링크 (embed.js가 읽어가는 주소)
    const permalink = `https://www.instagram.com/${type}/${code}/`;
    return { permalink };
  } catch {
    return null;
  }
}

/** 확장자로 간단 체크한 일반 이미지 URL인지 */
function isDirectImage(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    return /\.(png|jpe?g|webp|gif|avif)$/.test(path);
  } catch {
    return false;
  }
}

export default function EditEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState([]);

  const [form, setForm] = useState({
    date: '', // YYYY-MM-DD
    time: '', // HH:mm
    location: '',
    imageUrl: '', // ✅ 이미지/인스타 URL
    attendees: [], // member ids
    hostId: '',
  });

  // 멤버 + 이벤트 로드
  useEffect(() => {
    (async () => {
      try {
        const [memSnap, evSnap] = await Promise.all([getDocs(collection(db, 'members')), getDoc(doc(db, 'events', id))]);

        const list = memSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setMembers(list);

        if (!evSnap.exists()) {
          alert('일정을 찾을 수 없습니다.');
          navigate(-1);
          return;
        }
        const ev = evSnap.data();
        setForm({
          date: ev.date || '',
          time: ev.time || '',
          location: ev.location || '',
          imageUrl: ev.imageUrl || '', // ✅ 기존 값 주입
          attendees: ev.attendeesIds || [],
          hostId: ev.hostId || '',
        });
      } catch (e) {
        console.error(e);
        alert('일정 로드 중 오류가 발생했습니다.');
        navigate(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  // id -> name 매핑
  const idToName = useMemo(() => {
    const m = new Map();
    members.forEach((x) => m.set(x.id, x.name || ''));
    return m;
  }, [members]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleAttendee = (mid) => {
    setForm((prev) => {
      const exists = prev.attendees.includes(mid);
      const next = exists ? prev.attendees.filter((x) => x !== mid) : [...prev.attendees, mid];
      return { ...prev, attendees: next };
    });
  };

  const onUpdate = async (e) => {
    e.preventDefault();
    if (!form.date) return alert('날짜를 입력하세요.');
    if (!form.time) return alert('시간을 입력하세요.');
    if (!form.location.trim()) return alert('장소를 입력하세요.');
    if (!form.hostId) return alert('모임장을 선택하세요.');
    if (form.attendees.length === 0) return alert('참석자를 1명 이상 선택하세요.');

    // 참석자에 host 자동 포함
    const attendeesIds = Array.from(new Set([...form.attendees, form.hostId]));
    const attendeesNames = attendeesIds.map((mid) => idToName.get(mid) || '');
    const hostName = idToName.get(form.hostId) || '';

    setSaving(true);
    try {
      await updateDoc(doc(db, 'events', id), {
        attendeesIds,
        attendeesNames,
        hostId: form.hostId,
        host: hostName,
        date: form.date,
        time: form.time,
        location: form.location,
        imageUrl: form.imageUrl ?? '', // ✅ 문자열 그대로 저장 (빈 값이면 '')
        updatedAt: serverTimestamp(),
      });
      alert('수정되었습니다.');
      navigate(-1);
    } catch (err) {
      console.error(err);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    const ok = window.confirm('이 일정을 삭제할까요? 이 동작은 되돌릴 수 없습니다.');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'events', id));
      alert('삭제되었습니다.');
      navigate('/'); // 캘린더 경로에 맞게 조정
    } catch (err) {
      console.error(err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // ✅ 미리보기 타입 결정
  const preview = useMemo(() => {
    const url = (form.imageUrl || '').trim();
    if (!url) return null;

    const ig = parseInstagram(url);
    if (ig) return { kind: 'instagram', permalink: ig.permalink };

    if (isDirectImage(url)) return { kind: 'image', src: url };

    return null;
  }, [form.imageUrl]);

  // ✅ 인스타그램 embed.js 로더 & 리프로세스 (높이 자동 맞춤)
  useEffect(() => {
    if (!preview || preview.kind !== 'instagram') return;
    const ensureEmbedScript = () =>
      new Promise((resolve) => {
        if (window.instgrm && window.instgrm.Embeds) return resolve();
        const existing = document.querySelector('script[data-instgrm-script]');
        if (existing) {
          existing.addEventListener('load', () => resolve());
          return;
        }
        const s = document.createElement('script');
        s.src = 'https://www.instagram.com/embed.js';
        s.async = true;
        s.defer = true;
        s.setAttribute('data-instgrm-script', 'true');
        s.onload = () => resolve();
        document.body.appendChild(s);
      });

    ensureEmbedScript().then(() => {
      try {
        // 약간의 지연 후 처리하면 레이아웃 안정적
        setTimeout(() => {
          window.instgrm?.Embeds?.process();
        }, 0);
      } catch {
        /* noop */
      }
    });
  }, [preview]);

  if (loading)
    return (
      <div className="container">
        <h2>🗓️ 일정 수정</h2>
        <div className="form">불러오는 중…</div>
      </div>
    );

  return (
    <div className="container">
      <h2>🗓️ 일정 수정</h2>

      <form onSubmit={onUpdate} className="form">
        <div className="row-two">
          <label className="field">
            <span>날짜</span>
            <input type="date" name="date" value={form.date} onChange={handleChange} required />
          </label>

          <label className="field">
            <span>시간</span>
            <input type="time" name="time" value={form.time} onChange={handleChange} required />
          </label>
        </div>

        <label className="field">
          <span>장소</span>
          <input type="text" name="location" placeholder="장소를 입력하세요" value={form.location} onChange={handleChange} required />
        </label>

        {/* ✅ 이미지/인스타 URL 입력 */}
        <label className="field">
          <span>이미지 URL (또는 인스타그램 게시물 URL)</span>
          <input
            type="url"
            name="imageUrl"
            placeholder="https:// 예) 이미지 주소 또는 https://www.instagram.com/p/..."
            value={form.imageUrl}
            onChange={handleChange}
          />
        </label>

        {/* ✅ 미리보기 섹션 */}
        {preview && (
          <div className="field">
            <span>미리보기</span>
            <div className="preview-box">
              {preview.kind === 'instagram' ? (
                // 인스타그램 공식 블록쿼트 방식: embed.js가 높이를 자동 계산
                <blockquote
                  key={preview.permalink} // URL 바뀔 때 재처리
                  className="instagram-media"
                  data-instgrm-permalink={preview.permalink}
                  data-instgrm-version="14"
                  style={{
                    background: '#fff',
                    border: 0,
                    borderRadius: 12,
                    boxShadow: 'none',
                    margin: 0,
                    padding: 0,
                    width: '100%',
                  }}
                >
                  {/* 인스타 요구사항: 링크 포함(접근성/백업용) */}
                  <a href={preview.permalink} target="_blank" rel="noreferrer noopener" style={{ display: 'none' }}>
                    {preview.permalink}
                  </a>
                </blockquote>
              ) : preview.kind === 'image' ? (
                <img
                  src={preview.src}
                  alt="미리보기"
                  style={{ maxWidth: '100%', borderRadius: 12, display: 'block' }}
                  onError={(e) => {
                    // 로드 실패 시 감추기
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
            </div>
          </div>
        )}

        <div className="field">
          <span>모임장(Host)</span>
          <select name="hostId" value={form.hostId} onChange={handleChange} required>
            <option value="" disabled>
              모임장을 선택하세요
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <div className="help">모임장은 자동으로 참석자에 포함됩니다.</div>
        </div>

        <div className="field">
          <span>참석자(Attendees)</span>
          <div className="attendee-list">
            {members.map((m) => (
              <label key={m.id} className="attendee-item">
                <input type="checkbox" checked={form.attendees.includes(m.id)} onChange={() => toggleAttendee(m.id)} />
                <span>{m.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="actions">
          <button type="button" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            삭제
          </button>
          <button type="submit" disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>

      {/* 보조 스타일 */}
      <style>{`
        .preview-box { background:#fafafa; border:1px solid #eee; padding:12px; border-radius:12px; }
        /* 인스타 카드가 parent 폭에 맞게 자연스럽게 커지도록 */
        .instagram-media { max-width: 100% !important; }
      `}</style>
    </div>
  );
}
