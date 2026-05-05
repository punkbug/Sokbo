import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
// 서버 측에서는 SERVICE_ROLE_KEY를 사용하여 RLS를 우회, 클라이언트에서는 ANON_KEY 사용
const supabaseKey = (typeof window === "undefined" ? process.env.SUPABASE_SERVICE_ROLE_KEY : null) 
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
  || "";

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase credentials missing. Check your .env.local file.");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

/**
 * 특정 기사가 이미 발송되었는지 확인
 */
export const isAlreadySent = async (link: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("sent_history")
    .select("link")
    .eq("link", link)
    .single();

  return !!data;
};

/**
 * 발송된 기사 기록
 */
export const markAsSent = async (link: string, title: string): Promise<void> => {
  const { error } = await supabase
    .from("sent_history")
    .insert([{ link, title, sent_at: new Date().toISOString() }]);

  if (error) console.error("DB Error (markAsSent):", error);
};

/**
 * 최근 발송된 속보 목록 가져오기 (news 테이블에서 풍부한 정보 조회)
 */
export const getRecentNews = async (limit: number = 20): Promise<any[]> => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .gt("expires_at", now) 
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching news feed:", error);
    return [];
  }

  return data || [];
};

/**
 * 관심사별 구독 정보 가져오기
 */
export const getSubscribers = async (preset: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("subscription_json")
    .eq("preset", preset);

  if (error) {
    console.error("DB Error (getSubscribers):", error);
    return [];
  }

  return data.map(d => d.subscription_json);
};

/**
 * 관심사 구독 추가
 */
export const addSubscriber = async (preset: string, subscription: any): Promise<void> => {
  console.log(`Adding subscriber for [${preset}] with endpoint: ${subscription.endpoint}`);
  
  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(
      [{ 
        preset, 
        endpoint: subscription.endpoint, 
        subscription_json: subscription, 
        updated_at: new Date().toISOString() 
      }],
      { onConflict: "preset,endpoint" }
    );

  if (error) {
    console.error("DB Error (addSubscriber):", error);
    throw error; // API Route에서 에러를 잡을 수 있게 던짐
  }
  console.log("Successfully saved subscription to DB");
};

/**
 * 관심사 구독 해제
 */
export const removeSubscriber = async (preset: string, subscription: any): Promise<void> => {
  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("preset", preset)
    .eq("endpoint", subscription.endpoint);

  if (error) console.error("DB Error (removeSubscriber):", error);
};
