type MaybeString = string | null | undefined;

export interface FlaggedQuestionJobRef {
  id: string;
  title: string;
  company: string;
}

export interface FlaggedQuestionRecord {
  id: string;
  job_id: string | null;
  question_text: string;
  field_key?: string | null;
  resolved?: boolean;
  answer?: string | null;
  created_at: string;
  updated_at?: string;
  job?: FlaggedQuestionJobRef | FlaggedQuestionJobRef[] | null;
}

export interface PendingQuestionRecord extends FlaggedQuestionRecord {
  ids: string[];
  duplicate_count: number;
  actionable: boolean;
  existing_answer: string | null;
  job?: FlaggedQuestionJobRef | null;
}

const BLOCKER_ONLY_PATTERN = /captcha|identity.?verif|file.?upload|resume.*upload/i;

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeJobRef(job: FlaggedQuestionRecord["job"]) {
  if (Array.isArray(job)) {
    return job[0] || null;
  }

  return job || null;
}

export function normalizeQuestionText(value: MaybeString) {
  return collapseWhitespace((value || "").toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

export function getQuestionGroupKey(question: Pick<FlaggedQuestionRecord, "field_key" | "question_text">) {
  const fieldKey = collapseWhitespace(question.field_key || "");
  if (fieldKey) {
    return `field:${fieldKey.toLowerCase()}`;
  }

  return `text:${normalizeQuestionText(question.question_text)}`;
}

export function getSupplementalQuestionKey(question: Pick<FlaggedQuestionRecord, "field_key" | "question_text">) {
  const fieldKey = collapseWhitespace(question.field_key || "");
  if (fieldKey) {
    return fieldKey;
  }

  const normalized = normalizeQuestionText(question.question_text);
  return normalized ? `pending_question:${normalized}` : "";
}

export function isBlockerOnlyQuestion(questionText: MaybeString, fieldKey?: MaybeString) {
  const normalizedFieldKey = collapseWhitespace(fieldKey || "").toLowerCase();
  if (normalizedFieldKey.startsWith("extension_alert_")) {
    return true;
  }

  return BLOCKER_ONLY_PATTERN.test(questionText || "");
}

export function dedupePendingQuestions(
  rows: FlaggedQuestionRecord[],
  supplementalAnswers: Record<string, string> = {}
) {
  const groups = new Map<string, PendingQuestionRecord>();

  for (const row of rows) {
    const groupKey = getQuestionGroupKey(row);
    const existing = groups.get(groupKey);
    const existingAnswer = row.field_key ? supplementalAnswers[row.field_key] || "" : "";

    if (!existing) {
      groups.set(groupKey, {
        ...row,
        field_key: row.field_key || null,
        job: normalizeJobRef(row.job),
        ids: [row.id],
        duplicate_count: 1,
        actionable: !isBlockerOnlyQuestion(row.question_text, row.field_key),
        existing_answer: existingAnswer || null,
      });
      continue;
    }

    existing.ids.push(row.id);
    existing.duplicate_count += 1;

    if (!existing.existing_answer && existingAnswer) {
      existing.existing_answer = existingAnswer;
    }

    if (new Date(row.created_at).getTime() > new Date(existing.created_at).getTime()) {
      existing.id = row.id;
      existing.job_id = row.job_id;
      existing.question_text = row.question_text;
      existing.field_key = row.field_key || null;
      existing.resolved = row.resolved;
      existing.answer = row.answer ?? null;
      existing.created_at = row.created_at;
      existing.updated_at = row.updated_at;
      existing.job = normalizeJobRef(row.job);
      existing.actionable = !isBlockerOnlyQuestion(row.question_text, row.field_key);
    }
  }

  return Array.from(groups.values())
    .filter((question) => !question.existing_answer?.trim())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function expandPendingQuestionIds(rows: FlaggedQuestionRecord[], ids: string[]) {
  const idsSet = new Set(ids);
  const groups = dedupePendingQuestions(rows);
  const expanded = new Set<string>();

  for (const group of groups) {
    if (group.ids.some((id) => idsSet.has(id))) {
      group.ids.forEach((id) => expanded.add(id));
    }
  }

  return Array.from(expanded);
}
