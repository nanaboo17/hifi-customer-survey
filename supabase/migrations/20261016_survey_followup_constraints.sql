-- Apply once in Supabase SQL Editor, project psxvqyetczecgqwjjpdj.
-- Keeps existing survey responses and permits the new survey reasons and follow-up details.
BEGIN;
ALTER TABLE public.survey_responses
  DROP CONSTRAINT IF EXISTS survey_responses_selected_reason_check;
ALTER TABLE public.survey_responses
  DROP CONSTRAINT IF EXISTS survey_other_reason_check;
ALTER TABLE public.survey_responses
  ADD CONSTRAINT survey_responses_selected_reason_check CHECK (
    selected_reason IN (
      'Kendala Jaringan Internet',
      'Sedang Tidak di Rumah',
      'Menggunakan Provider Internet Lain',
      'Harga Paket Kurang Sesuai dengan Anggaran',
      'Sudah Tidak Membutuhkan Layanan Internet',
      'Alasan Lainnya',
      'Koneksi Internet Bermasalah',
      'Sedang Jarang Berada di Rumah',
      'Sementara Tidak Menggunakan Layanan',
      'Tidak Ada Isu',
      'Sedang Cuti / Liburan'
    )
  );
ALTER TABLE public.survey_responses
  ADD CONSTRAINT survey_other_reason_check CHECK (
    length(coalesce(additional_reason, '')) <= 500
    AND (
      selected_reason <> 'Alasan Lainnya'
      OR length(trim(coalesce(additional_reason, ''))) >= 3
    )
  );
COMMIT;
