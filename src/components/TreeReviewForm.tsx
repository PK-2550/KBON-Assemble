import React, { useState } from 'react';
import { Star, Send, Loader2, AlertCircle, ShieldCheck, Tag } from 'lucide-react';
import { NfcScannedFruit, TreeReview } from '../types';
import { createTreeReview } from '../services/farmService';

/** คำบรรยายรสชาติที่เลือกได้ เลือกกี่อันก็ได้ หรือไม่เลือกเลยก็ได้ */
const TASTING_NOTES = [
  'หวานจัด',
  'หวานกำลังดี',
  'มันเข้มข้น',
  'กรอบนอกนุ่มใน',
  'เนื้อละเอียด',
  'เม็ดลีบ',
  'กลิ่นหอมชัด',
  'สุกกำลังพอดี',
];

interface TreeReviewFormProps {
  treeCode: string;
  /** ผลที่สแกนได้ ใช้ผูกรีวิวกับผลจริงลูกนั้น */
  scannedFruit: NfcScannedFruit;
  onSubmitted: (review: TreeReview) => void;
}

/**
 * ฟอร์มเขียนรีวิวต้นทุเรียน
 *
 * แสดงเฉพาะตอนที่ผู้ใช้เข้ามาถึงหน้านี้ด้วยการสแกนแท็ก NFC ที่ขั้วผล
 * ตัวฟอร์มไม่ได้ตัดสินใจเรื่องนี้เอง หน้าแม่เป็นคนเลือกว่าจะแสดงหรือไม่
 *
 * รหัสแท็กและน้ำหนักของผลถูกส่งไปกับรีวิวด้วย รีวิวจึงอ้างถึงผลลูกที่สแกน
 * ไม่ใช่แค่ต้นไม้ต้นนั้นกว้าง ๆ
 */
export const TreeReviewForm: React.FC<TreeReviewFormProps> = ({
  treeCode,
  scannedFruit,
  onSubmitted,
}) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleNote = (note: string) =>
    setNotes((prev) => (prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (rating === 0) {
      setError('กรุณาให้คะแนนก่อนส่งรีวิว');
      return;
    }
    if (!comment.trim()) {
      setError('กรุณาเขียนความคิดเห็นสั้น ๆ อย่างน้อยหนึ่งประโยค');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createTreeReview(treeCode, {
        // เก็บเป็นสเกล 10 เท่ากับที่ API และรีวิวเดิมใช้ ดาวหนึ่งดวงเท่ากับสองคะแนน
        rating: rating * 2,
        comment: comment.trim(),
        tastingNotes: notes,
        nfcFruitTag: scannedFruit.tagId,
        nfcFruitWeightKg: scannedFruit.weightKg,
        verifiedNfc: true,
      });
      onSubmitted(created);
      setRating(0);
      setComment('');
      setNotes([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งรีวิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  const shown = hoverRating || rating;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface rounded-2xl border border-line p-4 space-y-4"
    >
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-leaf shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-bold text-fg">เขียนรีวิวผลที่คุณสแกน</p>
          <p className="text-[11px] text-fg-2 mt-0.5 flex items-center gap-1 flex-wrap">
            <Tag className="w-3 h-3 text-gold shrink-0" />
            <span className="font-mono">{scannedFruit.tagId}</span>
            {scannedFruit.weightKg > 0 && <span>· {scannedFruit.weightKg} กก.</span>}
          </p>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-fg-2 mb-1.5">ให้คะแนน</label>
        <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              aria-label={`ให้ ${n} ดาว`}
              className="p-0.5 cursor-pointer transition-transform hover:scale-110"
            >
              <Star
                className={`w-7 h-7 ${
                  n <= shown ? 'text-gold fill-gold' : 'text-line-strong'
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-xs font-bold text-fg tabular-nums">
              {(rating * 2).toFixed(1)} / 10
            </span>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="review-comment"
          className="block text-[11px] font-bold text-fg-2 mb-1.5"
        >
          ความคิดเห็น
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="เล่าถึงรสชาติ เนื้อสัมผัส และความสดของผลที่ได้รับ"
          className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-fg placeholder:text-fg-3 focus:outline-hidden focus:border-leaf text-xs sm:text-sm resize-none"
        />
        <div className="text-[10px] text-fg-3 text-right mt-1 tabular-nums">
          {comment.length} / 500
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-fg-2 mb-1.5">
          คำบรรยายรสชาติ (เลือกได้หลายข้อ)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TASTING_NOTES.map((note) => {
            const active = notes.includes(note);
            return (
              <button
                key={note}
                type="button"
                aria-pressed={active}
                onClick={() => toggleNote(note)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-gold text-gold-ink border-gold'
                    : 'bg-surface-2 text-fg-2 border-line hover:text-fg hover:border-line-strong'
                }`}
              >
                {note}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 rounded-xl bg-surface-2 border border-line text-[11px] sm:text-xs text-fg-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 bg-gold hover:bg-gold-hi disabled:opacity-60 disabled:cursor-not-allowed text-gold-ink font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>กำลังส่งรีวิว</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            <span>ส่งรีวิว</span>
          </>
        )}
      </button>
    </form>
  );
};
