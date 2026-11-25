const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function headers() {
  return {
    apikey: supabaseAnonKey || '',
    ...(supabaseAnonKey?.startsWith('eyJ') ? { Authorization: `Bearer ${supabaseAnonKey}` } : {}),
    'Content-Type': 'application/json',
  };
}

export async function insertFoundingLeaderApplication(payload: Record<string, unknown>) {
  if (!supabaseUrl || !supabaseAnonKey) return { error: new Error('Supabase is not configured.'), id: null as string | null, feedbackToken: null as string | null };
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/founding_leader_applications`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let details: { code?: string; message?: string } = {};
      try { details = await response.json(); } catch { /* empty response */ }
      return { error: Object.assign(new Error(details.message || 'Application could not be saved.'), { code: details.code }), id: null as string | null, feedbackToken: null as string | null };
    }
    return { error: null, id: null as string | null, feedbackToken: payload.feedback_token as string | undefined };
  } catch {
    return { error: new Error('Network error. Please try again.'), id: null as string | null, feedbackToken: null as string | null };
  }
}

export async function submitFoundingLeaderFeedback(input: { feedbackToken: string; email: string; feedback: string; selfReportedDiscipleCount: number; selfReportedTestingDays: number }) {
  if (!supabaseUrl || !supabaseAnonKey) return { error: new Error('Supabase is not configured.') };
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/submit_founding_leader_feedback`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        p_feedback_token: input.feedbackToken,
        p_email: input.email.trim().toLowerCase(),
        p_feedback: input.feedback.trim(),
        p_self_reported_disciple_count: input.selfReportedDiscipleCount,
        p_self_reported_testing_days: input.selfReportedTestingDays,
      }),
    });
    if (!response.ok) {
      let details: { message?: string } = {};
      try { details = await response.json(); } catch { /* empty response */ }
      return { error: new Error(details.message || 'Feedback could not be submitted.') };
    }
    return { error: null };
  } catch {
    return { error: new Error('Network error. Please try again.') };
  }
}
